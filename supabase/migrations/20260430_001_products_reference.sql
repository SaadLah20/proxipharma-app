-- ProxiPharma products reference table
-- Public read, admin-only write.
-- Safe to run multiple times.

create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  price_pph numeric(10, 2),
  price_ppv numeric(10, 2),
  short_description text,
  full_description text,
  product_type text not null check (product_type in ('medicament', 'parapharmacie')),
  category text,
  subcategory text,
  usage text,
  advice text,
  form text,
  laboratory text,
  photo_url text,
  is_active boolean not null default true
);

-- Keep updated_at in sync.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_products_set_updated_at on public.products;
create trigger trg_products_set_updated_at
before update on public.products
for each row
execute function public.set_updated_at();

-- Search and filter indexes.
create index if not exists products_name_idx on public.products (name);
create index if not exists products_product_type_idx on public.products (product_type);
create index if not exists products_category_idx on public.products (category);
create index if not exists products_subcategory_idx on public.products (subcategory);
create index if not exists products_laboratory_idx on public.products (laboratory);
create index if not exists products_is_active_idx on public.products (is_active);

-- Optional fast prefix search for autocomplete.
create index if not exists products_name_lower_idx on public.products ((lower(name)));

alter table public.products enable row level security;

-- Idempotent policy setup.
drop policy if exists "products_public_read" on public.products;
drop policy if exists "products_admin_insert" on public.products;
drop policy if exists "products_admin_update" on public.products;
drop policy if exists "products_admin_delete" on public.products;

create policy "products_public_read"
on public.products
for select
to anon, authenticated
using (true);

create policy "products_admin_insert"
on public.products
for insert
to authenticated
with check (public.is_admin());

create policy "products_admin_update"
on public.products
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "products_admin_delete"
on public.products
for delete
to authenticated
using (public.is_admin());
