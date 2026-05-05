-- Codes publics mémorisables :
--   Pharmacies : PH001R (PH + n° + initiale(s) ville)
--   Patients   : P0001-X (P + n° sur 4 + tiret + signe alphanum. stable)
--   Demandes   : D042/26 (D + séquence officine par année civile Casablanca + / année sur 2 chiffres)

-- --- Helpers & séquences ----------------------------------------------------

create sequence if not exists public.pharmacies_public_serial_seq;
create sequence if not exists public.patients_public_serial_seq;

create or replace function public._city_tag_for_public_ref(p_ville text)
returns text
language sql
immutable
as $$
  select case
    when p_ville is null or length(btrim(p_ville)) = 0 then 'X'
    else coalesce(
      nullif(
        upper(
          substring(
            regexp_replace(lower(btrim(p_ville)), '[^a-z]+', '', 'g')
            from 1 for 1
          )
        ),
        ''
      ),
      'X'
    )
  end;
$$;

comment on function public._city_tag_for_public_ref(text) is
  'Initiale ville (ASCII) pour suffixe code pharmacie (ex. Rabat → R).';

-- Compteur par officine et année (année = Africa/Casablanca à la création de la demande).
create table if not exists public.pharmacy_request_ref_counters (
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  yr int not null check (yr >= 2000 and yr < 2100),
  last_n int not null default 0 check (last_n >= 0),
  primary key (pharmacy_id, yr)
);

alter table public.pharmacy_request_ref_counters disable row level security;

-- --- Colonnes ---------------------------------------------------------------

alter table public.pharmacies
  add column if not exists public_ref text;

alter table public.profiles
  add column if not exists patient_ref text;

alter table public.requests
  add column if not exists request_ref_year int,
  add column if not exists request_ref_seq int,
  add column if not exists request_public_ref text;

create unique index if not exists pharmacies_public_ref_uidx
  on public.pharmacies (public_ref)
  where public_ref is not null and btrim(public_ref) <> '';

create unique index if not exists profiles_patient_ref_uidx
  on public.profiles (patient_ref)
  where patient_ref is not null and btrim(patient_ref) <> '';

create unique index if not exists requests_pharmacy_public_ref_uidx
  on public.requests (pharmacy_id, request_public_ref)
  where request_public_ref is not null and btrim(request_public_ref) <> '';

-- --- Backfill (avant triggers) ---------------------------------------------

with ord as (
  select
    id,
    row_number() over (
      order by
        coalesce(created_at, to_timestamp(0)),
        id
    ) as rn,
    ville
  from public.pharmacies
)
update public.pharmacies p
set public_ref = format(
  'PH%s%s',
  case
    when o.rn < 1000 then lpad(o.rn::text, 3, '0')
    else o.rn::text
  end,
  public._city_tag_for_public_ref(p.ville)
)
from ord o
where p.id = o.id
  and (p.public_ref is null or btrim(p.public_ref) = '');

select setval(
  'public.pharmacies_public_serial_seq',
  coalesce((select count(*)::bigint from public.pharmacies), 0)
);

with ord as (
  select
    id,
    row_number() over (order by id) as rn
  from public.profiles
  where role = 'patient'
)
update public.profiles p
set patient_ref = format(
  'P%s-%s',
  lpad(o.rn::text, 4, '0'),
  substring(
    'CFGHJKMNQRTVWXYZ234',
    (abs(hashtext(coalesce(p.id::text, ''))) % 19) + 1,
    1
  )
)
from ord o
where p.id = o.id
  and (p.patient_ref is null or btrim(p.patient_ref) = '');

select setval(
  'public.patients_public_serial_seq',
  coalesce((select count(*)::bigint from public.profiles where role = 'patient'), 0)
);

with ranked as (
  select
    id,
    pharmacy_id,
    extract(
      year from timezone('Africa/Casablanca', coalesce(created_at, now()))
    )::int as yr,
    row_number() over (
      partition by
        pharmacy_id,
        extract(year from timezone('Africa/Casablanca', coalesce(created_at, now())))::int
      order by
        created_at,
        id
    ) as n
  from public.requests
)
update public.requests r
set
  request_ref_year = ranked.yr,
  request_ref_seq = ranked.n,
  request_public_ref = format(
    'D%s/%s',
    lpad(ranked.n::text, 3, '0'),
    lpad((ranked.yr % 100)::text, 2, '0')
  )
from ranked
where r.id = ranked.id;

insert into public.pharmacy_request_ref_counters (pharmacy_id, yr, last_n)
select pharmacy_id, request_ref_year, max(request_ref_seq)
from public.requests
where request_ref_year is not null
  and request_ref_seq is not null
group by pharmacy_id, request_ref_year
on conflict (pharmacy_id, yr) do update
set last_n = greatest(public.pharmacy_request_ref_counters.last_n, excluded.last_n);

-- --- Triggers : pharmacie ----------------------------------------------------

create or replace function public.trg_assign_pharmacy_public_ref()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  vseq bigint;
begin
  if new.public_ref is not null and btrim(new.public_ref) <> '' then
    return new;
  end if;
  vseq := nextval('public.pharmacies_public_serial_seq');
  new.public_ref := format(
    'PH%s%s',
    case
      when vseq < 1000 then lpad(vseq::text, 3, '0')
      else vseq::text
    end,
    public._city_tag_for_public_ref(new.ville)
  );
  return new;
end;
$$;

drop trigger if exists trg_assign_pharmacy_public_ref on public.pharmacies;
create trigger trg_assign_pharmacy_public_ref
before insert on public.pharmacies
for each row
execute function public.trg_assign_pharmacy_public_ref();

-- --- Profils patient ---------------------------------------------------------

create or replace function public.trg_assign_profile_patient_ref()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  vsfx text;
  vseq bigint;
begin
  if new.role is distinct from 'patient' then
    return new;
  end if;
  if new.patient_ref is not null and btrim(new.patient_ref) <> '' then
    return new;
  end if;
  vseq := nextval('public.patients_public_serial_seq');
  vsfx := substring(
    'CFGHJKMNQRTVWXYZ234',
    (abs(hashtext(coalesce(new.id::text, ''))) % 19) + 1,
    1
  );
  new.patient_ref := format(
    'P%s-%s',
    lpad(vseq::text, 4, '0'),
    vsfx
  );
  return new;
end;
$$;

drop trigger if exists trg_assign_profile_patient_ref on public.profiles;
create trigger trg_assign_profile_patient_ref
before insert or update of role on public.profiles
for each row
execute function public.trg_assign_profile_patient_ref();

-- --- Demandes : compteur (nécessite bypass RLS) ------------------------------

create or replace function public.trg_assign_request_public_ref()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz timestamptz;
  v_yr int;
  v_n int;
begin
  if new.request_public_ref is not null and btrim(new.request_public_ref) <> '' then
    return new;
  end if;

  v_tz := coalesce(new.created_at, new.submitted_at, clock_timestamp());
  v_yr := extract(year from timezone('Africa/Casablanca', v_tz))::int;

  insert into public.pharmacy_request_ref_counters (pharmacy_id, yr, last_n)
  values (new.pharmacy_id, v_yr, 1)
  on conflict (pharmacy_id, yr)
  do update set last_n = public.pharmacy_request_ref_counters.last_n + 1
  returning last_n into strict v_n;

  new.request_ref_year := v_yr;
  new.request_ref_seq := v_n;
  new.request_public_ref := format(
    'D%s/%s',
    lpad(v_n::text, 3, '0'),
    lpad((v_yr % 100)::text, 2, '0')
  );
  return new;
end;
$$;

drop trigger if exists trg_assign_request_public_ref on public.requests;
create trigger trg_assign_request_public_ref
before insert on public.requests
for each row
execute function public.trg_assign_request_public_ref();

comment on column public.pharmacies.public_ref is 'Code stable affiché / recherche annuaire (ex. PH001R).';
comment on column public.profiles.patient_ref is 'Code patient mémorisé (profils role=patient, ex. P0001-K).';
comment on column public.requests.request_public_ref is 'Code demande dans l''officine et l''année (ex. D042/26), unique avec pharmacy_id.';
comment on table public.pharmacy_request_ref_counters is 'Dernier rang de séquence pour request_public_ref par pharmacie et année (fuseau Casablanca).';

-- --- RPC pharmacien : exposer patient_ref ------------------------------------
-- Postgres refuserait CREATE OR REPLACE si la liste des colonnes RETURNS TABLE change.

drop function if exists public.pharmacist_patient_contact_for_request(uuid);
drop function if exists public.pharmacist_patient_directory_for_my_pharmacy();

create function public.pharmacist_patient_contact_for_request(p_request_id uuid)
returns table (full_name text, whatsapp text, email text, patient_ref text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pid uuid;
begin
  if v_uid is null then
    return;
  end if;

  select r.patient_id
  into v_pid
  from public.requests r
  where r.id = p_request_id
    and exists (
      select 1
      from public.pharmacy_staff ps
      join public.profiles me on me.id = v_uid and me.role = 'pharmacien'
      where ps.user_id = v_uid
        and ps.pharmacy_id = r.pharmacy_id
    );

  if v_pid is null then
    return;
  end if;

  return query
  select
    p.full_name::text,
    p.whatsapp::text,
    p.email::text,
    p.patient_ref::text
  from public.profiles p
  where p.id = v_pid;
end;
$$;

revoke all on function public.pharmacist_patient_contact_for_request(uuid) from public;
grant execute on function public.pharmacist_patient_contact_for_request(uuid) to authenticated;

comment on function public.pharmacist_patient_contact_for_request(uuid) is
'Patient lié à la demande : nom, whatsapp, email, patient_ref — réservé au pharmacien staff de la pharmacie de la demande.';

create function public.pharmacist_patient_directory_for_my_pharmacy()
returns table (patient_id uuid, full_name text, whatsapp text, email text, patient_ref text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (p.id)
    p.id as patient_id,
    p.full_name::text,
    p.whatsapp::text,
    p.email::text,
    p.patient_ref::text
  from public.profiles p
  join public.requests r on r.patient_id = p.id
  where exists (
    select 1
    from public.pharmacy_staff ps
    join public.profiles me on me.id = auth.uid() and me.role = 'pharmacien'
    where ps.user_id = auth.uid()
      and ps.pharmacy_id = r.pharmacy_id
  )
  order by p.id;
$$;

revoke all on function public.pharmacist_patient_directory_for_my_pharmacy() from public;
grant execute on function public.pharmacist_patient_directory_for_my_pharmacy() to authenticated;

comment on function public.pharmacist_patient_directory_for_my_pharmacy() is
'Patients ayant au moins une demande sur une pharmacie où l’utilisateur est staff pharmacien — inclut patient_ref.';
