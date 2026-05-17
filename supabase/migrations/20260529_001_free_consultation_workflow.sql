-- Consultation libre : photos (3 max), RPC patient, workflow lignes, Storage consultations/.

alter table public.free_consultation_requests
  add column if not exists image_1_path text,
  add column if not exists image_2_path text,
  add column if not exists image_3_path text;

comment on column public.free_consultation_requests.image_1_path is 'Storage private-media consultations/{request_id}/photo1.webp';
comment on column public.free_consultation_requests.image_2_path is 'Idem photo2';
comment on column public.free_consultation_requests.image_3_path is 'Idem photo3';

-- Workflow lignes : produits + ordonnances + consultations libres.
create or replace function public._request_uses_product_line_workflow(p_type public.request_type_enum)
returns boolean
language sql
immutable
as $$
  select p_type in (
    'product_request'::public.request_type_enum,
    'prescription'::public.request_type_enum,
    'free_consultation'::public.request_type_enum
  );
$$;

comment on function public._request_uses_product_line_workflow(public.request_type_enum) is
  'Demande avec lignes produits, réponse pharmacien et suivi post-validation.';

-- Avant première réponse pharmacie (publish → responded).
create or replace function public._patient_can_edit_consultation_before_response(p_request_id uuid)
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
      and r.request_type = 'free_consultation'::public.request_type_enum
      and r.status in ('submitted'::public.request_status_enum, 'in_review'::public.request_status_enum)
  );
$$;

grant execute on function public._patient_can_edit_consultation_before_response(uuid) to authenticated;

create or replace function public.patient_submit_free_consultation_request(
  p_pharmacy_id uuid,
  p_consultation_text text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_request_id uuid;
  v_text text := trim(p_consultation_text);
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'patient') then
    raise exception 'Accès patient uniquement.';
  end if;

  if p_pharmacy_id is null or not exists (select 1 from public.pharmacies ph where ph.id = p_pharmacy_id) then
    raise exception 'Pharmacie introuvable.';
  end if;

  if v_text is null or char_length(v_text) < 10 then
    raise exception 'Décrivez votre besoin en au moins 10 caractères.';
  end if;

  if char_length(v_text) > 1500 then
    raise exception 'Texte trop long (1500 caractères max).';
  end if;

  insert into public.requests (patient_id, pharmacy_id, request_type, status, submitted_at)
  values (
    v_uid,
    p_pharmacy_id,
    'free_consultation'::public.request_type_enum,
    'submitted'::public.request_status_enum,
    now()
  )
  returning id into v_request_id;

  insert into public.free_consultation_requests (request_id, consultation_text)
  values (v_request_id, v_text);

  return v_request_id;
end;
$$;

comment on function public.patient_submit_free_consultation_request(uuid, text) is
  'Crée une consultation libre (submitted) ; photos via Storage puis patient_attach_consultation_images.';

create or replace function public.patient_update_consultation_text(
  p_request_id uuid,
  p_consultation_text text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_text text := trim(p_consultation_text);
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public._patient_can_edit_consultation_before_response(p_request_id) then
    raise exception 'Modification impossible : la pharmacie a déjà répondu ou le dossier n''est plus modifiable.';
  end if;

  if v_text is null or char_length(v_text) < 10 then
    raise exception 'Le texte doit contenir au moins 10 caractères (vous ne pouvez pas le vider).';
  end if;

  if char_length(v_text) > 1500 then
    raise exception 'Texte trop long (1500 caractères max).';
  end if;

  update public.free_consultation_requests fcr
  set consultation_text = v_text
  from public.requests r
  where fcr.request_id = p_request_id
    and r.id = fcr.request_id;

  if not found then
    raise exception 'Consultation introuvable.';
  end if;
end;
$$;

create or replace function public.patient_attach_consultation_images(
  p_request_id uuid,
  p_image_1_path text default null,
  p_image_2_path text default null,
  p_image_3_path text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p1 text := nullif(trim(p_image_1_path), '');
  v_p2 text := nullif(trim(p_image_2_path), '');
  v_p3 text := nullif(trim(p_image_3_path), '');
  v_prefix text := 'consultations/' || p_request_id::text || '/';
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public._patient_can_edit_consultation_before_response(p_request_id) then
    raise exception 'Les photos ne sont plus modifiables : la pharmacie a déjà répondu.';
  end if;

  if v_p1 is not null and v_p1 !~ ('^' || v_prefix) then
    raise exception 'Chemin photo 1 invalide.';
  end if;
  if v_p2 is not null and v_p2 !~ ('^' || v_prefix) then
    raise exception 'Chemin photo 2 invalide.';
  end if;
  if v_p3 is not null and v_p3 !~ ('^' || v_prefix) then
    raise exception 'Chemin photo 3 invalide.';
  end if;

  update public.free_consultation_requests fcr
  set
    image_1_path = v_p1,
    image_2_path = v_p2,
    image_3_path = v_p3
  from public.requests r
  where fcr.request_id = p_request_id
    and r.id = fcr.request_id
    and r.patient_id = auth.uid()
    and r.request_type = 'free_consultation'::public.request_type_enum;

  if not found then
    raise exception 'Consultation introuvable ou accès refusé.';
  end if;
end;
$$;

revoke all on function public.patient_submit_free_consultation_request(uuid, text) from public;
grant execute on function public.patient_submit_free_consultation_request(uuid, text) to authenticated;

revoke all on function public.patient_update_consultation_text(uuid, text) from public;
grant execute on function public.patient_update_consultation_text(uuid, text) to authenticated;

revoke all on function public.patient_attach_consultation_images(uuid, text, text, text) from public;
grant execute on function public.patient_attach_consultation_images(uuid, text, text, text) to authenticated;

-- Storage : consultations/{request_id}/…
create or replace function public.storage_request_id_from_private_path(p_name text)
returns uuid
language sql
stable
set search_path = public, storage
as $$
  select case
    when (storage.foldername(p_name))[1] in ('ordonnances', 'patient', 'consultations')
      and (storage.foldername(p_name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then ((storage.foldername(p_name))[2])::uuid
    else null
  end;
$$;

create or replace function public.storage_is_valid_private_media_path(p_name text)
returns boolean
language sql
stable
set search_path = public, storage
as $$
  select (storage.foldername(p_name))[1] in ('ordonnances', 'patient', 'consultations')
    and public.storage_request_id_from_private_path(p_name) is not null
    and nullif(trim(storage.filename(p_name)), '') is not null;
$$;

create or replace function public.storage_patient_can_write_private_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public, storage
as $$
  select public.storage_is_valid_private_media_path(p_name)
    and exists (
      select 1
      from public.requests r
      where r.id = public.storage_request_id_from_private_path(p_name)
        and r.patient_id = auth.uid()
        and (
          (
            r.request_type = 'prescription'::public.request_type_enum
            and r.status in ('draft', 'submitted', 'in_review')
            and (storage.foldername(p_name))[1] in ('ordonnances', 'patient')
          )
          or (
            r.request_type = 'free_consultation'::public.request_type_enum
            and r.status in ('submitted', 'in_review')
            and (storage.foldername(p_name))[1] = 'consultations'
          )
        )
    );
$$;

comment on function public.storage_patient_can_write_private_object(text) is
  'Upload private-media : ordonnance (draft/submitted/in_review) ou consultation (submitted/in_review, dossier consultations/).';

-- RLS free_consultation_requests : update patient avant réponse
drop policy if exists "free_consultation_requests_update_patient" on public.free_consultation_requests;
create policy "free_consultation_requests_update_patient"
on public.free_consultation_requests
for update
to authenticated
using (
  exists (
    select 1 from public.requests r
    where r.id = free_consultation_requests.request_id
      and r.patient_id = auth.uid()
      and r.request_type = 'free_consultation'::public.request_type_enum
      and r.status in ('submitted', 'in_review')
  )
)
with check (
  exists (
    select 1 from public.requests r
    where r.id = free_consultation_requests.request_id
      and r.patient_id = auth.uid()
      and r.request_type = 'free_consultation'::public.request_type_enum
      and r.status in ('submitted', 'in_review')
  )
);
