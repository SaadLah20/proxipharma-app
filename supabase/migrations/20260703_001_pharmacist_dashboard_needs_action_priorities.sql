-- KPI « À traiter » : envoyées + validées (pas les répondues en attente patient).

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
      where r.status in ('submitted', 'in_review', 'confirmed')
    ), 0),
    'awaiting_pickup', coalesce(count(*) filter (
      where r.status = 'treated'
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

comment on function public.pharmacist_dashboard_snapshot(timestamptz, timestamptz) is
  'KPIs tableau de bord pharmacien. needs_action = envoyées + validées client (pas répondues en attente patient).';
