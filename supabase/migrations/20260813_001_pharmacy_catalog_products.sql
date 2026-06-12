-- Catalogue privé par officine + recherche unifiée global / privé.
-- Phase A : produits pharmacien ; extension request_items pour lignes privées.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enum statut produit officine
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'pharmacy_catalog_product_status') then
    create type public.pharmacy_catalog_product_status as enum (
      'active',
      'unpublished',
      'archived_published'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'request_line_product_kind') then
    create type public.request_line_product_kind as enum (
      'global',
      'pharmacy',
      'patient_manual'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Table catalogue privé officine
-- ---------------------------------------------------------------------------
create table if not exists public.pharmacy_catalog_products (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null check (char_length(trim(name)) >= 1),
  product_type text not null check (product_type in ('medicament', 'parapharmacie')),
  price_pph numeric(10, 2),
  price_ppv numeric(10, 2),
  brand text,
  laboratory text,
  photo_url text,
  short_description text,
  full_description text,
  form text,
  category text,
  subcategory text,
  status public.pharmacy_catalog_product_status not null default 'active',
  promoted_product_id uuid references public.products (id) on delete set null,
  promoted_at timestamptz,
  constraint pharmacy_catalog_products_price_check check (
    (product_type = 'parapharmacie' and price_pph is not null)
    or (product_type = 'medicament' and price_ppv is not null)
  )
);

create index if not exists pharmacy_catalog_products_pharmacy_idx
  on public.pharmacy_catalog_products (pharmacy_id);

create index if not exists pharmacy_catalog_products_status_idx
  on public.pharmacy_catalog_products (pharmacy_id, status);

create index if not exists pharmacy_catalog_products_name_lower_idx
  on public.pharmacy_catalog_products (pharmacy_id, (lower(trim(name))));

create unique index if not exists pharmacy_catalog_products_unique_active_name_type_idx
  on public.pharmacy_catalog_products (pharmacy_id, lower(trim(name)), product_type)
  where status = 'active';

drop trigger if exists trg_pharmacy_catalog_products_set_updated_at on public.pharmacy_catalog_products;
create trigger trg_pharmacy_catalog_products_set_updated_at
before update on public.pharmacy_catalog_products
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Journal admin (trace)
-- ---------------------------------------------------------------------------
create table if not exists public.pharmacy_catalog_product_admin_events (
  id uuid primary key default gen_random_uuid(),
  pharmacy_product_id uuid not null references public.pharmacy_catalog_products (id) on delete cascade,
  event_type text not null check (
    event_type in (
      'created',
      'updated_by_pharmacist',
      'unpublished',
      'republished',
      'admin_enriched',
      'published',
      'rejected'
    )
  ),
  actor_id uuid references public.profiles (id) on delete set null,
  snapshot jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists pharmacy_catalog_product_admin_events_product_idx
  on public.pharmacy_catalog_product_admin_events (pharmacy_product_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Extension request_items / alternatives
-- ---------------------------------------------------------------------------
alter table public.request_items
  alter column product_id drop not null;

alter table public.request_items
  add column if not exists pharmacy_product_id uuid references public.pharmacy_catalog_products (id) on delete restrict;

alter table public.request_items
  add column if not exists patient_requested_label text;

alter table public.request_items
  add column if not exists line_product_kind public.request_line_product_kind not null default 'global';

alter table public.request_items
  add column if not exists manual_resolved_at timestamptz;

update public.request_items
set line_product_kind = 'global'
where line_product_kind is null;

alter table public.request_item_alternatives
  alter column product_id drop not null;

alter table public.request_item_alternatives
  add column if not exists pharmacy_product_id uuid references public.pharmacy_catalog_products (id) on delete restrict;

alter table public.request_item_alternatives
  add column if not exists line_product_kind public.request_line_product_kind not null default 'global';

update public.request_item_alternatives
set line_product_kind = 'global'
where line_product_kind is null;

drop index if exists public.request_items_unique_product_per_request_idx;

create unique index if not exists request_items_unique_global_product_per_request_idx
  on public.request_items (request_id, product_id)
  where product_id is not null;

create unique index if not exists request_items_unique_pharmacy_product_per_request_idx
  on public.request_items (request_id, pharmacy_product_id)
  where pharmacy_product_id is not null;

create unique index if not exists request_items_unique_manual_label_per_request_idx
  on public.request_items (request_id, lower(trim(patient_requested_label)))
  where line_product_kind = 'patient_manual' and manual_resolved_at is null;

alter table public.request_items drop constraint if exists request_items_line_product_source_check;
alter table public.request_items add constraint request_items_line_product_source_check check (
  (
    line_product_kind = 'global'
    and product_id is not null
    and pharmacy_product_id is null
    and patient_requested_label is null
  )
  or (
    line_product_kind = 'pharmacy'
    and pharmacy_product_id is not null
    and product_id is null
    and patient_requested_label is null
  )
  or (
    line_product_kind = 'patient_manual'
    and patient_requested_label is not null
    and char_length(trim(patient_requested_label)) >= 1
    and product_id is null
    and pharmacy_product_id is null
  )
);

alter table public.request_item_alternatives drop constraint if exists request_item_alternatives_line_product_source_check;
alter table public.request_item_alternatives add constraint request_item_alternatives_line_product_source_check check (
  (
    line_product_kind = 'global'
    and product_id is not null
    and pharmacy_product_id is null
  )
  or (
    line_product_kind = 'pharmacy'
    and pharmacy_product_id is not null
    and product_id is null
  )
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public._pharmacy_catalog_product_snapshot(p_row public.pharmacy_catalog_products)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'id', p_row.id,
    'pharmacy_id', p_row.pharmacy_id,
    'name', p_row.name,
    'product_type', p_row.product_type,
    'price_pph', p_row.price_pph,
    'price_ppv', p_row.price_ppv,
    'brand', p_row.brand,
    'laboratory', p_row.laboratory,
    'photo_url', p_row.photo_url,
    'short_description', p_row.short_description,
    'full_description', p_row.full_description,
    'form', p_row.form,
    'category', p_row.category,
    'subcategory', p_row.subcategory,
    'status', p_row.status,
    'promoted_product_id', p_row.promoted_product_id,
    'promoted_at', p_row.promoted_at
  );
$$;

create or replace function public._user_is_pharmacy_staff(p_pharmacy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.pharmacy_staff ps
    join public.profiles me on me.id = auth.uid() and me.role = 'pharmacien'
    where ps.pharmacy_id = p_pharmacy_id
      and ps.user_id = auth.uid()
  );
$$;

create or replace function public._pharmacy_accessible_to_current_user(p_pharmacy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.pharmacies ph
    where ph.id = p_pharmacy_id
      and (
        public.is_admin()
        or public._user_is_pharmacy_staff(p_pharmacy_id)
        or ph.public_listed = true
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.pilot_access = true
        )
      )
  );
$$;

create or replace function public.pharmacy_product_used_in_response(p_pharmacy_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.request_items ri
    join public.requests r on r.id = ri.request_id
    where ri.pharmacy_product_id = p_pharmacy_product_id
      and r.status in ('responded', 'confirmed', 'treated', 'completed')
  )
  or exists (
    select 1
    from public.request_item_alternatives ria
    join public.request_items ri on ri.id = ria.request_item_id
    join public.requests r on r.id = ri.request_id
    where ria.pharmacy_product_id = p_pharmacy_product_id
      and r.status in ('responded', 'confirmed', 'treated', 'completed')
  );
$$;

-- ---------------------------------------------------------------------------
-- Recherche unifiée
-- ---------------------------------------------------------------------------
create or replace function public.pharmacy_catalog_search(
  p_pharmacy_id uuid,
  p_query text,
  p_limit int default 48
)
returns table (
  source text,
  id uuid,
  name text,
  product_type text,
  brand text,
  laboratory text,
  photo_url text,
  price_pph numeric,
  price_ppv numeric,
  full_description text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_q text;
  v_pattern text;
  v_lim int;
begin
  if p_pharmacy_id is null then
    return;
  end if;

  if not public._pharmacy_accessible_to_current_user(p_pharmacy_id) then
    raise exception 'Pharmacie non accessible';
  end if;

  v_q := btrim(coalesce(p_query, ''));
  if char_length(v_q) < 2 then
    return;
  end if;

  v_q := regexp_replace(v_q, '[%_,]', ' ', 'g');
  v_q := regexp_replace(v_q, '\s+', ' ', 'g');
  v_q := btrim(v_q);
  if char_length(v_q) < 2 then
    return;
  end if;

  v_pattern := '%' || v_q || '%';
  v_lim := greatest(1, least(coalesce(p_limit, 48), 100));

  return query
  (
    select
      'global'::text as source,
      p.id,
      p.name,
      p.product_type,
      p.brand,
      p.laboratory,
      p.photo_url,
      p.price_pph,
      p.price_ppv,
      p.full_description
    from public.products p
    where p.is_active = true
      and (
        p.name ilike v_pattern
        or coalesce(p.brand, '') ilike v_pattern
        or coalesce(p.laboratory, '') ilike v_pattern
      )
    order by p.name
    limit v_lim
  )
  union all
  (
    select
      'pharmacy'::text as source,
      cp.id,
      cp.name,
      cp.product_type,
      cp.brand,
      cp.laboratory,
      cp.photo_url,
      cp.price_pph,
      cp.price_ppv,
      cp.full_description
    from public.pharmacy_catalog_products cp
    where cp.pharmacy_id = p_pharmacy_id
      and cp.status = 'active'
      and (
        cp.name ilike v_pattern
        or coalesce(cp.brand, '') ilike v_pattern
        or coalesce(cp.laboratory, '') ilike v_pattern
      )
    order by cp.name
    limit v_lim
  )
  limit v_lim;
end;
$$;

grant execute on function public.pharmacy_catalog_search(uuid, text, int) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- CRUD pharmacien
-- ---------------------------------------------------------------------------
create or replace function public.pharmacist_create_pharmacy_product(
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
  v_pharmacy uuid;
  v_row public.pharmacy_catalog_products;
  v_name text;
begin
  select ps.pharmacy_id into v_pharmacy
  from public.pharmacy_staff ps
  join public.profiles me on me.id = auth.uid() and me.role = 'pharmacien'
  where ps.user_id = auth.uid()
  limit 1;

  if v_pharmacy is null then
    raise exception 'Officine introuvable pour ce pharmacien';
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

  insert into public.pharmacy_catalog_products (
    pharmacy_id,
    created_by,
    name,
    product_type,
    price_pph,
    price_ppv,
    brand,
    laboratory,
    photo_url,
    short_description,
    full_description,
    form,
    category,
    subcategory,
    status
  )
  values (
    v_pharmacy,
    auth.uid(),
    v_name,
    p_product_type,
    p_price_pph,
    p_price_ppv,
    nullif(btrim(coalesce(p_brand, '')), ''),
    nullif(btrim(coalesce(p_laboratory, '')), ''),
    nullif(btrim(coalesce(p_photo_url, '')), ''),
    nullif(btrim(coalesce(p_short_description, '')), ''),
    nullif(btrim(coalesce(p_full_description, '')), ''),
    nullif(btrim(coalesce(p_form, '')), ''),
    nullif(btrim(coalesce(p_category, '')), ''),
    nullif(btrim(coalesce(p_subcategory, '')), ''),
    'active'
  )
  returning * into v_row;

  insert into public.pharmacy_catalog_product_admin_events (
    pharmacy_product_id,
    event_type,
    actor_id,
    snapshot
  )
  values (
    v_row.id,
    'created',
    auth.uid(),
    public._pharmacy_catalog_product_snapshot(v_row)
  );

  return v_row;
end;
$$;

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

  if v_row.status <> 'active' then
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
      p_status is null
      or cp.status::text = p_status
    )
  order by cp.updated_at desc, cp.name asc;
end;
$$;

grant execute on function public.pharmacist_create_pharmacy_product(text, text, numeric, numeric, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.pharmacist_update_pharmacy_product(uuid, text, text, numeric, numeric, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.pharmacist_unpublish_pharmacy_product(uuid) to authenticated;
grant execute on function public.pharmacist_republish_pharmacy_product(uuid) to authenticated;
grant execute on function public.pharmacist_list_pharmacy_products(text) to authenticated;
grant execute on function public.pharmacy_product_used_in_response(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.pharmacy_catalog_products enable row level security;
alter table public.pharmacy_catalog_product_admin_events enable row level security;

drop policy if exists "pharmacy_catalog_products_read" on public.pharmacy_catalog_products;
create policy "pharmacy_catalog_products_read"
on public.pharmacy_catalog_products
for select
to authenticated, anon
using (
  public.is_admin()
  or public._user_is_pharmacy_staff(pharmacy_id)
  or (
    status = 'active'
    and public._pharmacy_accessible_to_current_user(pharmacy_id)
  )
);

drop policy if exists "pharmacy_catalog_products_admin_write" on public.pharmacy_catalog_products;
create policy "pharmacy_catalog_products_admin_write"
on public.pharmacy_catalog_products
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "pharmacy_catalog_product_admin_events_admin" on public.pharmacy_catalog_product_admin_events;
create policy "pharmacy_catalog_product_admin_events_admin"
on public.pharmacy_catalog_product_admin_events
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "pharmacy_catalog_product_admin_events_staff_read" on public.pharmacy_catalog_product_admin_events;
create policy "pharmacy_catalog_product_admin_events_staff_read"
on public.pharmacy_catalog_product_admin_events
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.pharmacy_catalog_products cp
    where cp.id = pharmacy_product_id
      and public._user_is_pharmacy_staff(cp.pharmacy_id)
  )
);
