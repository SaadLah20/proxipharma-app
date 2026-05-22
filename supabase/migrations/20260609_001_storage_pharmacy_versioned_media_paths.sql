-- Chemins officine versionnés : pharmacies/{id}/cover-{ms}.webp | logo-{ms}.webp
-- (évite le cache navigateur). La policy 20260528_001 n'acceptait que logo.* / cover.* exacts.

create or replace function public.storage_pharmacy_media_basename_ok(p_filename text)
returns boolean
language sql
immutable
as $$
  select coalesce(
    split_part(nullif(trim(p_filename), ''), '.', 1) ~ '^(logo|cover)(-[0-9]+)?$',
    false
  );
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
    and public.storage_pharmacy_media_basename_ok(storage.filename(p_name))
  );
$$;

grant execute on function public.storage_pharmacy_media_basename_ok(text) to authenticated, anon;

comment on function public.storage_pharmacy_media_basename_ok(text) is
  'Nom de fichier officine : logo | cover | logo-{ms} | cover-{ms} (avant extension).';
