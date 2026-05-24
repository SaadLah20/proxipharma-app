-- Fix : le CTE "journal" n'était défini que sur le SELECT count ; le SELECT paginé le référençait hors scope.

create or replace function public.pharmacist_profile_analytics(
  p_since timestamptz,
  p_until timestamptz default now(),
  p_patient_id uuid default null,
  p_event_type text default null,
  p_source text default null,
  p_limit int default 120,
  p_offset int default 0
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
  v_summary jsonb;
  v_patients jsonb;
  v_events jsonb;
  v_events_total bigint;
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
  p_limit := least(greatest(coalesce(p_limit, 120), 1), 300);
  p_offset := greatest(coalesce(p_offset, 0), 0);

  select jsonb_build_object(
    'profile_views', coalesce(count(*) filter (where e.event_type = 'profile_view'), 0),
    'phone_clicks', coalesce(count(*) filter (where e.event_type = 'phone_click'), 0),
    'whatsapp_clicks', coalesce(count(*) filter (where e.event_type = 'whatsapp_click'), 0),
    'identified_events', coalesce(count(*) filter (where e.patient_id is not null), 0),
    'anonymous_events', coalesce(count(*) filter (where e.patient_id is null), 0),
    'by_source', coalesce(
      (
        select jsonb_object_agg(x.source, x.cnt)
        from (
          select e2.source, count(*)::bigint as cnt
          from public.pharmacy_engagement_events e2
          where e2.pharmacy_id = v_pharmacy_id
            and e2.created_at >= p_since
            and e2.created_at < p_until
            and (p_patient_id is null or e2.patient_id = p_patient_id)
          group by e2.source
        ) x
      ),
      '{}'::jsonb
    ),
    'daily', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'day', d.day::text,
            'profile_views', coalesce(ev.profile_views, 0),
            'phone_clicks', coalesce(ev.phone_clicks, 0),
            'whatsapp_clicks', coalesce(ev.whatsapp_clicks, 0),
            'contact_clicks', coalesce(ev.phone_clicks, 0) + coalesce(ev.whatsapp_clicks, 0),
            'identified', coalesce(ev.identified, 0),
            'anonymous', coalesce(ev.anonymous, 0)
          )
          order by d.day
        )
        from generate_series(v_since, v_until, interval '1 day') as d(day)
        left join lateral (
          select
            count(*) filter (where e2.event_type = 'profile_view') as profile_views,
            count(*) filter (where e2.event_type = 'phone_click') as phone_clicks,
            count(*) filter (where e2.event_type = 'whatsapp_click') as whatsapp_clicks,
            count(*) filter (where e2.patient_id is not null) as identified,
            count(*) filter (where e2.patient_id is null) as anonymous
          from public.pharmacy_engagement_events e2
          where e2.pharmacy_id = v_pharmacy_id
            and (e2.created_at at time zone 'Africa/Casablanca')::date = d.day
            and (p_patient_id is null or e2.patient_id = p_patient_id)
        ) ev on true
      ),
      '[]'::jsonb
    ),
    'requests_created', (
      select count(*)::bigint
      from public.requests r
      where r.pharmacy_id = v_pharmacy_id
        and r.created_at >= p_since
        and r.created_at < p_until
        and r.status <> 'draft'
        and (p_patient_id is null or r.patient_id = p_patient_id)
    ),
    'promo_reservations_created', (
      select count(*)::bigint
      from public.pharmacy_promo_reservations pr
      where pr.pharmacy_id = v_pharmacy_id
        and pr.created_at >= p_since
        and pr.created_at < p_until
        and (p_patient_id is null or pr.patient_id = p_patient_id)
    )
  )
  into v_summary
  from public.pharmacy_engagement_events e
  where e.pharmacy_id = v_pharmacy_id
    and e.created_at >= p_since
    and e.created_at < p_until
    and (p_patient_id is null or e.patient_id = p_patient_id)
    and (p_event_type is null or e.event_type = p_event_type)
    and (p_source is null or e.source = p_source);

  with touch_ids as (
    select distinct pid as patient_id
    from (
      select e.patient_id as pid
      from public.pharmacy_engagement_events e
      where e.pharmacy_id = v_pharmacy_id
        and e.patient_id is not null
        and e.created_at >= p_since
        and e.created_at < p_until
      union
      select r.patient_id
      from public.requests r
      where r.pharmacy_id = v_pharmacy_id
        and r.patient_id is not null
        and r.created_at >= p_since
        and r.created_at < p_until
        and r.status <> 'draft'
      union
      select pr.patient_id
      from public.pharmacy_promo_reservations pr
      where pr.pharmacy_id = v_pharmacy_id
        and pr.created_at >= p_since
        and pr.created_at < p_until
    ) u
    where pid is not null
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'patient_id', p.id,
        'full_name', p.full_name,
        'patient_ref', p.patient_ref,
        'profile_views', coalesce(ev.profile_views, 0),
        'phone_clicks', coalesce(ev.phone_clicks, 0),
        'whatsapp_clicks', coalesce(ev.whatsapp_clicks, 0),
        'requests_in_period', coalesce(rq.cnt, 0),
        'promo_in_period', coalesce(pr.cnt, 0),
        'last_touch_at', greatest(ev.last_at, rq.last_at, pr.last_at)
      )
      order by greatest(ev.last_at, rq.last_at, pr.last_at) desc nulls last
    ),
    '[]'::jsonb
  )
  into v_patients
  from touch_ids t
  join public.profiles p on p.id = t.patient_id
  left join lateral (
    select
      count(*) filter (where e.event_type = 'profile_view') as profile_views,
      count(*) filter (where e.event_type = 'phone_click') as phone_clicks,
      count(*) filter (where e.event_type = 'whatsapp_click') as whatsapp_clicks,
      max(e.created_at) as last_at
    from public.pharmacy_engagement_events e
    where e.pharmacy_id = v_pharmacy_id
      and e.patient_id = t.patient_id
      and e.created_at >= p_since
      and e.created_at < p_until
  ) ev on true
  left join lateral (
    select count(*)::bigint as cnt, max(r.created_at) as last_at
    from public.requests r
    where r.pharmacy_id = v_pharmacy_id
      and r.patient_id = t.patient_id
      and r.created_at >= p_since
      and r.created_at < p_until
      and r.status <> 'draft'
  ) rq on true
  left join lateral (
    select count(*)::bigint as cnt, max(pr.created_at) as last_at
    from public.pharmacy_promo_reservations pr
    where pr.pharmacy_id = v_pharmacy_id
      and pr.patient_id = t.patient_id
      and pr.created_at >= p_since
      and pr.created_at < p_until
  ) pr on true;

  with journal as (
    select
      e.id::text as row_id,
      e.created_at,
      'engagement'::text as row_kind,
      e.event_type as detail_type,
      e.source as detail_source,
      e.patient_id,
      p.full_name::text,
      p.patient_ref::text,
      null::text as public_ref
    from public.pharmacy_engagement_events e
    left join public.profiles p on p.id = e.patient_id
    where e.pharmacy_id = v_pharmacy_id
      and e.created_at >= p_since
      and e.created_at < p_until
      and (p_patient_id is null or e.patient_id = p_patient_id)
      and (p_event_type is null or e.event_type = p_event_type)
      and (p_source is null or e.source = p_source)

    union all

    select
      r.id::text,
      coalesce(r.submitted_at, r.created_at),
      'request'::text,
      r.request_type::text,
      r.status::text,
      r.patient_id,
      p.full_name::text,
      p.patient_ref::text,
      r.request_public_ref::text
    from public.requests r
    left join public.profiles p on p.id = r.patient_id
    where r.pharmacy_id = v_pharmacy_id
      and coalesce(r.submitted_at, r.created_at) >= p_since
      and coalesce(r.submitted_at, r.created_at) < p_until
      and r.status <> 'draft'
      and (p_patient_id is null or r.patient_id = p_patient_id)
      and (p_event_type is null)
      and (p_source is null)

    union all

    select
      pr.id::text,
      pr.created_at,
      'promo'::text,
      'promo_reservation'::text,
      pr.status::text,
      pr.patient_id,
      p.full_name::text,
      p.patient_ref::text,
      pr.public_ref::text
    from public.pharmacy_promo_reservations pr
    left join public.profiles p on p.id = pr.patient_id
    where pr.pharmacy_id = v_pharmacy_id
      and pr.created_at >= p_since
      and pr.created_at < p_until
      and (p_patient_id is null or pr.patient_id = p_patient_id)
      and (p_event_type is null)
      and (p_source is null)
  )
  select
    (select count(*)::bigint from journal),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'row_id', j.row_id,
            'created_at', j.created_at,
            'row_kind', j.row_kind,
            'detail_type', j.detail_type,
            'detail_source', j.detail_source,
            'patient_id', j.patient_id,
            'full_name', j.full_name,
            'patient_ref', j.patient_ref,
            'public_ref', j.public_ref
          )
          order by j.created_at desc
        )
        from (
          select *
          from journal
          order by created_at desc
          limit p_limit
          offset p_offset
        ) j
      ),
      '[]'::jsonb
    )
  into v_events_total, v_events;

  return jsonb_build_object(
    'period', jsonb_build_object('since', p_since, 'until', p_until),
    'summary', v_summary,
    'patients', v_patients,
    'events', v_events,
    'events_total', v_events_total
  );
end;
$$;
