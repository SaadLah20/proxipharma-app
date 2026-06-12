-- Archivage masqué pharmacien (« Supprimer » Mes produits) : hors vue hub + recherche,
-- conservé pour dossiers existants et file admin.

-- ---------------------------------------------------------------------------
-- Statut archived_hidden
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'pharmacy_catalog_product_status'
      and e.enumlabel = 'archived_hidden'
  ) then
    alter type public.pharmacy_catalog_product_status add value 'archived_hidden';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Journal : événement archivage pharmacien
-- ---------------------------------------------------------------------------
alter table public.pharmacy_catalog_product_admin_events
  drop constraint if exists pharmacy_catalog_product_admin_events_event_type_check;

alter table public.pharmacy_catalog_product_admin_events
  add constraint pharmacy_catalog_product_admin_events_event_type_check
  check (
    event_type in (
      'created',
      'updated_by_pharmacist',
      'unpublished',
      'republished',
      'admin_enriched',
      'published',
      'rejected',
      'archived_by_pharmacist'
    )
  );

-- ---------------------------------------------------------------------------
-- Modification : actif ou dépublié (pas archivé national / masqué)
-- ---------------------------------------------------------------------------
create or replace function public.pharmacist_update_pharmacy_product(
  p_product_id uuid,
  p_name text,
  p_product_type text,
  p_price_pph numeric default null,
  p_price_ppv numeric default null,
  p_brand text default null,
  p_laboratory text default null,
  p_photo_url text default null,
  p_short_description text default null,
  p_full_description text default null,
  p_form text default null,
  p_category text default null,
  p_subcategory text default null
)
returns public.pharmacy_catalog_products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.pharmacy_catalog_products;
  v_name text;
begin
  select * into v_row
  from public.pharmacy_catalog_products cp
  where cp.id = p_product_id
  for update;

  if not found then
    raise exception 'Produit introuvable';
  end if;

  if not public._user_is_pharmacy_staff(v_row.pharmacy_id) then
    raise exception 'Non autorisé';
  end if;

  if v_row.status not in ('active', 'unpublished') then
    raise exception 'Ce produit ne peut plus être modifié';
  end if;

  v_name := btrim(coalesce(p_name, ''));
  if char_length(v_name) < 1 then
    raise exception 'Le nom du produit est obligatoire';
  end if;

  if p_product_type not in ('medicament', 'parapharmacie') then
    raise exception 'Type de produit invalide';
  end if;

  if p_product_type = 'parapharmacie' and p_price_pph is null then
    raise exception 'Le PPH est obligatoire pour la parapharmacie';
  end if;

  if p_product_type = 'medicament' and p_price_ppv is null then
    raise exception 'Le PPV est obligatoire pour les médicaments';
  end if;

  update public.pharmacy_catalog_products
  set
    name = v_name,
    product_type = p_product_type,
    price_pph = p_price_pph,
    price_ppv = p_price_ppv,
    brand = nullif(btrim(coalesce(p_brand, '')), ''),
    laboratory = nullif(btrim(coalesce(p_laboratory, '')), ''),
    photo_url = nullif(btrim(coalesce(p_photo_url, '')), ''),
    short_description = nullif(btrim(coalesce(p_short_description, '')), ''),
    full_description = nullif(btrim(coalesce(p_full_description, '')), ''),
    form = nullif(btrim(coalesce(p_form, '')), ''),
    category = nullif(btrim(coalesce(p_category, '')), ''),
    subcategory = nullif(btrim(coalesce(p_subcategory, '')), '')
  where id = p_product_id
  returning * into v_row;

  insert into public.pharmacy_catalog_product_admin_events (
    pharmacy_product_id,
    event_type,
    actor_id,
    snapshot
  )
  values (
    v_row.id,
    'updated_by_pharmacist',
    auth.uid(),
    public._pharmacy_catalog_product_snapshot(v_row)
  );

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Archivage masqué (« Supprimer » côté pharmacien)
-- ---------------------------------------------------------------------------
create or replace function public.pharmacist_archive_pharmacy_product(p_product_id uuid)
returns public.pharmacy_catalog_products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.pharmacy_catalog_products;
begin
  select * into v_row
  from public.pharmacy_catalog_products cp
  where cp.id = p_product_id
  for update;

  if not found then
    raise exception 'Produit introuvable';
  end if;

  if not public._user_is_pharmacy_staff(v_row.pharmacy_id) then
    raise exception 'Non autorisé';
  end if;

  if v_row.status = 'archived_published' then
    raise exception 'Produit publié au catalogue national — suppression impossible';
  end if;

  if v_row.status = 'archived_hidden' then
    return v_row;
  end if;

  update public.pharmacy_catalog_products
  set status = 'archived_hidden'
  where id = p_product_id
  returning * into v_row;

  insert into public.pharmacy_catalog_product_admin_events (
    pharmacy_product_id,
    event_type,
    actor_id,
    snapshot
  )
  values (
    v_row.id,
    'archived_by_pharmacist',
    auth.uid(),
    public._pharmacy_catalog_product_snapshot(v_row)
  );

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Liste hub : masquer archived_hidden pour le pharmacien
-- ---------------------------------------------------------------------------
create or replace function public.pharmacist_list_pharmacy_products(
  p_status text default null
)
returns setof public.pharmacy_catalog_products
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pharmacy uuid;
begin
  select ps.pharmacy_id into v_pharmacy
  from public.pharmacy_staff ps
  join public.profiles me on me.id = auth.uid() and me.role = 'pharmacien'
  where ps.user_id = auth.uid()
  limit 1;

  if v_pharmacy is null then
    return;
  end if;

  return query
  select cp.*
  from public.pharmacy_catalog_products cp
  where cp.pharmacy_id = v_pharmacy
    and (
      p_status is not null
      or cp.status in ('active', 'unpublished', 'archived_published')
    )
    and (
      p_status is null
      or cp.status::text = p_status
    )
  order by cp.updated_at desc, cp.name asc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Compteur admin : inclure masqués pharmacien dans la file
-- ---------------------------------------------------------------------------
create or replace function public.admin_count_pending_community_catalog_products()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint
  from public.pharmacy_catalog_products cp
  where public.is_admin()
    and cp.status in ('active', 'unpublished', 'archived_hidden');
$$;

grant execute on function public.pharmacist_archive_pharmacy_product(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Gardes : pas de dépublication / republication depuis masqué
-- ---------------------------------------------------------------------------
create or replace function public.pharmacist_unpublish_pharmacy_product(p_product_id uuid)
returns public.pharmacy_catalog_products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.pharmacy_catalog_products;
begin
  select * into v_row
  from public.pharmacy_catalog_products cp
  where cp.id = p_product_id
  for update;

  if not found then
    raise exception 'Produit introuvable';
  end if;

  if not public._user_is_pharmacy_staff(v_row.pharmacy_id) then
    raise exception 'Non autorisé';
  end if;

  if v_row.status = 'archived_published' then
    raise exception 'Produit archivé après publication nationale';
  end if;

  if v_row.status = 'archived_hidden' then
    raise exception 'Produit masqué';
  end if;

  if v_row.status = 'unpublished' then
    return v_row;
  end if;

  update public.pharmacy_catalog_products
  set status = 'unpublished'
  where id = p_product_id
  returning * into v_row;

  insert into public.pharmacy_catalog_product_admin_events (
    pharmacy_product_id,
    event_type,
    actor_id,
    snapshot
  )
  values (
    v_row.id,
    'unpublished',
    auth.uid(),
    public._pharmacy_catalog_product_snapshot(v_row)
  );

  return v_row;
end;
$$;

create or replace function public.pharmacist_republish_pharmacy_product(p_product_id uuid)
returns public.pharmacy_catalog_products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.pharmacy_catalog_products;
begin
  select * into v_row
  from public.pharmacy_catalog_products cp
  where cp.id = p_product_id
  for update;

  if not found then
    raise exception 'Produit introuvable';
  end if;

  if not public._user_is_pharmacy_staff(v_row.pharmacy_id) then
    raise exception 'Non autorisé';
  end if;

  if v_row.status = 'archived_published' then
    raise exception 'Produit archivé après publication nationale';
  end if;

  if v_row.status = 'archived_hidden' then
    raise exception 'Produit masqué — republication impossible';
  end if;

  if v_row.status = 'active' then
    return v_row;
  end if;

  update public.pharmacy_catalog_products
  set status = 'active'
  where id = p_product_id
  returning * into v_row;

  insert into public.pharmacy_catalog_product_admin_events (
    pharmacy_product_id,
    event_type,
    actor_id,
    snapshot
  )
  values (
    v_row.id,
    'republished',
    auth.uid(),
    public._pharmacy_catalog_product_snapshot(v_row)
  );

  return v_row;
end;
$$;
