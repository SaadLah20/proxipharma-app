-- Mes pharmacies patient : exposer nom_ar pour affichage locale ar.

create or replace function public.patient_pharmacy_directory_enriched()
returns table (
  pharmacy_id uuid,
  nom text,
  nom_ar text,
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
    ph.nom_ar::text,
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

comment on function public.patient_pharmacy_directory_enriched() is
  'Annuaire patient Mes pharmacies : stats demandes/promos + nom_ar pour i18n.';
