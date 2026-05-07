-- Après validation patient : statut ligne « réservé / commandé » (affichage « en traitement »).
-- Mise à jour date/heure passage en confirmed (RPC patient + notification).
-- Ajustements notifications : pas de notif patient sur in_review ; réponse pharmacien « mise à jour ».

do $$
begin
  if not exists (select 1 from pg_type where typname = 'post_confirm_fulfillment_enum') then
    create type public.post_confirm_fulfillment_enum as enum ('unset', 'reserved', 'ordered');
  end if;
end $$;

alter table public.request_items
  add column if not exists post_confirm_fulfillment public.post_confirm_fulfillment_enum not null default 'unset';

comment on column public.request_items.post_confirm_fulfillment is
  'Après confirmed : réservé (dispo officine) ou commandé (à commander).';

create index if not exists request_items_post_confirm_fulfillment_idx
  on public.request_items (post_confirm_fulfillment);

-- ---------------------------------------------------------------------------
-- Patient : modifier passage une fois la demande confirmée (contournement RLS).
-- Même règles de fenêtre que patient_confirm_after_response (4 j / ETA+3 j).
-- ---------------------------------------------------------------------------
create or replace function public.patient_update_planned_visit_after_confirmation(
  p_request_id uuid,
  p_planned_visit_date date,
  p_planned_visit_time text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_old public.request_status_enum;
  v_patient uuid;
  v_today date;
  v_any_to_order boolean := false;
  v_max_eta date;
  v_row record;
  v_eff public.availability_status_enum;
  v_exp date;
  v_visit_time time without time zone;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select status, patient_id into v_old, v_patient
  from public.requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found';
  end if;

  if v_patient <> v_uid then
    raise exception 'Forbidden';
  end if;

  if v_old <> 'confirmed' then
    raise exception 'Invalid status: expected confirmed, got %', v_old;
  end if;

  if p_planned_visit_date is null then
    raise exception 'Date de passage obligatoire';
  end if;

  if p_planned_visit_time is not null and nullif(trim(p_planned_visit_time), '') is not null then
    begin
      v_visit_time := nullif(trim(p_planned_visit_time), '')::time without time zone;
    exception
      when invalid_text_representation then
        raise exception 'Heure de passage invalide (format HH:MM attendu)';
    end;
  else
    v_visit_time := null;
  end if;

  for v_row in
    select
      ri.id as item_id,
      ri.is_selected_by_patient,
      ri.patient_chosen_alternative_id,
      ri.availability_status as base_av,
      ri.expected_availability_date as base_exp
    from public.request_items ri
    where ri.request_id = p_request_id
  loop
    if not coalesce(v_row.is_selected_by_patient, false) then
      continue;
    end if;

    v_eff := v_row.base_av;
    v_exp := v_row.base_exp;

    if v_row.patient_chosen_alternative_id is not null then
      select a.availability_status, a.expected_availability_date
      into v_eff, v_exp
      from public.request_item_alternatives a
      where a.id = v_row.patient_chosen_alternative_id
        and a.request_item_id = v_row.item_id;
      if not found then
        raise exception 'Alternative invalide pour une ligne sélectionnée';
      end if;
    end if;

    if v_eff = 'to_order'::public.availability_status_enum then
      v_any_to_order := true;
      if v_exp is null then
        raise exception 'Produit à commander sans date de réception prévue — contactez la pharmacie.';
      end if;
      if v_max_eta is null or v_exp > v_max_eta then
        v_max_eta := v_exp;
      end if;
    end if;
  end loop;

  v_today := (timezone('Africa/Casablanca', now()))::date;

  if p_planned_visit_date < v_today then
    raise exception 'La date de passage ne peut être antérieure à aujourd’hui.';
  end if;

  if not v_any_to_order then
    if p_planned_visit_date > v_today + 4 then
      raise exception 'Sans produit « à commander » dans votre sélection, choisissez une date dans les 4 jours suivants.';
    end if;
  else
    if p_planned_visit_date > v_max_eta + 3 then
      raise exception 'Avec produit(s) à commander, la date de passage doit être au plus 3 jours après la dernière date de réception indiquée (%).', v_max_eta;
    end if;
  end if;

  update public.requests
  set
    patient_planned_visit_date = p_planned_visit_date,
    patient_planned_visit_time = v_visit_time,
    updated_at = now()
  where id = p_request_id;

  perform public._log_request_status_change(p_request_id, v_old, v_old, v_uid, 'patient_planned_visit_updated');
end;
$$;

revoke all on function public.patient_update_planned_visit_after_confirmation(uuid, date, text) from public;
grant execute on function public.patient_update_planned_visit_after_confirmation(uuid, date, text) to authenticated;

comment on function public.patient_update_planned_visit_after_confirmation(uuid, date, text) is
  'Patient (confirmed) : met à jour date/heure de passage ; journal + notification dédiée.';

-- ---------------------------------------------------------------------------
-- Pharmacien : réservé / commandé après validation patient
-- ---------------------------------------------------------------------------
create or replace function public.pharmacist_set_post_confirm_fulfillment(
  p_request_item_id uuid,
  p_fulfillment public.post_confirm_fulfillment_enum
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req_id uuid;
  v_status public.request_status_enum;
  v_pharmacy uuid;
  v_selected boolean;
  v_chosen_alt uuid;
  v_eff public.availability_status_enum;
  v_exp date;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select
    ri.request_id,
    ri.is_selected_by_patient,
    ri.patient_chosen_alternative_id,
    coalesce(ria.availability_status, ri.availability_status) as eff_av,
    case
      when ri.patient_chosen_alternative_id is not null then ria.expected_availability_date
      else ri.expected_availability_date
    end as eff_exp
  into v_req_id, v_selected, v_chosen_alt, v_eff, v_exp
  from public.request_items ri
  left join public.request_item_alternatives ria
    on ria.id = ri.patient_chosen_alternative_id
    and ria.request_item_id = ri.id
  where ri.id = p_request_item_id;

  if not found then
    raise exception 'Ligne introuvable';
  end if;

  if not coalesce(v_selected, false) then
    raise exception 'Ligne non retenue par le patient';
  end if;

  select r.status, r.pharmacy_id into v_status, v_pharmacy
  from public.requests r
  where r.id = v_req_id;

  if v_status <> 'confirmed' then
    raise exception 'Statut demande : confirmed requis';
  end if;

  if not exists (
    select 1
    from public.pharmacy_staff ps
    join public.profiles p on p.id = ps.user_id
    where ps.pharmacy_id = v_pharmacy
      and ps.user_id = auth.uid()
      and p.role = 'pharmacien'
  ) then
    raise exception 'Accès pharmacien requis';
  end if;

  if p_fulfillment = 'reserved' then
    if v_eff is null or v_eff not in ('available'::public.availability_status_enum, 'partially_available'::public.availability_status_enum) then
      raise exception '« Réservé » uniquement pour une ligne disponible ou partiellement disponible sur la branche choisie.';
    end if;
  elsif p_fulfillment = 'ordered' then
    if v_eff is distinct from 'to_order'::public.availability_status_enum then
      raise exception '« Commandé » uniquement pour une ligne « à commander » sur la branche choisie.';
    end if;
    if v_exp is null then
      raise exception 'Date de réception prévue obligatoire pour une ligne à commander.';
    end if;
  end if;

  update public.request_items
  set
    post_confirm_fulfillment = p_fulfillment,
    updated_at = now()
  where id = p_request_item_id;
end;
$$;

revoke all on function public.pharmacist_set_post_confirm_fulfillment(uuid, public.post_confirm_fulfillment_enum) from public;
grant execute on function public.pharmacist_set_post_confirm_fulfillment(uuid, public.post_confirm_fulfillment_enum) to authenticated;

comment on function public.pharmacist_set_post_confirm_fulfillment(uuid, public.post_confirm_fulfillment_enum) is
  'Pharmacien (confirmed) : indique si la ligne est réservée en officine ou commandée au grossiste.';

-- ---------------------------------------------------------------------------
-- Notifications in-app (patient)
-- ---------------------------------------------------------------------------
create or replace function public._in_app_notification_patient(
  p_status public.request_status_enum,
  p_pharma_nom text,
  p_pharma_ville text,
  p_nature text,
  p_when_fr text,
  p_history_reason text default null
)
returns table (n_title text, n_body text)
language plpgsql
stable
as $$
declare
  v_motif text;
begin
  if p_history_reason = 'patient_planned_visit_updated' then
    n_title := 'Passage en pharmacie mis à jour';
    n_body :=
      'Pharmacie : ' || coalesce(p_pharma_nom, '—')
      || ' · ' || coalesce(p_pharma_ville, '—')
      || E'\nNature : ' || p_nature
      || E'\nMis à jour le : ' || p_when_fr
      || E'\n\n'
      || E'Votre créneau de passage prévu a été modifié. Ouvrez la demande pour voir le détail.';
    return next;
    return;
  end if;

  if p_status = 'responded'::public.request_status_enum
     and p_history_reason is not null
     and p_history_reason = 'pharmacist_response_updated' then
    n_title := 'Le pharmacien a mis à jour sa réponse';
    n_body :=
      'Pharmacie : ' || coalesce(p_pharma_nom, '—')
      || ' · ' || coalesce(p_pharma_ville, '—')
      || E'\nNature : ' || p_nature
      || E'\nMis à jour le : ' || p_when_fr
      || E'\n\n'
      || E'Ouvrez la demande pour consulter les changements et ajuster votre choix si besoin.';
    return next;
    return;
  end if;

  n_title :=
    case p_status
      when 'in_review' then 'Votre demande est en cours de traitement'
      when 'responded' then 'La pharmacie vous a répondu'
      when 'completed' then 'Votre demande est clôturée'
      when 'cancelled' then 'Votre demande a été annulée'
      when 'abandoned' then 'Votre demande a été abandonnée'
      when 'expired' then 'Votre demande a expiré'
      else 'Mise à jour de votre demande'
    end;

  v_motif := null;
  if p_history_reason is not null and p_history_reason like 'pharmacist_cancel|%' then
    v_motif := substring(p_history_reason from char_length('pharmacist_cancel|') + 1);
  end if;

  n_body :=
    'Pharmacie : ' || coalesce(p_pharma_nom, '—')
    || ' · ' || coalesce(p_pharma_ville, '—')
    || E'\nNature : ' || p_nature
    || E'\nMis à jour le : ' || p_when_fr
    || E'\n\n'
    || case p_status
      when 'in_review' then
        E'L’officine traite votre dossier. Vous recevrez une notification dès qu’une réponse sera disponible.'
      when 'responded' then
        E'Vous pouvez ouvrir la demande pour valider la proposition ou demander une modification.'
      when 'completed' then
        E'Merci d’avoir utilisé ProxiPharma. Conservez ce dossier pour votre suivi si besoin.'
      when 'cancelled' then
        case
          when v_motif is not null and btrim(v_motif) <> '' then
            E'La pharmacie a annulé cette demande.' || E'\n\nMotif : ' || btrim(v_motif)
          else
            E'La demande ne sera plus suivie. Vous pouvez en créer une nouvelle depuis l’annuaire si nécessaire.'
        end
      when 'abandoned' then
        E'Le dossier a été abandonné (délai ou autre motif). Contactez la pharmacie en cas de doute.'
      when 'expired' then
        E'Le délai de traitement est dépassé. Vous pouvez relancer une nouvelle demande.'
      else
        E'Consultez le détail de la demande pour plus d’informations.'
    end;

  return next;
end;
$$;

create or replace function public._emit_in_app_notifications_for_status_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.requests%rowtype;
  v_pharma_nom text;
  v_pharma_ville text;
  v_patient_nom text;
  v_nature text;
  v_when_fr text;
  v_title_pat text;
  v_body_pat text;
  v_title_ph text;
  v_body_ph text;
begin
  if new.new_status not in (
    'submitted', 'in_review', 'responded', 'confirmed', 'completed',
    'cancelled', 'abandoned', 'expired'
  ) then
    return new;
  end if;

  select r.* into v_req
  from public.requests r
  where r.id = new.request_id;

  if not found then
    return new;
  end if;

  select ph.nom, ph.ville
  into v_pharma_nom, v_pharma_ville
  from public.pharmacies ph
  where ph.id = v_req.pharmacy_id;

  select coalesce(nullif(btrim(p.full_name::text), ''), 'Patient')
  into v_patient_nom
  from public.profiles p
  where p.id = v_req.patient_id;

  v_nature := public._request_type_label_fr(v_req.request_type);
  v_when_fr := to_char(
    new.created_at at time zone 'Africa/Casablanca',
    'DD/MM/YYYY à HH24:MI'
  );

  -- Patient : plus de notification sur seul passage « in_review »
  if new.new_status in ('responded', 'completed', 'cancelled', 'abandoned', 'expired')
     or new.reason = 'patient_planned_visit_updated' then
    select t.n_title, t.n_body
    into v_title_pat, v_body_pat
    from public._in_app_notification_patient(
      new.new_status,
      v_pharma_nom,
      v_pharma_ville,
      v_nature,
      v_when_fr,
      new.reason
    ) as t;

    insert into public.app_notifications (
      recipient_id, request_id, source_status_history_id, event_type, title, body
    )
    values (
      v_req.patient_id,
      new.request_id,
      new.id,
      case
        when new.reason = 'patient_planned_visit_updated' then 'request_event:patient_planned_visit_updated'
        else 'request_status:' || new.new_status::text
      end,
      v_title_pat,
      v_body_pat
    )
    on conflict (source_status_history_id, recipient_id)
    do nothing;
  end if;

  if new.new_status in ('submitted', 'confirmed', 'abandoned', 'cancelled', 'expired')
     and not (
       new.old_status = 'confirmed'::public.request_status_enum
       and new.new_status = 'confirmed'::public.request_status_enum
       and new.reason = 'patient_planned_visit_updated'
     )
  then
    select t.n_title, t.n_body
    into v_title_ph, v_body_ph
    from public._in_app_notification_pharmacist(
      new.new_status,
      new.old_status,
      v_pharma_nom,
      v_pharma_ville,
      v_patient_nom,
      v_nature,
      v_when_fr,
      new.reason
    ) as t;

    insert into public.app_notifications (
      recipient_id, request_id, source_status_history_id, event_type, title, body
    )
    select
      ps.user_id,
      new.request_id,
      new.id,
      'request_status:' || new.new_status::text,
      v_title_ph,
      v_body_ph
    from public.pharmacy_staff ps
    join public.profiles p on p.id = ps.user_id
    where ps.pharmacy_id = v_req.pharmacy_id
      and p.role = 'pharmacien'
    on conflict (source_status_history_id, recipient_id)
    do nothing;
  end if;

  return new;
end;
$$;

comment on function public._emit_in_app_notifications_for_status_history() is
  'Notifs : patient sans in_review ; visit_update ; responded+titre si pharmacist_response_updated.';
