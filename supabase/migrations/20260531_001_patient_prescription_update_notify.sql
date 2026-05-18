-- Notifier l’officine quand le patient modifie scan / note ordonnance (submitted ou in_review).

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

  if new.new_status in ('in_review', 'responded', 'completed', 'cancelled', 'abandoned', 'expired') then
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

  if new.new_status in ('submitted', 'confirmed', 'abandoned', 'cancelled', 'expired') then
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

create or replace function public.patient_update_prescription_note(
  p_request_id uuid,
  p_patient_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_note text := nullif(trim(p_patient_note), '');
  v_status public.request_status_enum;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public._patient_can_edit_prescription_before_response(p_request_id) then
    raise exception 'Modification impossible à ce stade.';
  end if;

  update public.prescription_requests pr
  set patient_note = v_note
  from public.requests r
  where pr.request_id = p_request_id
    and r.id = pr.request_id
    and r.patient_id = v_uid
    and r.request_type = 'prescription'::public.request_type_enum;

  if not found then
    raise exception 'Ordonnance introuvable.';
  end if;

  select r.status into v_status
  from public.requests r
  where r.id = p_request_id;

  perform public._log_request_status_change(
    p_request_id,
    v_status,
    v_status,
    v_uid,
    'patient_prescription_updated'
  );
end;
$$;

create or replace function public.patient_attach_prescription_pages(
  p_request_id uuid,
  p_page1_path text,
  p_page2_path text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_p1 text := nullif(trim(p_page1_path), '');
  v_p2 text := nullif(trim(p_page2_path), '');
  v_status public.request_status_enum;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public._patient_can_edit_prescription_before_response(p_request_id) then
    raise exception 'Modification impossible à ce stade.';
  end if;

  if v_p1 is null then
    raise exception 'Chemin page 1 obligatoire.';
  end if;

  if v_p1 !~ ('^ordonnances/' || p_request_id::text || '/') then
    raise exception 'Chemin page 1 invalide.';
  end if;

  if v_p2 is not null and v_p2 !~ ('^ordonnances/' || p_request_id::text || '/') then
    raise exception 'Chemin page 2 invalide.';
  end if;

  update public.prescription_requests pr
  set
    prescription_image_url = v_p1,
    page_2_path = v_p2
  from public.requests r
  where pr.request_id = p_request_id
    and r.id = pr.request_id
    and r.patient_id = v_uid
    and r.request_type = 'prescription'::public.request_type_enum;

  if not found then
    raise exception 'Demande ordonnance introuvable ou accès refusé.';
  end if;

  select r.status into v_status
  from public.requests r
  where r.id = p_request_id;

  perform public._log_request_status_change(
    p_request_id,
    v_status,
    v_status,
    v_uid,
    'patient_prescription_updated'
  );
end;
$$;
