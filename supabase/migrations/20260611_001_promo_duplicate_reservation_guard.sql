-- Empêcher deux réservations actives (submitted/confirmed) sur la même offre par le même patient.

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
