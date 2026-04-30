-- ProxiPharma request workflow v1
-- Hybrid model: common request table + specialized tables by type.
-- Safe to run multiple times.

create extension if not exists pgcrypto;

-- Reuse shared helper if not present in current DB state.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'request_type_enum') then
    create type public.request_type_enum as enum (
      'prescription',
      'product_request',
      'free_consultation'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'request_status_enum') then
    create type public.request_status_enum as enum (
      'draft',
      'submitted',
      'in_review',
      'responded',
      'confirmed',
      'cancelled',
      'abandoned',
      'expired',
      'partially_collected',
      'fully_collected'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'availability_status_enum') then
    create type public.availability_status_enum as enum (
      'available',
      'partially_available',
      'unavailable',
      'to_order',
      'market_shortage'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'comment_author_role_enum') then
    create type public.comment_author_role_enum as enum (
      'patient',
      'pharmacien',
      'admin',
      'system'
    );
  end if;
end $$;

-- Common request table
create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  patient_id uuid not null references public.profiles(id) on delete restrict,
  pharmacy_id uuid not null references public.pharmacies(id) on delete restrict,
  request_type public.request_type_enum not null,
  status public.request_status_enum not null default 'draft',
  submitted_at timestamptz,
  responded_at timestamptz,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  expires_at timestamptz
);

drop trigger if exists trg_requests_set_updated_at on public.requests;
create trigger trg_requests_set_updated_at
before update on public.requests
for each row
execute function public.set_updated_at();

create index if not exists requests_patient_id_idx on public.requests (patient_id);
create index if not exists requests_pharmacy_id_idx on public.requests (pharmacy_id);
create index if not exists requests_status_idx on public.requests (status);
create index if not exists requests_type_idx on public.requests (request_type);
create index if not exists requests_created_at_idx on public.requests (created_at desc);

-- Specialized tables by request type (1-to-1 with requests)
create table if not exists public.prescription_requests (
  request_id uuid primary key references public.requests(id) on delete cascade,
  prescription_image_url text not null,
  patient_note text
);

create table if not exists public.product_requests (
  request_id uuid primary key references public.requests(id) on delete cascade,
  patient_note text
);

create table if not exists public.free_consultation_requests (
  request_id uuid primary key references public.requests(id) on delete cascade,
  consultation_text text not null
);

-- Common item lines (after patient input / pharmacist review)
create table if not exists public.request_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  request_id uuid not null references public.requests(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  requested_qty integer not null default 1 check (requested_qty > 0),
  selected_qty integer check (selected_qty is null or selected_qty > 0),
  is_selected_by_patient boolean not null default true,
  client_comment text,
  pharmacist_comment text,
  availability_status public.availability_status_enum,
  available_qty integer check (available_qty is null or available_qty >= 0),
  expected_availability_date date,
  unit_price numeric(10, 2) check (unit_price is null or unit_price >= 0)
);

drop trigger if exists trg_request_items_set_updated_at on public.request_items;
create trigger trg_request_items_set_updated_at
before update on public.request_items
for each row
execute function public.set_updated_at();

create index if not exists request_items_request_id_idx on public.request_items (request_id);
create index if not exists request_items_product_id_idx on public.request_items (product_id);
create index if not exists request_items_availability_status_idx on public.request_items (availability_status);

-- Pharmacist alternatives, max 3 per item
create table if not exists public.request_item_alternatives (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  request_item_id uuid not null references public.request_items(id) on delete cascade,
  rank smallint not null check (rank between 1 and 3),
  product_id uuid not null references public.products(id) on delete restrict,
  availability_status public.availability_status_enum,
  available_qty integer check (available_qty is null or available_qty >= 0),
  expected_availability_date date,
  unit_price numeric(10, 2) check (unit_price is null or unit_price >= 0),
  pharmacist_comment text,
  unique (request_item_id, rank)
);

create index if not exists request_item_alternatives_request_item_id_idx
on public.request_item_alternatives (request_item_id);

-- Traced comments from patient/pharmacien/admin/system
create table if not exists public.request_comments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  request_id uuid not null references public.requests(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  author_role public.comment_author_role_enum not null,
  comment_text text not null,
  is_internal boolean not null default false
);

create index if not exists request_comments_request_id_idx on public.request_comments (request_id);
create index if not exists request_comments_created_at_idx on public.request_comments (created_at desc);

-- Immutable history of status transitions
create table if not exists public.request_status_history (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  request_id uuid not null references public.requests(id) on delete cascade,
  old_status public.request_status_enum,
  new_status public.request_status_enum not null,
  changed_by uuid references public.profiles(id) on delete set null,
  reason text
);

create index if not exists request_status_history_request_id_idx
on public.request_status_history (request_id);

-- Market shortage tracking by pharmacy
create table if not exists public.market_shortages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  source_request_item_id uuid references public.request_items(id) on delete set null,
  declared_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  is_active boolean not null default true,
  note text
);

drop trigger if exists trg_market_shortages_set_updated_at on public.market_shortages;
create trigger trg_market_shortages_set_updated_at
before update on public.market_shortages
for each row
execute function public.set_updated_at();

create index if not exists market_shortages_pharmacy_id_idx on public.market_shortages (pharmacy_id);
create index if not exists market_shortages_product_id_idx on public.market_shortages (product_id);
create unique index if not exists market_shortages_active_unique_idx
on public.market_shortages (pharmacy_id, product_id)
where is_active = true;

-- RLS
alter table public.requests enable row level security;
alter table public.prescription_requests enable row level security;
alter table public.product_requests enable row level security;
alter table public.free_consultation_requests enable row level security;
alter table public.request_items enable row level security;
alter table public.request_item_alternatives enable row level security;
alter table public.request_comments enable row level security;
alter table public.request_status_history enable row level security;
alter table public.market_shortages enable row level security;

-- requests policies
drop policy if exists "requests_select_access" on public.requests;
drop policy if exists "requests_insert_patient_or_admin" on public.requests;
drop policy if exists "requests_update_patient_pharmacien_admin" on public.requests;
drop policy if exists "requests_delete_admin_only" on public.requests;

create policy "requests_select_access"
on public.requests
for select
to authenticated
using (
  patient_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1
    from public.pharmacy_staff ps
    join public.profiles p on p.id = ps.user_id
    where ps.pharmacy_id = requests.pharmacy_id
      and ps.user_id = auth.uid()
      and p.role = 'pharmacien'
  )
);

create policy "requests_insert_patient_or_admin"
on public.requests
for insert
to authenticated
with check (
  public.is_admin()
  or patient_id = auth.uid()
);

create policy "requests_update_patient_pharmacien_admin"
on public.requests
for update
to authenticated
using (
  public.is_admin()
  or (
    patient_id = auth.uid()
    and status in ('draft', 'submitted', 'in_review')
  )
  or exists (
    select 1
    from public.pharmacy_staff ps
    join public.profiles p on p.id = ps.user_id
    where ps.pharmacy_id = requests.pharmacy_id
      and ps.user_id = auth.uid()
      and p.role = 'pharmacien'
  )
)
with check (
  public.is_admin()
  or (
    patient_id = auth.uid()
    and status in ('draft', 'submitted', 'in_review', 'cancelled')
  )
  or exists (
    select 1
    from public.pharmacy_staff ps
    join public.profiles p on p.id = ps.user_id
    where ps.pharmacy_id = requests.pharmacy_id
      and ps.user_id = auth.uid()
      and p.role = 'pharmacien'
  )
);

create policy "requests_delete_admin_only"
on public.requests
for delete
to authenticated
using (public.is_admin());

-- Child tables policy helpers rely on request visibility by join.
-- prescription_requests
drop policy if exists "prescription_requests_access" on public.prescription_requests;
create policy "prescription_requests_access"
on public.prescription_requests
for all
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
)
with check (
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

-- product_requests
drop policy if exists "product_requests_access" on public.product_requests;
create policy "product_requests_access"
on public.product_requests
for all
to authenticated
using (
  exists (
    select 1
    from public.requests r
    where r.id = product_requests.request_id
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
)
with check (
  exists (
    select 1
    from public.requests r
    where r.id = product_requests.request_id
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

-- free_consultation_requests
drop policy if exists "free_consultation_requests_access" on public.free_consultation_requests;
create policy "free_consultation_requests_access"
on public.free_consultation_requests
for all
to authenticated
using (
  exists (
    select 1
    from public.requests r
    where r.id = free_consultation_requests.request_id
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
)
with check (
  exists (
    select 1
    from public.requests r
    where r.id = free_consultation_requests.request_id
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

-- request_items
drop policy if exists "request_items_access" on public.request_items;
create policy "request_items_access"
on public.request_items
for all
to authenticated
using (
  exists (
    select 1
    from public.requests r
    where r.id = request_items.request_id
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
)
with check (
  exists (
    select 1
    from public.requests r
    where r.id = request_items.request_id
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

-- request_item_alternatives
drop policy if exists "request_item_alternatives_access" on public.request_item_alternatives;
create policy "request_item_alternatives_access"
on public.request_item_alternatives
for all
to authenticated
using (
  exists (
    select 1
    from public.request_items ri
    join public.requests r on r.id = ri.request_id
    where ri.id = request_item_alternatives.request_item_id
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
)
with check (
  exists (
    select 1
    from public.request_items ri
    join public.requests r on r.id = ri.request_id
    where ri.id = request_item_alternatives.request_item_id
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

-- request_comments
drop policy if exists "request_comments_access" on public.request_comments;
create policy "request_comments_access"
on public.request_comments
for all
to authenticated
using (
  exists (
    select 1
    from public.requests r
    where r.id = request_comments.request_id
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
)
with check (
  exists (
    select 1
    from public.requests r
    where r.id = request_comments.request_id
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

-- request_status_history (read for related users, write by admin/pharmacien for now)
drop policy if exists "request_status_history_select_access" on public.request_status_history;
drop policy if exists "request_status_history_insert_access" on public.request_status_history;

create policy "request_status_history_select_access"
on public.request_status_history
for select
to authenticated
using (
  exists (
    select 1
    from public.requests r
    where r.id = request_status_history.request_id
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

create policy "request_status_history_insert_access"
on public.request_status_history
for insert
to authenticated
with check (
  public.is_admin()
  or exists (
    select 1
    from public.requests r
    where r.id = request_status_history.request_id
      and exists (
        select 1
        from public.pharmacy_staff ps
        join public.profiles p on p.id = ps.user_id
        where ps.pharmacy_id = r.pharmacy_id
          and ps.user_id = auth.uid()
          and p.role = 'pharmacien'
      )
  )
);

-- market_shortages
drop policy if exists "market_shortages_select_access" on public.market_shortages;
drop policy if exists "market_shortages_write_admin_or_pharmacien" on public.market_shortages;

create policy "market_shortages_select_access"
on public.market_shortages
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.pharmacy_staff ps
    join public.profiles p on p.id = ps.user_id
    where ps.pharmacy_id = market_shortages.pharmacy_id
      and ps.user_id = auth.uid()
      and p.role = 'pharmacien'
  )
);

create policy "market_shortages_write_admin_or_pharmacien"
on public.market_shortages
for all
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.pharmacy_staff ps
    join public.profiles p on p.id = ps.user_id
    where ps.pharmacy_id = market_shortages.pharmacy_id
      and ps.user_id = auth.uid()
      and p.role = 'pharmacien'
  )
)
with check (
  public.is_admin()
  or exists (
    select 1
    from public.pharmacy_staff ps
    join public.profiles p on p.id = ps.user_id
    where ps.pharmacy_id = market_shortages.pharmacy_id
      and ps.user_id = auth.uid()
      and p.role = 'pharmacien'
  )
);
