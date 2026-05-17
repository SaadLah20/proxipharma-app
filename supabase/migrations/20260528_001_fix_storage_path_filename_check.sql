-- storage.foldername() ne contient pas le nom de fichier.
-- Ex. ordonnances/{request_id}/page1.webp → ['ordonnances', '{request_id}'] ; [3] était toujours NULL.

create or replace function public.storage_is_valid_private_media_path(p_name text)
returns boolean
language sql
stable
set search_path = public, storage
as $$
  select (storage.foldername(p_name))[1] in ('ordonnances', 'patient')
    and public.storage_request_id_from_private_path(p_name) is not null
    and nullif(trim(storage.filename(p_name)), '') is not null;
$$;

create or replace function public.storage_is_valid_public_asset_path(p_name text)
returns boolean
language sql
stable
set search_path = public, storage
as $$
  select (
    (storage.foldername(p_name))[1] = 'products'
    and (storage.foldername(p_name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and nullif(trim(storage.filename(p_name)), '') is not null
  )
  or (
    (storage.foldername(p_name))[1] = 'pharmacies'
    and public.storage_pharmacy_id_from_public_path(p_name) is not null
    and split_part(storage.filename(p_name), '.', 1) in ('logo', 'cover')
  );
$$;
