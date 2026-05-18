-- Notif pharmacien dédiée quand le patient modifie sa date/heure de passage (confirmed ou treated).

create or replace function public._in_app_notification_pharmacist(
  p_status public.request_status_enum,
  p_old_status public.request_status_enum,
  p_pharma_nom text,
  p_pharma_ville text,
  p_patient_nom text,
  p_nature text,
  p_when_fr text,
  p_history_reason text default null
)
returns table (n_title text, n_body text)
language plpgsql
stable
as $$
declare
  v_is_update_submitted boolean := false;
  v_ph_cancel_motif text;
begin
  if p_history_reason = 'patient_prescription_updated' then
    n_title := 'Le patient a mis à jour son ordonnance';
    n_body :=
      'Votre officine : ' || coalesce(p_pharma_nom, '—')
      || ' · ' || coalesce(p_pharma_ville, '—')
      || E'\nPatient : ' || coalesce(p_patient_nom, '—')
      || E'\nNature : ' || p_nature
      || E'\nÉvénement le : ' || p_when_fr
      || E'\n\n'
      || E'Le patient a modifié le scan ou une précision sur l’ordonnance. Ouvrez le dossier pour consulter la version à jour.';
    return next;
  end if;

  if p_history_reason = 'patient_planned_visit_updated' then
    n_title := 'Le patient a modifié sa date de passage';
    n_body :=
      'Votre officine : ' || coalesce(p_pharma_nom, '—')
      || ' · ' || coalesce(p_pharma_ville, '—')
      || E'\nPatient : ' || coalesce(p_patient_nom, '—')
      || E'\nNature : ' || p_nature
      || E'\nÉvénement le : ' || p_when_fr
      || E'\n\n'
      || E'Le patient a indiqué ou modifié son créneau de passage prévu. Ouvrez le dossier pour consulter la date et l’heure.';
    return next;
  end if;

  v_is_update_submitted :=
    p_status = 'submitted'
    and p_old_status is not null
    and p_old_status <> 'draft';

  if p_history_reason is not null and p_history_reason like 'pharmacist_cancel|%' then
    v_ph_cancel_motif := substring(p_history_reason from char_length('pharmacist_cancel|') + 1);
  else
    v_ph_cancel_motif := null;
  end if;

  n_title :=
    case p_status
      when 'submitted' then
        case when v_is_update_submitted
          then 'Le patient a mis à jour sa demande'
          else 'Vous avez une nouvelle demande à traiter'
        end
      when 'confirmed' then 'Le patient a validé votre proposition'
      when 'treated' then 'Dossier prêt — suivi comptoir'
      when 'cancelled' then
        case
          when v_ph_cancel_motif is not null and btrim(v_ph_cancel_motif) <> '' then
            'Demande annulée par l’officine'
          else
            'Une demande a été annulée'
        end
      when 'abandoned' then 'Une demande a été abandonnée'
      when 'expired' then 'Une demande a expiré (sans validation patient)'
      else 'Mise à jour d’une demande'
    end;

  n_body :=
    'Votre officine : ' || coalesce(p_pharma_nom, '—')
    || ' · ' || coalesce(p_pharma_ville, '—')
    || E'\nPatient : ' || coalesce(p_patient_nom, '—')
    || E'\nNature : ' || p_nature
    || E'\nÉvénement le : ' || p_when_fr
    || E'\n\n'
    || case p_status
      when 'submitted' then
        case when v_is_update_submitted
          then E'Le patient a renvoyé ou modifié sa liste. Ouvrez la demande pour traiter la version à jour.'
          else E'Ouvrez la demande pour préparer votre réponse et indiquer les produits disponibles ou les alternatives.'
        end
      when 'confirmed' then
        E'Le patient a confirmé la sélection. Vous pouvez poursuivre la préparation / le retrait au comptoir.'
      when 'treated' then
        E'Le patient doit pouvoir passer au comptoir. Indiquez les retraits ligne par ligne jusqu’à la clôture.'
      when 'cancelled' then
        case
          when v_ph_cancel_motif is not null and btrim(v_ph_cancel_motif) <> '' then
            E'Motif enregistré : ' || btrim(v_ph_cancel_motif)
          else
            E'La demande est passée en annulée. Vérifiez le dossier si vous aviez réservé du stock.'
        end
      when 'abandoned' then
        E'La demande a été abandonnée. Vérifiez le détail si vous devez libérer du stock réservé.'
      when 'expired' then
        E'Le délai après réponse pharmacie est dépassé sans action du patient. Aucune suite attendue sauf nouvelle demande.'
      else
        E'Consultez le dossier pour le contexte complet.'
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
  if new.reason = 'patient_prescription_updated' then
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
      'request_status:patient_prescription_updated',
      v_title_ph,
      v_body_ph
    from public.pharmacy_staff ps
    join public.profiles p on p.id = ps.user_id
    where ps.pharmacy_id = v_req.pharmacy_id
      and p.role = 'pharmacien'
    on conflict (source_status_history_id, recipient_id)
    do nothing;

    return new;
  end if;

  if new.reason = 'patient_planned_visit_updated' then
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
      'request_event:patient_planned_visit_updated',
      v_title_pat,
      v_body_pat
    )
    on conflict (source_status_history_id, recipient_id)
    do nothing;

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
      'request_event:patient_planned_visit_updated',
      v_title_ph,
      v_body_ph
    from public.pharmacy_staff ps
    join public.profiles p on p.id = ps.user_id
    where ps.pharmacy_id = v_req.pharmacy_id
      and p.role = 'pharmacien'
      and (new.changed_by is null or ps.user_id is distinct from new.changed_by)
    on conflict (source_status_history_id, recipient_id)
    do nothing;

    return new;
  end if;

  if new.new_status not in (
    'submitted', 'in_review', 'responded', 'confirmed', 'completed',
    'cancelled', 'abandoned', 'expired', 'treated'
  ) then
    return new;
  end if;

  if new.reason = 'counter_outcome:picked_up' then
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

  if new.new_status in (
    'in_review', 'responded', 'completed', 'cancelled', 'abandoned', 'expired', 'treated'
  ) then
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
      'request_status:' || new.new_status::text,
      v_title_pat,
      v_body_pat
    )
    on conflict (source_status_history_id, recipient_id)
    do nothing;
  end if;

  if new.new_status in ('submitted', 'confirmed', 'treated', 'abandoned', 'cancelled', 'expired') then
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
      and (new.changed_by is null or ps.user_id is distinct from new.changed_by)
    on conflict (source_status_history_id, recipient_id)
    do nothing;
  end if;

  return new;
end;
$$;
