-- Fiche digitale pharmacie : profil enrichi, horaires hebdo (Maroc), exceptions, garde, catalogue services.

-- ---------------------------------------------------------------------------
-- Profil public (colonnes sur pharmacies)
-- ---------------------------------------------------------------------------
alter table public.pharmacies
  add column if not exists cover_image_path text,
  add column if not exists welcome_text text,
  add column if not exists titular_name text,
  add column if not exists titular_title text default 'Pharmacien titulaire',
  add column if not exists email text,
  add column if not exists website_url text,
  add column if not exists facebook_url text,
  add column if not exists instagram_url text,
  add column if not exists maps_url text,
  add column if not exists rating_avg numeric(3, 2) not null default 0,
  add column if not exists rating_count integer not null default 0;

comment on column public.pharmacies.cover_image_path is 'Chemin Storage public-assets (ex. pharmacies/{id}/cover.jpg).';
comment on column public.pharmacies.maps_url is 'Lien Google Maps / Waze (optionnel).';

-- ---------------------------------------------------------------------------
-- Catalogue global des services officine
-- ---------------------------------------------------------------------------
create table if not exists public.pharmacy_service_catalog (
  id text primary key,
  label_fr text not null,
  sort_order smallint not null default 0,
  is_active boolean not null default true
);

insert into public.pharmacy_service_catalog (id, label_fr, sort_order)
values
  ('vaccination', 'Vaccination', 10),
  ('prise_tension', 'Prise de tension', 20),
  ('glycemie', 'Glycémie capillaire', 30),
  ('poids', 'Pesée', 40),
  ('conseil_nutrition', 'Conseil nutrition', 50),
  ('dermo_cosmetique', 'Dermo-cosmétique', 60),
  ('orthopedie', 'Orthopédie', 70),
  ('preparation_magistrale', 'Préparation magistrale', 80),
  ('garde_info', 'Information permanence de garde', 90)
on conflict (id) do update set
  label_fr = excluded.label_fr,
  sort_order = excluded.sort_order,
  is_active = true;

create table if not exists public.pharmacy_services (
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  service_id text not null references public.pharmacy_service_catalog (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (pharmacy_id, service_id)
);

create index if not exists pharmacy_services_pharmacy_idx on public.pharmacy_services (pharmacy_id);

-- ---------------------------------------------------------------------------
-- Horaires hebdomadaires (2 créneaux : matin / après-midi)
-- weekday ISO : 1 = lundi … 7 = dimanche
-- ---------------------------------------------------------------------------
create table if not exists public.pharmacy_weekly_hours (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  period text not null check (period in ('morning', 'afternoon')),
  opens_at time,
  closes_at time,
  is_closed boolean not null default false,
  unique (pharmacy_id, weekday, period)
);

create index if not exists pharmacy_weekly_hours_pharmacy_idx on public.pharmacy_weekly_hours (pharmacy_id);

-- ---------------------------------------------------------------------------
-- Exceptions calendrier (fermeture, férié, horaires spéciaux)
-- ---------------------------------------------------------------------------
create table if not exists public.pharmacy_day_overrides (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  day_date date not null,
  override_type text not null check (override_type in ('closed', 'holiday', 'custom')),
  label text,
  morning_opens_at time,
  morning_closes_at time,
  afternoon_opens_at time,
  afternoon_closes_at time,
  unique (pharmacy_id, day_date)
);

create index if not exists pharmacy_day_overrides_pharmacy_date_idx
  on public.pharmacy_day_overrides (pharmacy_id, day_date);

-- ---------------------------------------------------------------------------
-- Permanences de garde planifiées par le pharmacien
-- weekend_48h : ex. sam 9h → dim 9h
-- weekday_24h : ex. 15 mai 9h → 16 mai 9h
-- holiday_24h : idem jours fériés
-- ---------------------------------------------------------------------------
create table if not exists public.pharmacy_on_call_periods (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  kind text not null check (kind in ('weekend_48h', 'weekday_24h', 'holiday_24h')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  note text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists pharmacy_on_call_periods_pharmacy_starts_idx
  on public.pharmacy_on_call_periods (pharmacy_id, starts_at);

-- ---------------------------------------------------------------------------
-- Horaires par défaut Maroc (lun–ven 9–13 / 15–21, sam 9–13, dim fermé)
-- ---------------------------------------------------------------------------
create or replace function public.seed_pharmacy_default_weekly_hours_morocco(p_pharmacy_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d smallint;
begin
  delete from public.pharmacy_weekly_hours where pharmacy_id = p_pharmacy_id;

  for d in 1..7 loop
    if d = 7 then
      insert into public.pharmacy_weekly_hours (pharmacy_id, weekday, period, is_closed)
      values (p_pharmacy_id, d, 'morning', true),
             (p_pharmacy_id, d, 'afternoon', true);
    elsif d = 6 then
      insert into public.pharmacy_weekly_hours (pharmacy_id, weekday, period, opens_at, closes_at, is_closed)
      values (p_pharmacy_id, 6, 'morning', time '09:00', time '13:00', false),
             (p_pharmacy_id, 6, 'afternoon', null, null, true);
    else
      insert into public.pharmacy_weekly_hours (pharmacy_id, weekday, period, opens_at, closes_at, is_closed)
      values (p_pharmacy_id, d, 'morning', time '09:00', time '13:00', false),
             (p_pharmacy_id, d, 'afternoon', time '15:00', time '21:00', false);
    end if;
  end loop;
end;
$$;

create or replace function public.trg_pharmacies_seed_weekly_hours()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_pharmacy_default_weekly_hours_morocco(new.id);
  return new;
end;
$$;

drop trigger if exists pharmacies_seed_weekly_hours on public.pharmacies;
create trigger pharmacies_seed_weekly_hours
  after insert on public.pharmacies
  for each row
  execute function public.trg_pharmacies_seed_weekly_hours();

-- Backfill horaires pour pharmacies existantes sans lignes
do $$
declare
  r record;
begin
  for r in
    select ph.id
    from public.pharmacies ph
    where not exists (
      select 1 from public.pharmacy_weekly_hours h where h.pharmacy_id = ph.id
    )
  loop
    perform public.seed_pharmacy_default_weekly_hours_morocco(r.id);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.pharmacy_service_catalog enable row level security;
alter table public.pharmacy_services enable row level security;
alter table public.pharmacy_weekly_hours enable row level security;
alter table public.pharmacy_day_overrides enable row level security;
alter table public.pharmacy_on_call_periods enable row level security;

drop policy if exists "pharmacy_service_catalog_public_read" on public.pharmacy_service_catalog;
create policy "pharmacy_service_catalog_public_read"
  on public.pharmacy_service_catalog for select to anon, authenticated using (is_active = true);

drop policy if exists "pharmacy_services_public_read" on public.pharmacy_services;
create policy "pharmacy_services_public_read"
  on public.pharmacy_services for select to anon, authenticated using (true);

drop policy if exists "pharmacy_weekly_hours_public_read" on public.pharmacy_weekly_hours;
create policy "pharmacy_weekly_hours_public_read"
  on public.pharmacy_weekly_hours for select to anon, authenticated using (true);

drop policy if exists "pharmacy_day_overrides_public_read" on public.pharmacy_day_overrides;
create policy "pharmacy_day_overrides_public_read"
  on public.pharmacy_day_overrides for select to anon, authenticated using (true);

drop policy if exists "pharmacy_on_call_public_read" on public.pharmacy_on_call_periods;
create policy "pharmacy_on_call_public_read"
  on public.pharmacy_on_call_periods for select to anon, authenticated using (true);

-- Pharmacien assigné : lecture + écriture sur sa pharmacie
drop policy if exists "pharmacy_services_pharmacien_all" on public.pharmacy_services;
create policy "pharmacy_services_pharmacien_all"
  on public.pharmacy_services for all to authenticated
  using (
    exists (
      select 1 from public.pharmacy_staff ps
      join public.profiles p on p.id = ps.user_id
      where ps.pharmacy_id = pharmacy_services.pharmacy_id
        and ps.user_id = auth.uid() and p.role = 'pharmacien'
    )
  )
  with check (
    exists (
      select 1 from public.pharmacy_staff ps
      join public.profiles p on p.id = ps.user_id
      where ps.pharmacy_id = pharmacy_services.pharmacy_id
        and ps.user_id = auth.uid() and p.role = 'pharmacien'
    )
  );

drop policy if exists "pharmacy_weekly_hours_pharmacien_all" on public.pharmacy_weekly_hours;
create policy "pharmacy_weekly_hours_pharmacien_all"
  on public.pharmacy_weekly_hours for all to authenticated
  using (
    exists (
      select 1 from public.pharmacy_staff ps
      join public.profiles p on p.id = ps.user_id
      where ps.pharmacy_id = pharmacy_weekly_hours.pharmacy_id
        and ps.user_id = auth.uid() and p.role = 'pharmacien'
    )
  )
  with check (
    exists (
      select 1 from public.pharmacy_staff ps
      join public.profiles p on p.id = ps.user_id
      where ps.pharmacy_id = pharmacy_weekly_hours.pharmacy_id
        and ps.user_id = auth.uid() and p.role = 'pharmacien'
    )
  );

drop policy if exists "pharmacy_day_overrides_pharmacien_all" on public.pharmacy_day_overrides;
create policy "pharmacy_day_overrides_pharmacien_all"
  on public.pharmacy_day_overrides for all to authenticated
  using (
    exists (
      select 1 from public.pharmacy_staff ps
      join public.profiles p on p.id = ps.user_id
      where ps.pharmacy_id = pharmacy_day_overrides.pharmacy_id
        and ps.user_id = auth.uid() and p.role = 'pharmacien'
    )
  )
  with check (
    exists (
      select 1 from public.pharmacy_staff ps
      join public.profiles p on p.id = ps.user_id
      where ps.pharmacy_id = pharmacy_day_overrides.pharmacy_id
        and ps.user_id = auth.uid() and p.role = 'pharmacien'
    )
  );

drop policy if exists "pharmacy_on_call_pharmacien_all" on public.pharmacy_on_call_periods;
create policy "pharmacy_on_call_pharmacien_all"
  on public.pharmacy_on_call_periods for all to authenticated
  using (
    exists (
      select 1 from public.pharmacy_staff ps
      join public.profiles p on p.id = ps.user_id
      where ps.pharmacy_id = pharmacy_on_call_periods.pharmacy_id
        and ps.user_id = auth.uid() and p.role = 'pharmacien'
    )
  )
  with check (
    exists (
      select 1 from public.pharmacy_staff ps
      join public.profiles p on p.id = ps.user_id
      where ps.pharmacy_id = pharmacy_on_call_periods.pharmacy_id
        and ps.user_id = auth.uid() and p.role = 'pharmacien'
    )
  );

-- Admin : tout
drop policy if exists "pharmacy_services_admin_all" on public.pharmacy_services;
create policy "pharmacy_services_admin_all"
  on public.pharmacy_services for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "pharmacy_weekly_hours_admin_all" on public.pharmacy_weekly_hours;
create policy "pharmacy_weekly_hours_admin_all"
  on public.pharmacy_weekly_hours for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "pharmacy_day_overrides_admin_all" on public.pharmacy_day_overrides;
create policy "pharmacy_day_overrides_admin_all"
  on public.pharmacy_day_overrides for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "pharmacy_on_call_admin_all" on public.pharmacy_on_call_periods;
create policy "pharmacy_on_call_admin_all"
  on public.pharmacy_on_call_periods for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select on public.pharmacy_service_catalog to anon, authenticated;
grant select on public.pharmacy_services to anon, authenticated;
grant select on public.pharmacy_weekly_hours to anon, authenticated;
grant select on public.pharmacy_day_overrides to anon, authenticated;
grant select on public.pharmacy_on_call_periods to anon, authenticated;

grant all on public.pharmacy_services to authenticated;
grant all on public.pharmacy_weekly_hours to authenticated;
grant all on public.pharmacy_day_overrides to authenticated;
grant all on public.pharmacy_on_call_periods to authenticated;
