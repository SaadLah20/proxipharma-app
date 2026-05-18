-- Patient : modifier note + chemins scan avant réponse pharmacien.

create or replace function public._patient_can_edit_prescription_before_response(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.requests r
    where r.id = p_request_id
      and r.patient_id = auth.uid()
      and r.request_type = 'prescription'::public.request_type_enum
      and r.status in ('submitted'::public.request_status_enum, 'in_review'::public.request_status_enum)
  );
$$;

grant execute on function public._patient_can_edit_prescription_before_response(uuid) to authenticated;

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
end;
$$;

grant execute on function public.patient_update_prescription_note(uuid, text) to authenticated;

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
end;
$$;
