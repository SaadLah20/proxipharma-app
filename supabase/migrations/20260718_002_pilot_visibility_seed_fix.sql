-- Correctif : les triggers de garde bloquaient le seed de 20260718_001 dans le SQL Editor
-- (auth.uid() null → is_admin() false → pilot_access / public_listed inchangés).
-- Autorise postgres / supabase_admin (SQL Editor) + réapplique les données pilote.

create or replace function public.trg_guard_pharmacies_public_listed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_privileged boolean := current_user in ('postgres', 'supabase_admin');
begin
  if tg_op = 'INSERT' then
    if not public.is_admin() and not v_privileged then
      new.public_listed := false;
    end if;
    return new;
  end if;

  if not public.is_admin() and not v_privileged and new.public_listed is distinct from old.public_listed then
    new.public_listed := old.public_listed;
  end if;
  return new;
end;
$$;

create or replace function public.trg_guard_profiles_pilot_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_privileged boolean := current_user in ('postgres', 'supabase_admin');
begin
  if tg_op = 'INSERT' then
    if not public.is_admin() and not v_privileged then
      new.pilot_access := false;
    end if;
    return new;
  end if;

  if not public.is_admin() and not v_privileged and new.pilot_access is distinct from old.pilot_access then
    new.pilot_access := old.pilot_access;
  end if;
  return new;
end;
$$;

-- Données pilote (réapplication)
update public.pharmacies
set public_listed = (id = 'd536a446-0249-429d-9196-53f5812f2c8a'::uuid);

update public.profiles
set pilot_access = (
  id in (
    '3f386bdc-b950-42b2-a0dd-1a54890420ba'::uuid,
    '3a76d2de-1b45-4c73-b59b-c99a8f962f10'::uuid,
    '64e7bfac-138f-4859-9aec-f205bb25271b'::uuid,
    'af59b677-a7ed-46ba-89bf-24ed09d8abd5'::uuid,
    'eec84e71-5d88-4d79-86ff-9fb0e0fa1f84'::uuid
  )
);

update public.profiles
set pilot_access = false
where id = '8b22458c-dc4c-4974-ae64-ee704e3025be'::uuid;
