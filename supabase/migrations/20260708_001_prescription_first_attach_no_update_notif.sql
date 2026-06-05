-- Ordonnance : pas de notif « mise à jour » au premier attach des pages (submit patient en une fois).

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
  v_prev_note text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public._patient_can_edit_prescription_before_response(p_request_id) then
    raise exception 'Modification impossible à ce stade.';
  end if;

  select nullif(trim(pr.patient_note), '')
  into v_prev_note
  from public.prescription_requests pr
  join public.requests r on r.id = pr.request_id
  where pr.request_id = p_request_id
    and r.patient_id = v_uid
    and r.request_type = 'prescription'::public.request_type_enum;

  if not found then
    raise exception 'Ordonnance introuvable.';
  end if;

  if coalesce(v_prev_note, '') = coalesce(v_note, '') then
    return;
  end if;

  update public.prescription_requests pr
  set patient_note = v_note
  from public.requests r
  where pr.request_id = p_request_id
    and r.id = pr.request_id
    and r.patient_id = v_uid
    and r.request_type = 'prescription'::public.request_type_enum;

  perform public._sync_prescription_patient_note_to_conversation(p_request_id, v_uid, coalesce(v_note, ''));

  update public.requests
  set updated_at = now()
  where id = p_request_id
    and patient_id = v_uid;

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
  v_prev_page1 text;
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

  select nullif(trim(pr.prescription_image_url), '')
  into v_prev_page1
  from public.prescription_requests pr
  join public.requests r on r.id = pr.request_id
  where pr.request_id = p_request_id
    and r.patient_id = v_uid
    and r.request_type = 'prescription'::public.request_type_enum;

  if not found then
    raise exception 'Demande ordonnance introuvable ou accès refusé.';
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

  update public.requests
  set updated_at = now()
  where id = p_request_id
    and patient_id = v_uid;

  if v_prev_page1 is not null then
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
  end if;
end;
$$;

comment on function public.patient_attach_prescription_pages(uuid, text, text) is
  'Attach ordonnance pages ; notif patient_prescription_updated seulement si remplacement (pas 1er attach).';
