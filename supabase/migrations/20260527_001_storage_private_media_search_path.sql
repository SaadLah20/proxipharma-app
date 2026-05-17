-- Storage private-media : search_path explicite (storage.foldername) + écriture patient en SECURITY DEFINER.

create or replace function public.storage_request_id_from_private_path(p_name text)
returns uuid
language sql
stable
set search_path = public, storage
as $$
  select case
    when (storage.foldername(p_name))[1] in ('ordonnances', 'patient')
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
  select (storage.foldername(p_name))[1] in ('ordonnances', 'patient')
    and public.storage_request_id_from_private_path(p_name) is not null
    and (storage.foldername(p_name))[3] is not null;
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
        and r.request_type = 'prescription'::public.request_type_enum
        and r.status in ('draft', 'submitted', 'in_review')
    );
$$;

comment on function public.storage_patient_can_write_private_object(text) is
  'Upload ordonnance/patient : le demandeur est propriétaire de la demande (bypass RLS requests).';

grant execute on function public.storage_patient_can_write_private_object(text) to authenticated;

drop policy if exists "private_media_insert_patient" on storage.objects;
create policy "private_media_insert_patient"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'private-media'
  and public.storage_patient_can_write_private_object(name)
);

drop policy if exists "private_media_update_patient" on storage.objects;
create policy "private_media_update_patient"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'private-media'
  and public.storage_patient_can_write_private_object(name)
)
with check (
  bucket_id = 'private-media'
  and public.storage_patient_can_write_private_object(name)
);
