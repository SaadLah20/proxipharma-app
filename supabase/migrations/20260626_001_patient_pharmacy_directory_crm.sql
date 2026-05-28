-- Annuaire « Mes pharmacies » côté patient (miroir CRM pharmacien / clients).

create or replace function public.patient_pharmacy_directory_enriched()
returns table (
  pharmacy_id uuid,
  nom text,
  ville text,
  adresse text,
  telephone text,
  whatsapp text,
  pharmacy_public_ref text,
  rating_avg numeric,
  rating_count integer,
  request_count bigint,
  active_request_count bigint,
  promo_reservation_count bigint,
  last_activity_at timestamptz,
  last_request_status text,
  request_kinds text[]
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select auth.uid() as patient_id
    where auth.uid() is not null
      and exists (
        select 1 from public.profiles p where p.id = auth.uid() and p.role = 'patient'
      )
  ),
  req_stats as (
    select
      r.pharmacy_id,
      count(*)::bigint as request_count,
      count(*) filter (
        where r.status in ('submitted', 'in_review', 'responded', 'confirmed', 'treated')
      )::bigint as active_request_count,
      max(greatest(r.updated_at, r.created_at)) as last_request_at,
      (array_agg(r.status::text order by r.updated_at desc nulls last))[1] as last_request_status,
      array_agg(distinct r.request_type::text) as request_kinds
    from public.requests r
    cross join me
    where r.patient_id = me.patient_id
      and r.status <> 'draft'
    group by r.pharmacy_id
  ),
  promo_stats as (
    select
      pr.pharmacy_id,
      count(*)::bigint as promo_reservation_count,
      max(pr.updated_at) as last_promo_at
    from public.pharmacy_promo_reservations pr
    cross join me
    where pr.patient_id = me.patient_id
    group by pr.pharmacy_id
  ),
  pharmacy_ids as (
    select pharmacy_id from req_stats
    union
    select pharmacy_id from promo_stats
  )
  select
    ph.id as pharmacy_id,
    ph.nom::text,
    ph.ville::text,
    ph.adresse::text,
    ph.telephone::text,
    ph.whatsapp::text,
    ph.public_ref::text as pharmacy_public_ref,
    ph.rating_avg,
    ph.rating_count,
    coalesce(rs.request_count, 0),
    coalesce(rs.active_request_count, 0),
    coalesce(ps.promo_reservation_count, 0),
    greatest(rs.last_request_at, ps.last_promo_at) as last_activity_at,
    rs.last_request_status,
    coalesce(rs.request_kinds, array[]::text[])
  from pharmacy_ids pid
  join public.pharmacies ph on ph.id = pid.pharmacy_id
  left join req_stats rs on rs.pharmacy_id = ph.id
  left join promo_stats ps on ps.pharmacy_id = ph.id
  order by last_activity_at desc nulls last, nom asc nulls last;
$$;

revoke all on function public.patient_pharmacy_directory_enriched() from public;
grant execute on function public.patient_pharmacy_directory_enriched() to authenticated;

comment on function public.patient_pharmacy_directory_enriched() is
  'Pharmacies liées au patient connecté (demandes ou réservations promo), avec stats agrégées.';

create or replace function public.patient_pharmacy_detail(p_pharmacy_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_patient_id uuid;
  v_pharmacy jsonb;
  v_requests jsonb;
  v_promos jsonb;
begin
  if auth.uid() is null or p_pharmacy_id is null then
    return null;
  end if;

  select p.id
  into v_patient_id
  from public.profiles p
  where p.id = auth.uid() and p.role = 'patient';

  if v_patient_id is null then
    return null;
  end if;

  if not exists (
    select 1
    from public.requests r
    where r.pharmacy_id = p_pharmacy_id
      and r.patient_id = v_patient_id
      and r.status <> 'draft'
    union all
    select 1
    from public.pharmacy_promo_reservations pr
    where pr.pharmacy_id = p_pharmacy_id
      and pr.patient_id = v_patient_id
  ) then
    return null;
  end if;

  select jsonb_build_object(
    'pharmacy_id', ph.id,
    'nom', ph.nom,
    'ville', ph.ville,
    'adresse', ph.adresse,
    'telephone', ph.telephone,
    'whatsapp', ph.whatsapp,
    'pharmacy_public_ref', ph.public_ref,
    'rating_avg', ph.rating_avg,
    'rating_count', ph.rating_count
  )
  into v_pharmacy
  from public.pharmacies ph
  where ph.id = p_pharmacy_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'request_type', r.request_type::text,
        'status', r.status::text,
        'request_public_ref', r.request_public_ref,
        'created_at', r.created_at,
        'updated_at', r.updated_at,
        'submitted_at', r.submitted_at,
        'responded_at', r.responded_at
      )
      order by r.updated_at desc nulls last
    ),
    '[]'::jsonb
  )
  into v_requests
  from public.requests r
  where r.pharmacy_id = p_pharmacy_id
    and r.patient_id = v_patient_id
    and r.status <> 'draft';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', pr.id,
        'status', pr.status::text,
        'public_ref', pr.public_ref,
        'pickup_date', pr.pickup_date,
        'created_at', pr.created_at,
        'updated_at', pr.updated_at,
        'offer_title', o.title
      )
      order by pr.updated_at desc nulls last
    ),
    '[]'::jsonb
  )
  into v_promos
  from public.pharmacy_promo_reservations pr
  left join public.pharmacy_promo_offers o on o.id = pr.offer_id
  where pr.pharmacy_id = p_pharmacy_id
    and pr.patient_id = v_patient_id;

  return jsonb_build_object(
    'pharmacy', v_pharmacy,
    'requests', v_requests,
    'promo_reservations', v_promos
  );
end;
$$;

revoke all on function public.patient_pharmacy_detail(uuid) from public;
grant execute on function public.patient_pharmacy_detail(uuid) to authenticated;

comment on function public.patient_pharmacy_detail(uuid) is
  'Fiche officine + historique demandes / promos pour le patient connecté.';
