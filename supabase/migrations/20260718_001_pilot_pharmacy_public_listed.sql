-- Pilote : visibilité annuaire / fiches publiques (public_listed) + accès interne test (pilot_access).

-- ---------------------------------------------------------------------------
-- Colonnes
-- ---------------------------------------------------------------------------
alter table public.pharmacies
  add column if not exists public_listed boolean not null default false;

comment on column public.pharmacies.public_listed is
  'Si true : visible annuaire public et utilisable par les patients sans pilot_access. Défaut false à la création.';

alter table public.profiles
  add column if not exists pilot_access boolean not null default false;

comment on column public.profiles.pilot_access is
  'Si true : patient/admin pilote peut voir et utiliser les pharmacies non listées publiquement.';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_pilot_access_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null then false
    when public.is_admin() then true
    else coalesce((
      select p.pilot_access
      from public.profiles p
      where p.id = auth.uid()
    ), false)
  end;
$$;

comment on function public.is_pilot_access_user() is
  'Admin ou profil avec pilot_access : accès annuaire/fiches/demandes sur pharmacies non public_listed.';

grant execute on function public.is_pilot_access_user() to anon, authenticated;

create or replace function public.can_patient_use_pharmacy(p_pharmacy_id uuid)
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
        ph.public_listed = true
        or public.is_pilot_access_user()
      )
  );
$$;

comment on function public.can_patient_use_pharmacy(uuid) is
  'Patient connecté : pharmacie utilisable si public_listed ou compte pilote (pilot_access / admin).';

grant execute on function public.can_patient_use_pharmacy(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Garde colonnes sensibles (seul admin modifie public_listed / pilot_access)
-- ---------------------------------------------------------------------------
create or replace function public.trg_guard_pharmacies_public_listed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if not public.is_admin() then
      new.public_listed := false;
    end if;
    return new;
  end if;

  if not public.is_admin() and new.public_listed is distinct from old.public_listed then
    new.public_listed := old.public_listed;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_pharmacies_public_listed on public.pharmacies;
create trigger trg_guard_pharmacies_public_listed
  before insert or update on public.pharmacies
  for each row
  execute function public.trg_guard_pharmacies_public_listed();

create or replace function public.trg_guard_profiles_pilot_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if not public.is_admin() then
      new.pilot_access := false;
    end if;
    return new;
  end if;

  if not public.is_admin() and new.pilot_access is distinct from old.pilot_access then
    new.pilot_access := old.pilot_access;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profiles_pilot_access on public.profiles;
create trigger trg_guard_profiles_pilot_access
  before insert or update on public.profiles
  for each row
  execute function public.trg_guard_profiles_pilot_access();

-- ---------------------------------------------------------------------------
-- RLS pharmacies : lecture publique limitée
-- ---------------------------------------------------------------------------
drop policy if exists "pharmacies_public_read" on public.pharmacies;

create policy "pharmacies_public_read"
  on public.pharmacies
  for select
  to anon, authenticated
  using (public_listed = true);

create policy "pharmacies_pilot_access_read"
  on public.pharmacies
  for select
  to authenticated
  using (public.is_pilot_access_user());

-- pharmacies_pharmacien_select_assigned inchangée (staff lit toujours son officine).

-- ---------------------------------------------------------------------------
-- RLS requests : création patient limitée aux pharmacies autorisées
-- ---------------------------------------------------------------------------
drop policy if exists "requests_insert_patient_or_admin" on public.requests;

create policy "requests_insert_patient_or_admin"
  on public.requests
  for insert
  to authenticated
  with check (
    public.is_admin()
    or (
      patient_id = auth.uid()
      and public.can_patient_use_pharmacy(pharmacy_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Promo : offres publiées uniquement pour pharmacies public_listed (sauf pilote)
-- ---------------------------------------------------------------------------
drop policy if exists "promo_offers_public_read_published" on public.pharmacy_promo_offers;

create policy "promo_offers_public_read_published"
  on public.pharmacy_promo_offers for select to anon, authenticated
  using (
    status = 'published'
    and valid_until >= (timezone('Africa/Casablanca', now()))::date
    and (
      public.is_pilot_access_user()
      or exists (
        select 1
        from public.pharmacies ph
        where ph.id = pharmacy_promo_offers.pharmacy_id
          and ph.public_listed = true
      )
    )
  );

-- ---------------------------------------------------------------------------
-- RPC patient : garde pharmacie avant insert
-- ---------------------------------------------------------------------------
create or replace function public.patient_submit_prescription_request(
  p_pharmacy_id uuid,
  p_patient_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_request_id uuid;
  v_note text := nullif(trim(p_patient_note), '');
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.profiles p where p.id = v_uid and p.role = 'patient'
  ) then
    raise exception 'Accès patient uniquement.';
  end if;

  if p_pharmacy_id is null or not public.can_patient_use_pharmacy(p_pharmacy_id) then
    raise exception 'Pharmacie introuvable.';
  end if;

  insert into public.requests (
    patient_id,
    pharmacy_id,
    request_type,
    status,
    submitted_at
  )
  values (
    v_uid,
    p_pharmacy_id,
    'prescription'::public.request_type_enum,
    'submitted'::public.request_status_enum,
    now()
  )
  returning id into v_request_id;

  insert into public.prescription_requests (
    request_id,
    prescription_image_url,
    page_2_path,
    patient_note
  )
  values (
    v_request_id,
    null,
    null,
    v_note
  );

  if v_note is not null and char_length(v_note) between 1 and 2000 then
    insert into public.request_comments (
      request_id,
      author_id,
      author_role,
      comment_text,
      is_internal
    )
    values (
      v_request_id,
      v_uid,
      'patient'::public.comment_author_role_enum,
      v_note,
      false
    );
  end if;

  return v_request_id;
end;
$$;

create or replace function public.patient_submit_free_consultation_request(
  p_pharmacy_id uuid,
  p_consultation_text text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_request_id uuid;
  v_text text := trim(p_consultation_text);
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'patient') then
    raise exception 'Accès patient uniquement.';
  end if;

  if p_pharmacy_id is null or not public.can_patient_use_pharmacy(p_pharmacy_id) then
    raise exception 'Pharmacie introuvable.';
  end if;

  if v_text is null or char_length(v_text) < 10 then
    raise exception 'Décrivez votre besoin en au moins 10 caractères.';
  end if;

  if char_length(v_text) > 1500 then
    raise exception 'Texte trop long (1500 caractères max).';
  end if;

  insert into public.requests (patient_id, pharmacy_id, request_type, status, submitted_at)
  values (
    v_uid,
    p_pharmacy_id,
    'free_consultation'::public.request_type_enum,
    'submitted'::public.request_status_enum,
    now()
  )
  returning id into v_request_id;

  insert into public.free_consultation_requests (request_id, consultation_text)
  values (v_request_id, v_text);

  return v_request_id;
end;
$$;

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
  if not public.can_patient_use_pharmacy(v_offer.pharmacy_id) then
    raise exception 'Offre introuvable.';
  end if;
  if v_today < v_offer.valid_from or v_today > v_offer.valid_until then
    raise exception 'Cette offre n''est pas valable aujourd''hui.';
  end if;
  if p_pickup_date is null or p_pickup_date < v_today or p_pickup_date > v_max then
    raise exception 'Choisissez une date de passage entre aujourd''hui et J+3.';
  end if;

  if exists (
    select 1
    from public.pharmacy_promo_reservations r
    where r.offer_id = p_offer_id
      and r.patient_id = v_uid
      and r.status in ('submitted', 'confirmed')
  ) then
    raise exception 'Vous avez déjà une réservation en cours sur ce pack.';
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

-- ---------------------------------------------------------------------------
-- Données pilote (prod actuelle)
-- ---------------------------------------------------------------------------
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
