-- Ordonnance patient : soumission atomique (évite RLS multi-étapes) + chemins Storage.

-- Colonnes page 2 / image nullable (idempotent si 20260525_002 déjà appliquée)
alter table public.prescription_requests
  add column if not exists page_2_path text;

alter table public.prescription_requests
  alter column prescription_image_url drop not null;

-- Soumission : demande directement en submitted + ligne prescription_requests
create or replace function public.patient_submit_prescription_request(
  p_pharmacy_id uuid,
  p_patient_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_request_id uuid;
  v_note text := nullif(trim(p_patient_note), '');
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.profiles p where p.id = v_uid and p.role = 'patient'
  ) then
    raise exception 'Accès patient uniquement.';
  end if;

  if p_pharmacy_id is null or not exists (
    select 1 from public.pharmacies ph where ph.id = p_pharmacy_id
  ) then
    raise exception 'Pharmacie introuvable.';
  end if;

  insert into public.requests (
    patient_id,
    pharmacy_id,
    request_type,
    status,
    submitted_at
  )
  values (
    v_uid,
    p_pharmacy_id,
    'prescription'::public.request_type_enum,
    'submitted'::public.request_status_enum,
    now()
  )
  returning id into v_request_id;

  insert into public.prescription_requests (
    request_id,
    prescription_image_url,
    page_2_path,
    patient_note
  )
  values (
    v_request_id,
    null,
    null,
    v_note
  );

  if v_note is not null and char_length(v_note) between 1 and 2000 then
    insert into public.request_comments (
      request_id,
      author_id,
      author_role,
      comment_text,
      is_internal
    )
    values (
      v_request_id,
      v_uid,
      'patient'::public.comment_author_role_enum,
      v_note,
      false
    );
  end if;

  return v_request_id;
end;
$$;

comment on function public.patient_submit_prescription_request(uuid, text) is
  'Crée une demande ordonnance (submitted) + prescription_requests ; le client uploade ensuite les images Storage.';

-- Après upload Storage : enregistrer les chemins page 1 / 2
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

comment on function public.patient_attach_prescription_pages(uuid, text, text) is
  'Patient : associe les chemins Storage après upload des photos ordonnance.';

revoke all on function public.patient_submit_prescription_request(uuid, text) from public;
grant execute on function public.patient_submit_prescription_request(uuid, text) to authenticated;

revoke all on function public.patient_attach_prescription_pages(uuid, text, text) from public;
grant execute on function public.patient_attach_prescription_pages(uuid, text, text) to authenticated;

-- RLS prescription_requests : politiques explicites patient (insert/update) + lecture staff
drop policy if exists "prescription_requests_access" on public.prescription_requests;

drop policy if exists "prescription_requests_select" on public.prescription_requests;
create policy "prescription_requests_select"
on public.prescription_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.requests r
    where r.id = prescription_requests.request_id
      and (
        r.patient_id = auth.uid()
        or public.is_admin()
        or exists (
          select 1
          from public.pharmacy_staff ps
          join public.profiles p on p.id = ps.user_id
          where ps.pharmacy_id = r.pharmacy_id
            and ps.user_id = auth.uid()
            and p.role = 'pharmacien'
        )
      )
  )
);

drop policy if exists "prescription_requests_insert_patient" on public.prescription_requests;
create policy "prescription_requests_insert_patient"
on public.prescription_requests
for insert
to authenticated
with check (
  exists (
    select 1
    from public.requests r
    where r.id = prescription_requests.request_id
      and r.patient_id = auth.uid()
      and r.request_type = 'prescription'::public.request_type_enum
  )
);

drop policy if exists "prescription_requests_update_patient" on public.prescription_requests;
create policy "prescription_requests_update_patient"
on public.prescription_requests
for update
to authenticated
using (
  exists (
    select 1
    from public.requests r
    where r.id = prescription_requests.request_id
      and r.patient_id = auth.uid()
      and r.request_type = 'prescription'::public.request_type_enum
      and r.status in ('draft', 'submitted', 'in_review')
  )
)
with check (
  exists (
    select 1
    from public.requests r
    where r.id = prescription_requests.request_id
      and r.patient_id = auth.uid()
      and r.request_type = 'prescription'::public.request_type_enum
  )
);

-- Storage : upload patient (insert + update) aligné sur la demande, tous statuts tant que patient propriétaire
drop policy if exists "private_media_insert_patient" on storage.objects;
create policy "private_media_insert_patient"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'private-media'
  and public.storage_is_valid_private_media_path(name)
  and exists (
    select 1
    from public.requests r
    where r.id = public.storage_request_id_from_private_path(name)
      and r.patient_id = auth.uid()
      and r.request_type in ('prescription'::public.request_type_enum, 'product_request'::public.request_type_enum)
  )
);

drop policy if exists "private_media_update_patient" on storage.objects;
create policy "private_media_update_patient"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'private-media'
  and public.storage_is_valid_private_media_path(name)
  and exists (
    select 1
    from public.requests r
    where r.id = public.storage_request_id_from_private_path(name)
      and r.patient_id = auth.uid()
  )
)
with check (
  bucket_id = 'private-media'
  and public.storage_is_valid_private_media_path(name)
  and exists (
    select 1
    from public.requests r
    where r.id = public.storage_request_id_from_private_path(name)
      and r.patient_id = auth.uid()
  )
);
