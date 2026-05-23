-- Tableau de bord pharmacien (agrégats période) + annuaire client enrichi + timeline patient.

-- ---------------------------------------------------------------------------
-- Snapshot KPIs + séries journalières (fuseau Africa/Casablanca)
-- ---------------------------------------------------------------------------
create or replace function public.pharmacist_dashboard_snapshot(
  p_since timestamptz,
  p_until timestamptz default now()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pharmacy_id uuid;
  v_since date;
  v_until date;
  v_engagement jsonb;
  v_requests jsonb;
  v_promo jsonb;
  v_clients jsonb;
begin
  if auth.uid() is null then
    return null;
  end if;

  select ps.pharmacy_id
  into v_pharmacy_id
  from public.pharmacy_staff ps
  join public.profiles me on me.id = auth.uid() and me.role = 'pharmacien'
  where ps.user_id = auth.uid()
  limit 1;

  if v_pharmacy_id is null then
    return null;
  end if;

  v_since := (p_since at time zone 'Africa/Casablanca')::date;
  v_until := (p_until at time zone 'Africa/Casablanca')::date;

  select jsonb_build_object(
    'profile_views', coalesce(count(*) filter (where e.event_type = 'profile_view'), 0),
    'phone_clicks', coalesce(count(*) filter (where e.event_type = 'phone_click'), 0),
    'whatsapp_clicks', coalesce(count(*) filter (where e.event_type = 'whatsapp_click'), 0),
    'daily', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'day', d.day::text,
            'profile_views', coalesce(ev.profile_views, 0),
            'phone_clicks', coalesce(ev.phone_clicks, 0),
            'whatsapp_clicks', coalesce(ev.whatsapp_clicks, 0),
            'contact_clicks', coalesce(ev.phone_clicks, 0) + coalesce(ev.whatsapp_clicks, 0)
          )
          order by d.day
        )
        from generate_series(v_since, v_until, interval '1 day') as d(day)
        left join lateral (
          select
            count(*) filter (where e2.event_type = 'profile_view') as profile_views,
            count(*) filter (where e2.event_type = 'phone_click') as phone_clicks,
            count(*) filter (where e2.event_type = 'whatsapp_click') as whatsapp_clicks
          from public.pharmacy_engagement_events e2
          where e2.pharmacy_id = v_pharmacy_id
            and (e2.created_at at time zone 'Africa/Casablanca')::date = d.day
        ) ev on true
      ),
      '[]'::jsonb
    )
  )
  into v_engagement
  from public.pharmacy_engagement_events e
  where e.pharmacy_id = v_pharmacy_id
    and e.created_at >= p_since
    and e.created_at < p_until;

  select jsonb_build_object(
    'active_total', coalesce(count(*) filter (
      where r.status in ('submitted', 'in_review', 'responded', 'confirmed', 'treated')
    ), 0),
    'needs_action', coalesce(count(*) filter (
      where r.status in ('submitted', 'in_review', 'responded')
    ), 0),
    'awaiting_pickup', coalesce(count(*) filter (
      where r.status in ('confirmed', 'treated')
    ), 0),
    'new_in_period', coalesce(count(*) filter (
      where r.created_at >= p_since and r.created_at < p_until
    ), 0),
    'by_type', coalesce(
      (
        select jsonb_object_agg(x.request_type::text, x.cnt)
        from (
          select r2.request_type, count(*)::bigint as cnt
          from public.requests r2
          where r2.pharmacy_id = v_pharmacy_id
            and r2.created_at >= p_since
            and r2.created_at < p_until
            and r2.status <> 'draft'
          group by r2.request_type
        ) x
      ),
      '{}'::jsonb
    ),
    'by_status', coalesce(
      (
        select jsonb_object_agg(x.status::text, x.cnt)
        from (
          select r2.status, count(*)::bigint as cnt
          from public.requests r2
          where r2.pharmacy_id = v_pharmacy_id
            and r2.status <> 'draft'
          group by r2.status
        ) x
      ),
      '{}'::jsonb
    ),
    'daily', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'day', d.day::text,
            'total', coalesce(rq.total, 0),
            'product_request', coalesce(rq.product_request, 0),
            'prescription', coalesce(rq.prescription, 0),
            'free_consultation', coalesce(rq.free_consultation, 0)
          )
          order by d.day
        )
        from generate_series(v_since, v_until, interval '1 day') as d(day)
        left join lateral (
          select
            count(*) as total,
            count(*) filter (where r2.request_type = 'product_request') as product_request,
            count(*) filter (where r2.request_type = 'prescription') as prescription,
            count(*) filter (where r2.request_type = 'free_consultation') as free_consultation
          from public.requests r2
          where r2.pharmacy_id = v_pharmacy_id
            and r2.status <> 'draft'
            and (r2.created_at at time zone 'Africa/Casablanca')::date = d.day
        ) rq on true
      ),
      '[]'::jsonb
    )
  )
  into v_requests
  from public.requests r
  where r.pharmacy_id = v_pharmacy_id;

  select jsonb_build_object(
    'pending', coalesce(count(*) filter (where pr.status = 'submitted'), 0),
    'confirmed_in_period', coalesce(count(*) filter (
      where pr.status = 'confirmed'
        and pr.updated_at >= p_since
        and pr.updated_at < p_until
    ), 0),
    'new_in_period', coalesce(count(*) filter (
      where pr.created_at >= p_since and pr.created_at < p_until
    ), 0)
  )
  into v_promo
  from public.pharmacy_promo_reservations pr
  where pr.pharmacy_id = v_pharmacy_id;

  select jsonb_build_object(
    'distinct_total', coalesce(count(distinct r.patient_id), 0),
    'new_in_period', coalesce(count(distinct r.patient_id) filter (
      where r.created_at >= p_since and r.created_at < p_until
    ), 0)
  )
  into v_clients
  from public.requests r
  where r.pharmacy_id = v_pharmacy_id
    and r.patient_id is not null;

  return jsonb_build_object(
    'period', jsonb_build_object('since', p_since, 'until', p_until),
    'engagement', v_engagement,
    'requests', v_requests,
    'promo_reservations', v_promo,
    'clients', v_clients
  );
end;
$$;

revoke all on function public.pharmacist_dashboard_snapshot(timestamptz, timestamptz) from public;
grant execute on function public.pharmacist_dashboard_snapshot(timestamptz, timestamptz) to authenticated;

comment on function public.pharmacist_dashboard_snapshot(timestamptz, timestamptz) is
  'KPIs et séries journalières pour le tableau de bord pharmacien (engagement, demandes, promos, clients).';

-- ---------------------------------------------------------------------------
-- Annuaire client enrichi (stats par patient)
-- ---------------------------------------------------------------------------
create or replace function public.pharmacist_patient_directory_enriched_for_my_pharmacy()
returns table (
  patient_id uuid,
  full_name text,
  whatsapp text,
  email text,
  patient_ref text,
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
  with my_pharmacy as (
    select ps.pharmacy_id
    from public.pharmacy_staff ps
    join public.profiles me on me.id = auth.uid() and me.role = 'pharmacien'
    where ps.user_id = auth.uid()
    limit 1
  ),
  req_stats as (
    select
      r.patient_id,
      count(*)::bigint as request_count,
      count(*) filter (
        where r.status in ('submitted', 'in_review', 'responded', 'confirmed', 'treated')
      )::bigint as active_request_count,
      max(greatest(r.updated_at, r.created_at)) as last_request_at,
      (array_agg(r.status::text order by r.updated_at desc nulls last))[1] as last_request_status,
      array_agg(distinct r.request_type::text) as request_kinds
    from public.requests r
    cross join my_pharmacy mp
    where r.pharmacy_id = mp.pharmacy_id
      and r.patient_id is not null
    group by r.patient_id
  ),
  promo_stats as (
    select
      pr.patient_id,
      count(*)::bigint as promo_reservation_count,
      max(pr.updated_at) as last_promo_at
    from public.pharmacy_promo_reservations pr
    cross join my_pharmacy mp
    where pr.pharmacy_id = mp.pharmacy_id
    group by pr.patient_id
  )
  select
    p.id as patient_id,
    p.full_name::text,
    p.whatsapp::text,
    p.email::text,
    p.patient_ref::text,
    coalesce(rs.request_count, 0),
    coalesce(rs.active_request_count, 0),
    coalesce(ps.promo_reservation_count, 0),
    greatest(rs.last_request_at, ps.last_promo_at) as last_activity_at,
    rs.last_request_status,
    coalesce(rs.request_kinds, array[]::text[])
  from req_stats rs
  join public.profiles p on p.id = rs.patient_id
  left join promo_stats ps on ps.patient_id = p.id

  union all

  select
    p.id,
    p.full_name::text,
    p.whatsapp::text,
    p.email::text,
    p.patient_ref::text,
    0::bigint,
    0::bigint,
    coalesce(ps.promo_reservation_count, 0),
    ps.last_promo_at,
    null::text,
    array[]::text[]
  from promo_stats ps
  join public.profiles p on p.id = ps.patient_id
  where not exists (select 1 from req_stats rs where rs.patient_id = ps.patient_id)

  order by last_activity_at desc nulls last, full_name asc nulls last;
$$;

revoke all on function public.pharmacist_patient_directory_enriched_for_my_pharmacy() from public;
grant execute on function public.pharmacist_patient_directory_enriched_for_my_pharmacy() to authenticated;

-- ---------------------------------------------------------------------------
-- Fiche patient : contact + historique demandes / promos
-- ---------------------------------------------------------------------------
create or replace function public.pharmacist_patient_detail(p_patient_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pharmacy_id uuid;
  v_contact jsonb;
  v_requests jsonb;
  v_promos jsonb;
begin
  if auth.uid() is null or p_patient_id is null then
    return null;
  end if;

  select ps.pharmacy_id
  into v_pharmacy_id
  from public.pharmacy_staff ps
  join public.profiles me on me.id = auth.uid() and me.role = 'pharmacien'
  where ps.user_id = auth.uid()
  limit 1;

  if v_pharmacy_id is null then
    return null;
  end if;

  if not exists (
    select 1
    from public.requests r
    where r.pharmacy_id = v_pharmacy_id
      and r.patient_id = p_patient_id
    union all
    select 1
    from public.pharmacy_promo_reservations pr
    where pr.pharmacy_id = v_pharmacy_id
      and pr.patient_id = p_patient_id
  ) then
    return null;
  end if;

  select jsonb_build_object(
    'patient_id', p.id,
    'full_name', p.full_name,
    'whatsapp', p.whatsapp,
    'email', p.email,
    'patient_ref', p.patient_ref
  )
  into v_contact
  from public.profiles p
  where p.id = p_patient_id;

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
  where r.pharmacy_id = v_pharmacy_id
    and r.patient_id = p_patient_id
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
  where pr.pharmacy_id = v_pharmacy_id
    and pr.patient_id = p_patient_id;

  return jsonb_build_object(
    'contact', v_contact,
    'requests', v_requests,
    'promo_reservations', v_promos
  );
end;
$$;

revoke all on function public.pharmacist_patient_detail(uuid) from public;
grant execute on function public.pharmacist_patient_detail(uuid) to authenticated;

comment on function public.pharmacist_patient_detail(uuid) is
  'Contact et historique demandes / réservations promo pour un patient de l’officine du pharmacien connecté.';
