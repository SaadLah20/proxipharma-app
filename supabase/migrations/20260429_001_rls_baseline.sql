-- ProxiPharma RLS baseline
-- Apply in Supabase SQL Editor if not using Supabase CLI yet.
-- Safe to run multiple times.

-- Enable RLS
alter table if exists public.profiles enable row level security;
alter table if exists public.pharmacies enable row level security;
alter table if exists public.pharmacy_staff enable row level security;

-- Helper function to avoid recursive policies on profiles
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

-- Drop policies for idempotency
drop policy if exists "profiles_select_self" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;
drop policy if exists "profiles_insert_self" on public.profiles;
drop policy if exists "profiles_admin_all" on public.profiles;

drop policy if exists "pharmacies_public_read" on public.pharmacies;
drop policy if exists "pharmacies_admin_insert" on public.pharmacies;
drop policy if exists "pharmacies_admin_update" on public.pharmacies;
drop policy if exists "pharmacies_admin_delete" on public.pharmacies;
drop policy if exists "pharmacies_pharmacien_select_assigned" on public.pharmacies;
drop policy if exists "pharmacies_pharmacien_update_assigned" on public.pharmacies;

drop policy if exists "pharmacy_staff_admin_select" on public.pharmacy_staff;
drop policy if exists "pharmacy_staff_admin_insert" on public.pharmacy_staff;
drop policy if exists "pharmacy_staff_admin_update" on public.pharmacy_staff;
drop policy if exists "pharmacy_staff_admin_delete" on public.pharmacy_staff;
drop policy if exists "pharmacy_staff_pharmacien_select_self_assignments" on public.pharmacy_staff;

-- profiles policies
create policy "profiles_select_self"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

create policy "profiles_update_self"
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

create policy "profiles_insert_self"
on public.profiles
for insert
to authenticated
with check (id = auth.uid() or public.is_admin());

create policy "profiles_admin_all"
on public.profiles
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- pharmacies policies
create policy "pharmacies_public_read"
on public.pharmacies
for select
to anon, authenticated
using (true);

create policy "pharmacies_admin_insert"
on public.pharmacies
for insert
to authenticated
with check (public.is_admin());

create policy "pharmacies_admin_update"
on public.pharmacies
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "pharmacies_admin_delete"
on public.pharmacies
for delete
to authenticated
using (public.is_admin());

create policy "pharmacies_pharmacien_select_assigned"
on public.pharmacies
for select
to authenticated
using (
  exists (
    select 1
    from public.pharmacy_staff ps
    join public.profiles p on p.id = ps.user_id
    where ps.pharmacy_id = pharmacies.id
      and ps.user_id = auth.uid()
      and p.role = 'pharmacien'
  )
);

create policy "pharmacies_pharmacien_update_assigned"
on public.pharmacies
for update
to authenticated
using (
  exists (
    select 1
    from public.pharmacy_staff ps
    join public.profiles p on p.id = ps.user_id
    where ps.pharmacy_id = pharmacies.id
      and ps.user_id = auth.uid()
      and p.role = 'pharmacien'
  )
)
with check (
  exists (
    select 1
    from public.pharmacy_staff ps
    join public.profiles p on p.id = ps.user_id
    where ps.pharmacy_id = pharmacies.id
      and ps.user_id = auth.uid()
      and p.role = 'pharmacien'
  )
);

-- pharmacy_staff policies
create policy "pharmacy_staff_admin_select"
on public.pharmacy_staff
for select
to authenticated
using (public.is_admin());

create policy "pharmacy_staff_admin_insert"
on public.pharmacy_staff
for insert
to authenticated
with check (public.is_admin());

create policy "pharmacy_staff_admin_update"
on public.pharmacy_staff
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "pharmacy_staff_admin_delete"
on public.pharmacy_staff
for delete
to authenticated
using (public.is_admin());

create policy "pharmacy_staff_pharmacien_select_self_assignments"
on public.pharmacy_staff
for select
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'pharmacien'
  )
);
