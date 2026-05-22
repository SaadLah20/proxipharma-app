-- Offres promo (packs) + réservations — workflow séparé des demandes (requests).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'promo_offer_status_enum') then
    create type public.promo_offer_status_enum as enum ('draft', 'published');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'promo_offer_line_kind_enum') then
    create type public.promo_offer_line_kind_enum as enum ('product', 'gift');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'promo_reservation_status_enum') then
    create type public.promo_reservation_status_enum as enum (
      'submitted',
      'confirmed',
      'unavailable',
      'collected',
      'cancelled'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Offres
-- ---------------------------------------------------------------------------
create table if not exists public.pharmacy_promo_offers (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 3 and 120),
  description text check (description is null or char_length(description) <= 800),
  discount_percent smallint not null check (discount_percent between 1 and 99),
  valid_from date not null,
  valid_until date not null,
  status public.promo_offer_status_enum not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until >= valid_from)
);

create index if not exists pharmacy_promo_offers_pharmacy_status_idx
  on public.pharmacy_promo_offers (pharmacy_id, status, valid_until desc);

drop trigger if exists trg_pharmacy_promo_offers_updated_at on public.pharmacy_promo_offers;
create trigger trg_pharmacy_promo_offers_updated_at
  before update on public.pharmacy_promo_offers
  for each row execute function public.set_updated_at();

create table if not exists public.pharmacy_promo_offer_lines (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.pharmacy_promo_offers (id) on delete cascade,
  line_kind public.promo_offer_line_kind_enum not null,
  sort_order smallint not null default 0,
  product_id uuid references public.products (id) on delete set null,
  label text check (label is null or char_length(trim(label)) <= 120),
  quantity smallint not null default 1 check (quantity between 1 and 99),
  check (
    (line_kind = 'product' and product_id is not null)
    or (line_kind = 'gift' and (product_id is not null or (label is not null and btrim(label) <> '')))
  )
);

create index if not exists pharmacy_promo_offer_lines_offer_idx
  on public.pharmacy_promo_offer_lines (offer_id, sort_order);

-- ---------------------------------------------------------------------------
-- Réservations (workflow dédié)
-- ---------------------------------------------------------------------------
create table if not exists public.pharmacy_promo_reservations (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.pharmacy_promo_offers (id) on delete restrict,
  pharmacy_id uuid not null references public.pharmacies (id) on delete restrict,
  patient_id uuid not null references public.profiles (id) on delete restrict,
  status public.promo_reservation_status_enum not null default 'submitted',
  pickup_date date not null,
  pickup_time time,
  patient_note text check (patient_note is null or char_length(patient_note) <= 300),
  pharmacist_note text check (pharmacist_note is null or char_length(pharmacist_note) <= 500),
  public_ref text,
  ref_year smallint,
  ref_seq int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pharmacy_promo_reservations_pharmacy_status_idx
  on public.pharmacy_promo_reservations (pharmacy_id, status, created_at desc);

create index if not exists pharmacy_promo_reservations_patient_idx
  on public.pharmacy_promo_reservations (patient_id, created_at desc);

create unique index if not exists pharmacy_promo_reservations_public_ref_uq
  on public.pharmacy_promo_reservations (pharmacy_id, public_ref)
  where public_ref is not null;

drop trigger if exists trg_pharmacy_promo_reservations_updated_at on public.pharmacy_promo_reservations;
create trigger trg_pharmacy_promo_reservations_updated_at
  before update on public.pharmacy_promo_reservations
  for each row execute function public.set_updated_at();

create table if not exists public.pharmacy_promo_reservation_status_history (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.pharmacy_promo_reservations (id) on delete cascade,
  old_status public.promo_reservation_status_enum,
  new_status public.promo_reservation_status_enum not null,
  actor_id uuid references public.profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists pharmacy_promo_res_status_hist_res_idx
  on public.pharmacy_promo_reservation_status_history (reservation_id, created_at desc);

-- Réf. publique P042/26 (séparée des demandes D/O/C)
create table if not exists public.pharmacy_promo_reservation_ref_counters (
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  yr int not null,
  last_n int not null default 0,
  primary key (pharmacy_id, yr)
);

create or replace function public.trg_assign_promo_reservation_public_ref()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yr int;
  v_n int;
begin
  if new.public_ref is not null and btrim(new.public_ref) <> '' then
    return new;
  end if;
  v_yr := extract(year from timezone('Africa/Casablanca', coalesce(new.created_at, now())))::int;
  insert into public.pharmacy_promo_reservation_ref_counters (pharmacy_id, yr, last_n)
  values (new.pharmacy_id, v_yr, 1)
  on conflict (pharmacy_id, yr)
  do update set last_n = public.pharmacy_promo_reservation_ref_counters.last_n + 1
  returning last_n into strict v_n;
  new.ref_year := v_yr;
  new.ref_seq := v_n;
  new.public_ref := format('P%s/%s', lpad(v_n::text, 3, '0'), lpad((v_yr % 100)::text, 2, '0'));
  return new;
end;
$$;

drop trigger if exists trg_promo_reservation_public_ref on public.pharmacy_promo_reservations;
create trigger trg_promo_reservation_public_ref
  before insert on public.pharmacy_promo_reservations
  for each row execute function public.trg_assign_promo_reservation_public_ref();

-- Notifications in-app dédiées (pas de lien requests)
create table if not exists public.promo_in_app_notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  reservation_id uuid not null references public.pharmacy_promo_reservations (id) on delete cascade,
  source_history_id uuid references public.pharmacy_promo_reservation_status_history (id) on delete set null,
  event_type text not null check (char_length(event_type) between 3 and 80),
  title text not null check (char_length(title) between 3 and 160),
  body text,
  read_at timestamptz
);

create index if not exists promo_in_app_notifications_recipient_idx
  on public.promo_in_app_notifications (recipient_id, created_at desc);

create unique index if not exists promo_in_app_notifications_source_uq
  on public.promo_in_app_notifications (source_history_id, recipient_id)
  where source_history_id is not null;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public._promo_reservation_log_status(
  p_reservation_id uuid,
  p_old public.promo_reservation_status_enum,
  p_new public.promo_reservation_status_enum,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hist_id uuid;
  v_res public.pharmacy_promo_reservations%rowtype;
  v_pharmacy_name text;
  v_patient_name text;
  v_recipient uuid;
  v_title text;
  v_body text;
begin
  insert into public.pharmacy_promo_reservation_status_history (
    reservation_id, old_status, new_status, actor_id, note
  )
  values (p_reservation_id, p_old, p_new, auth.uid(), nullif(btrim(p_note), ''))
  returning id into v_hist_id;

  select r.* into v_res from public.pharmacy_promo_reservations r where r.id = p_reservation_id;
  select ph.nom into v_pharmacy_name from public.pharmacies ph where ph.id = v_res.pharmacy_id;
  select coalesce(nullif(btrim(p.full_name), ''), 'Patient') into v_patient_name
  from public.profiles p where p.id = v_res.patient_id;

  if p_new = 'submitted' then
    select ps.user_id into v_recipient
    from public.pharmacy_staff ps where ps.pharmacy_id = v_res.pharmacy_id limit 1;
    v_title := 'Nouvelle réservation pack promo';
    v_body := v_patient_name || ' — ' || coalesce(v_res.public_ref, 'réf. pack');
  elsif p_new in ('confirmed', 'unavailable', 'collected') then
    v_recipient := v_res.patient_id;
    v_title := case p_new
      when 'confirmed' then 'Votre pack est confirmé'
      when 'unavailable' then 'Pack non disponible'
      else 'Pack récupéré'
    end;
    v_body := coalesce(v_pharmacy_name, 'Votre pharmacie') || ' — ' || coalesce(v_res.public_ref, '');
    if p_new = 'unavailable' and nullif(btrim(p_note), '') is not null then
      v_body := v_body || '. ' || btrim(p_note);
    end if;
  elsif p_new = 'cancelled' then
    if auth.uid() = v_res.patient_id then
      select ps.user_id into v_recipient from public.pharmacy_staff ps where ps.pharmacy_id = v_res.pharmacy_id limit 1;
      v_title := 'Réservation pack annulée';
      v_body := v_patient_name || ' a annulé ' || coalesce(v_res.public_ref, 'sa demande');
    else
      v_recipient := v_res.patient_id;
      v_title := 'Réservation annulée';
      v_body := coalesce(v_pharmacy_name, 'L''officine') || ' a annulé ' || coalesce(v_res.public_ref, 'votre demande');
    end if;
  end if;

  if v_recipient is not null and v_recipient <> auth.uid() then
    insert into public.promo_in_app_notifications (
      recipient_id, reservation_id, source_history_id, event_type, title, body
    )
    values (
      v_recipient,
      p_reservation_id,
      v_hist_id,
      'promo_reservation:' || p_new::text,
      v_title,
      v_body
    )
    on conflict (source_history_id, recipient_id) where source_history_id is not null do nothing;
  end if;

  return v_hist_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.pharmacy_promo_offers enable row level security;
alter table public.pharmacy_promo_offer_lines enable row level security;
alter table public.pharmacy_promo_reservations enable row level security;
alter table public.pharmacy_promo_reservation_status_history enable row level security;
alter table public.promo_in_app_notifications enable row level security;

-- Offres : lecture publique si publiées et dans la fenêtre de validité
drop policy if exists "promo_offers_public_read_published" on public.pharmacy_promo_offers;
create policy "promo_offers_public_read_published"
  on public.pharmacy_promo_offers for select to anon, authenticated
  using (
    status = 'published'
    and valid_until >= (timezone('Africa/Casablanca', now()))::date
  );

drop policy if exists "promo_offers_pharmacien_all" on public.pharmacy_promo_offers;
create policy "promo_offers_pharmacien_all"
  on public.pharmacy_promo_offers for all to authenticated
  using (
    exists (
      select 1 from public.pharmacy_staff ps
      where ps.pharmacy_id = pharmacy_promo_offers.pharmacy_id and ps.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.pharmacy_staff ps
      where ps.pharmacy_id = pharmacy_promo_offers.pharmacy_id and ps.user_id = auth.uid()
    )
  );

drop policy if exists "promo_offer_lines_public_read" on public.pharmacy_promo_offer_lines;
create policy "promo_offer_lines_public_read"
  on public.pharmacy_promo_offer_lines for select to anon, authenticated
  using (
    exists (
      select 1 from public.pharmacy_promo_offers o
      where o.id = offer_id and o.status = 'published'
        and o.valid_until >= (timezone('Africa/Casablanca', now()))::date
    )
  );

drop policy if exists "promo_offer_lines_pharmacien_all" on public.pharmacy_promo_offer_lines;
create policy "promo_offer_lines_pharmacien_all"
  on public.pharmacy_promo_offer_lines for all to authenticated
  using (
    exists (
      select 1 from public.pharmacy_promo_offers o
      join public.pharmacy_staff ps on ps.pharmacy_id = o.pharmacy_id
      where o.id = offer_id and ps.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.pharmacy_promo_offers o
      join public.pharmacy_staff ps on ps.pharmacy_id = o.pharmacy_id
      where o.id = offer_id and ps.user_id = auth.uid()
    )
  );

drop policy if exists "promo_reservations_patient_own" on public.pharmacy_promo_reservations;
create policy "promo_reservations_patient_own"
  on public.pharmacy_promo_reservations for select to authenticated
  using (patient_id = auth.uid());

drop policy if exists "promo_reservations_pharmacien_pharmacy" on public.pharmacy_promo_reservations;
create policy "promo_reservations_pharmacien_pharmacy"
  on public.pharmacy_promo_reservations for all to authenticated
  using (
    exists (
      select 1 from public.pharmacy_staff ps
      where ps.pharmacy_id = pharmacy_promo_reservations.pharmacy_id and ps.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.pharmacy_staff ps
      where ps.pharmacy_id = pharmacy_promo_reservations.pharmacy_id and ps.user_id = auth.uid()
    )
  );

drop policy if exists "promo_res_hist_participants" on public.pharmacy_promo_reservation_status_history;
create policy "promo_res_hist_participants"
  on public.pharmacy_promo_reservation_status_history for select to authenticated
  using (
    exists (
      select 1 from public.pharmacy_promo_reservations r
      where r.id = reservation_id
        and (
          r.patient_id = auth.uid()
          or exists (
            select 1 from public.pharmacy_staff ps
            where ps.pharmacy_id = r.pharmacy_id and ps.user_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "promo_notif_select_own" on public.promo_in_app_notifications;
create policy "promo_notif_select_own"
  on public.promo_in_app_notifications for select to authenticated
  using (recipient_id = auth.uid());

drop policy if exists "promo_notif_update_own" on public.promo_in_app_notifications;
create policy "promo_notif_update_own"
  on public.promo_in_app_notifications for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

grant select on public.pharmacy_promo_offers to anon, authenticated;
grant select on public.pharmacy_promo_offer_lines to anon, authenticated;
grant all on public.pharmacy_promo_offers to authenticated;
grant all on public.pharmacy_promo_offer_lines to authenticated;
grant all on public.pharmacy_promo_reservations to authenticated;
grant select on public.pharmacy_promo_reservation_status_history to authenticated;
grant select, update on public.promo_in_app_notifications to authenticated;

-- ---------------------------------------------------------------------------
-- RPC : réservation patient
-- ---------------------------------------------------------------------------
create or replace function public.patient_submit_promo_reservation(
  p_offer_id uuid,
  p_pickup_date date,
  p_pickup_time time default null,
  p_patient_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_offer public.pharmacy_promo_offers%rowtype;
  v_today date := (timezone('Africa/Casablanca', now()))::date;
  v_max date := v_today + 3;
  v_id uuid;
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  if not exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'patient') then
    raise exception 'Accès patient uniquement.';
  end if;

  select * into v_offer from public.pharmacy_promo_offers where id = p_offer_id;
  if not found then raise exception 'Offre introuvable.'; end if;
  if v_offer.status <> 'published' then raise exception 'Cette offre n''est plus disponible.'; end if;
  if v_today < v_offer.valid_from or v_today > v_offer.valid_until then
    raise exception 'Cette offre n''est pas valable aujourd''hui.';
  end if;
  if p_pickup_date is null or p_pickup_date < v_today or p_pickup_date > v_max then
    raise exception 'Choisissez une date de passage entre aujourd''hui et J+3.';
  end if;

  insert into public.pharmacy_promo_reservations (
    offer_id, pharmacy_id, patient_id, status, pickup_date, pickup_time, patient_note
  )
  values (
    p_offer_id,
    v_offer.pharmacy_id,
    v_uid,
    'submitted',
    p_pickup_date,
    p_pickup_time,
    nullif(btrim(p_patient_note), '')
  )
  returning id into v_id;

  perform public._promo_reservation_log_status(v_id, null, 'submitted');
  return v_id;
end;
$$;

grant execute on function public.patient_submit_promo_reservation(uuid, date, time, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC : transitions pharmacien / patient
-- ---------------------------------------------------------------------------
create or replace function public._promo_reservation_require_pharmacist(p_reservation_id uuid)
returns public.pharmacy_promo_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res public.pharmacy_promo_reservations%rowtype;
begin
  select r.* into v_res from public.pharmacy_promo_reservations r where r.id = p_reservation_id;
  if not found then raise exception 'Réservation introuvable.'; end if;
  if not exists (
    select 1 from public.pharmacy_staff ps
    where ps.pharmacy_id = v_res.pharmacy_id and ps.user_id = auth.uid()
  ) then
    raise exception 'Accès officine uniquement.';
  end if;
  return v_res;
end;
$$;

create or replace function public.pharmacist_confirm_promo_reservation(p_reservation_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_res public.pharmacy_promo_reservations%rowtype;
begin
  v_res := public._promo_reservation_require_pharmacist(p_reservation_id);
  if v_res.status <> 'submitted' then raise exception 'Statut incompatible.'; end if;
  update public.pharmacy_promo_reservations set status = 'confirmed' where id = p_reservation_id;
  perform public._promo_reservation_log_status(p_reservation_id, 'submitted', 'confirmed');
end; $$;

create or replace function public.pharmacist_decline_promo_reservation(p_reservation_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_res public.pharmacy_promo_reservations%rowtype;
begin
  v_res := public._promo_reservation_require_pharmacist(p_reservation_id);
  if v_res.status <> 'submitted' then raise exception 'Statut incompatible.'; end if;
  if btrim(coalesce(p_reason, '')) = '' then raise exception 'Merci d''indiquer un motif.'; end if;
  update public.pharmacy_promo_reservations
  set status = 'unavailable', pharmacist_note = btrim(p_reason)
  where id = p_reservation_id;
  perform public._promo_reservation_log_status(p_reservation_id, 'submitted', 'unavailable', p_reason);
end; $$;

create or replace function public.pharmacist_mark_promo_reservation_collected(p_reservation_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_res public.pharmacy_promo_reservations%rowtype;
begin
  v_res := public._promo_reservation_require_pharmacist(p_reservation_id);
  if v_res.status <> 'confirmed' then raise exception 'Seules les réservations confirmées peuvent être clôturées.'; end if;
  update public.pharmacy_promo_reservations set status = 'collected' where id = p_reservation_id;
  perform public._promo_reservation_log_status(p_reservation_id, 'confirmed', 'collected');
end; $$;

create or replace function public.cancel_promo_reservation(p_reservation_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_res public.pharmacy_promo_reservations%rowtype;
  v_old public.promo_reservation_status_enum;
begin
  select * into v_res from public.pharmacy_promo_reservations where id = p_reservation_id;
  if not found then raise exception 'Réservation introuvable.'; end if;
  if v_res.status in ('collected', 'cancelled') then raise exception 'Cette réservation est déjà terminée.'; end if;
  if auth.uid() = v_res.patient_id then null;
  elsif exists (select 1 from public.pharmacy_staff ps where ps.pharmacy_id = v_res.pharmacy_id and ps.user_id = auth.uid()) then null;
  else raise exception 'Non autorisé.';
  end if;
  v_old := v_res.status;
  update public.pharmacy_promo_reservations set status = 'cancelled' where id = p_reservation_id;
  perform public._promo_reservation_log_status(p_reservation_id, v_old, 'cancelled', p_note);
end; $$;

grant execute on function public.pharmacist_confirm_promo_reservation(uuid) to authenticated;
grant execute on function public.pharmacist_decline_promo_reservation(uuid, text) to authenticated;
grant execute on function public.pharmacist_mark_promo_reservation_collected(uuid) to authenticated;
grant execute on function public.cancel_promo_reservation(uuid, text) to authenticated;
