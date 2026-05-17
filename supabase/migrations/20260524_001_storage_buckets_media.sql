-- ProxiPharma — Stockage médias (pilote → Pro sans changement de chemins).
-- Buckets :
--   public-assets  → produits, pharmacies (lecture publique)
--   private-media  → ordonnances, photos patient liées à une demande (privé, URLs signées)
--
-- Conventions de chemin (object name) :
--   products/{product_id}/main.{ext}
--   pharmacies/{pharmacy_id}/logo.{ext} | cover.{ext}
--   ordonnances/{request_id}/{file_id}.{ext}
--   patient/{request_id}/{file_id}.{ext}   — boutons, brûlures, etc.
--
-- En BDD (plus tard) : stocker le chemin relatif OU l’URL publique complète (legacy).
-- Voir lib/storage-media.ts pour les helpers côté app.

-- ---------------------------------------------------------------------------
-- Buckets
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'public-assets',
  'public-assets',
  true,
  5242880,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'private-media',
  'private-media',
  false,
  10485760,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Helpers accès (alignés sur RLS requests / pharmacy_staff)
-- ---------------------------------------------------------------------------

create or replace function public.storage_pharmacy_id_from_public_path(p_name text)
returns uuid
language sql
stable
as $$
  select case
    when (storage.foldername(p_name))[1] = 'pharmacies'
      and (storage.foldername(p_name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then ((storage.foldername(p_name))[2])::uuid
    else null
  end;
$$;

create or replace function public.storage_request_id_from_private_path(p_name text)
returns uuid
language sql
stable
as $$
  select case
    when (storage.foldername(p_name))[1] in ('ordonnances', 'patient')
      and (storage.foldername(p_name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then ((storage.foldername(p_name))[2])::uuid
    else null
  end;
$$;

create or replace function public.storage_is_valid_public_asset_path(p_name text)
returns boolean
language sql
stable
as $$
  select (
    (storage.foldername(p_name))[1] = 'products'
    and (storage.foldername(p_name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (storage.foldername(p_name))[3] is not null
  )
  or (
    (storage.foldername(p_name))[1] = 'pharmacies'
    and public.storage_pharmacy_id_from_public_path(p_name) is not null
    and (storage.foldername(p_name))[3] in ('logo', 'cover')
  );
$$;

create or replace function public.storage_is_valid_private_media_path(p_name text)
returns boolean
language sql
stable
as $$
  select (storage.foldername(p_name))[1] in ('ordonnances', 'patient')
    and public.storage_request_id_from_private_path(p_name) is not null
    and (storage.foldername(p_name))[3] is not null;
$$;

create or replace function public.storage_can_access_request_media(p_request_id uuid)
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
  );
$$;

create or replace function public.storage_can_access_private_media_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public, storage
as $$
  select public.storage_is_valid_private_media_path(p_name)
    and public.storage_can_access_request_media(public.storage_request_id_from_private_path(p_name));
$$;

create or replace function public.storage_pharmacist_can_manage_pharmacy(p_pharmacy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.pharmacy_staff ps
      join public.profiles p on p.id = ps.user_id
      where ps.pharmacy_id = p_pharmacy_id
        and ps.user_id = auth.uid()
        and p.role = 'pharmacien'
    );
$$;

grant execute on function public.storage_pharmacy_id_from_public_path(text) to authenticated, anon;
grant execute on function public.storage_request_id_from_private_path(text) to authenticated;
grant execute on function public.storage_is_valid_public_asset_path(text) to authenticated, anon;
grant execute on function public.storage_is_valid_private_media_path(text) to authenticated;
grant execute on function public.storage_can_access_request_media(uuid) to authenticated;
grant execute on function public.storage_can_access_private_media_object(text) to authenticated;
grant execute on function public.storage_pharmacist_can_manage_pharmacy(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Policies storage.objects — public-assets
-- ---------------------------------------------------------------------------

drop policy if exists "public_assets_select_all" on storage.objects;
drop policy if exists "public_assets_insert_admin_products" on storage.objects;
drop policy if exists "public_assets_update_admin_products" on storage.objects;
drop policy if exists "public_assets_delete_admin_products" on storage.objects;
drop policy if exists "public_assets_insert_pharmacist_pharmacy" on storage.objects;
drop policy if exists "public_assets_update_pharmacist_pharmacy" on storage.objects;
drop policy if exists "public_assets_delete_pharmacist_pharmacy" on storage.objects;

create policy "public_assets_select_all"
on storage.objects
for select
to public
using (bucket_id = 'public-assets');

create policy "public_assets_insert_admin_products"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'public-assets'
  and public.is_admin()
  and (storage.foldername(name))[1] = 'products'
  and public.storage_is_valid_public_asset_path(name)
);

create policy "public_assets_update_admin_products"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'public-assets'
  and public.is_admin()
  and (storage.foldername(name))[1] = 'products'
)
with check (
  bucket_id = 'public-assets'
  and public.is_admin()
  and public.storage_is_valid_public_asset_path(name)
);

create policy "public_assets_delete_admin_products"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'public-assets'
  and public.is_admin()
  and (storage.foldername(name))[1] = 'products'
);

create policy "public_assets_insert_pharmacist_pharmacy"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'public-assets'
  and (storage.foldername(name))[1] = 'pharmacies'
  and public.storage_is_valid_public_asset_path(name)
  and public.storage_pharmacist_can_manage_pharmacy(public.storage_pharmacy_id_from_public_path(name))
);

create policy "public_assets_update_pharmacist_pharmacy"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'public-assets'
  and (storage.foldername(name))[1] = 'pharmacies'
  and public.storage_pharmacist_can_manage_pharmacy(public.storage_pharmacy_id_from_public_path(name))
)
with check (
  bucket_id = 'public-assets'
  and public.storage_is_valid_public_asset_path(name)
  and public.storage_pharmacist_can_manage_pharmacy(public.storage_pharmacy_id_from_public_path(name))
);

create policy "public_assets_delete_pharmacist_pharmacy"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'public-assets'
  and (storage.foldername(name))[1] = 'pharmacies'
  and public.storage_pharmacist_can_manage_pharmacy(public.storage_pharmacy_id_from_public_path(name))
);

-- ---------------------------------------------------------------------------
-- Policies storage.objects — private-media
-- ---------------------------------------------------------------------------

drop policy if exists "private_media_select_access" on storage.objects;
drop policy if exists "private_media_insert_patient" on storage.objects;
drop policy if exists "private_media_update_patient" on storage.objects;
drop policy if exists "private_media_delete_patient_admin" on storage.objects;

create policy "private_media_select_access"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'private-media'
  and public.storage_can_access_private_media_object(name)
);

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
  )
);

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

create policy "private_media_delete_patient_admin"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'private-media'
  and public.storage_is_valid_private_media_path(name)
  and (
    public.is_admin()
    or exists (
      select 1
      from public.requests r
      where r.id = public.storage_request_id_from_private_path(name)
        and r.patient_id = auth.uid()
    )
  )
);

comment on function public.storage_can_access_request_media(uuid) is
'Patient, pharmacien assigné à l’officine de la demande, ou admin.';
