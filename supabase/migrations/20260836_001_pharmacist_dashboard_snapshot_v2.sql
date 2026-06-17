-- Tableau de bord pharmacien v2 : operations, garde, messages, avis, responded_pending.

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
  v_today date;
  v_engagement jsonb;
  v_requests jsonb;
  v_promo jsonb;
  v_clients jsonb;
  v_operations jsonb;
  v_schedule jsonb;
  v_messages jsonb;
  v_ratings jsonb;
  v_next_on_call jsonb;
  v_next_override jsonb;
  v_on_call_active_today boolean;
  v_unread_conversations bigint;
  v_rating_avg numeric(3, 2);
  v_rating_count integer;
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
  v_today := (now() at time zone 'Africa/Casablanca')::date;

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
    'responded_pending', coalesce(count(*) filter (
      where r.status = 'responded'
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

  select jsonb_build_object(
    'ordered_pending', coalesce((
      select count(*)::bigint
      from public.request_items ri
      join public.requests r on r.id = ri.request_id
      join public.products p on p.id = ri.product_id
      left join public.request_item_alternatives ria
        on ria.id = ri.patient_chosen_alternative_id and ria.request_item_id = ri.id
      where r.pharmacy_id = v_pharmacy_id
        and r.request_type in (
          'product_request'::public.request_type_enum,
          'prescription'::public.request_type_enum,
          'free_consultation'::public.request_type_enum
        )
        and r.status in (
          'confirmed'::public.request_status_enum,
          'treated'::public.request_status_enum
        )
        and coalesce(ri.is_selected_by_patient, false) = true
        and coalesce(ri.withdrawn_after_confirm, false) = false
        and coalesce(ria.availability_status, ri.availability_status) = 'to_order'::public.availability_status_enum
        and ri.post_confirm_fulfillment in (
          'unset'::public.post_confirm_fulfillment_enum,
          'ordered'::public.post_confirm_fulfillment_enum
        )
    ), 0),
    'shortage_active', coalesce((
      select count(distinct ms.product_id)::bigint
      from public.market_shortages ms
      where ms.pharmacy_id = v_pharmacy_id
        and ms.is_active = true
    ), 0),
    'catalog_published', coalesce((
      select count(*)::bigint
      from public.pharmacy_catalog_products cp
      where cp.pharmacy_id = v_pharmacy_id
        and cp.status = 'active'
    ), 0),
    'catalog_draft', coalesce((
      select count(*)::bigint
      from public.pharmacy_catalog_products cp
      where cp.pharmacy_id = v_pharmacy_id
        and cp.status = 'unpublished'
    ), 0),
    'catalog_reports_open', coalesce((
      select count(*)::bigint
      from public.catalog_product_reports cpr
      where cpr.pharmacy_id = v_pharmacy_id
        and cpr.status in ('open', 'awaiting_pharmacist', 'reopened')
    ), 0),
    'promo_offers_active', coalesce((
      select count(*)::bigint
      from public.pharmacy_promo_offers o
      where o.pharmacy_id = v_pharmacy_id
        and o.status = 'published'
    ), 0),
    'pricing_global_margin_pct', coalesce((
      select s.parapharmacy_margin_pct
      from public.pharmacy_pricing_settings s
      where s.pharmacy_id = v_pharmacy_id
    ), 0),
    'pricing_brand_rules_count', coalesce((
      select count(*)::bigint
      from public.pharmacy_pricing_brand_rules r
      where r.pharmacy_id = v_pharmacy_id
    ), 0)
  )
  into v_operations;

  select exists (
    select 1
    from public.pharmacy_on_call_periods p
    where p.pharmacy_id = v_pharmacy_id
      and p.starts_at <= now()
      and p.ends_at > now()
  )
  into v_on_call_active_today;

  select jsonb_build_object(
    'id', p.id,
    'kind', p.kind,
    'starts_at', p.starts_at,
    'ends_at', p.ends_at,
    'note', p.note
  )
  into v_next_on_call
  from public.pharmacy_on_call_periods p
  where p.pharmacy_id = v_pharmacy_id
    and p.ends_at > now()
  order by p.starts_at asc
  limit 1;

  select jsonb_build_object(
    'date', o.day_date::text,
    'kind', o.override_type,
    'label', o.label
  )
  into v_next_override
  from public.pharmacy_day_overrides o
  where o.pharmacy_id = v_pharmacy_id
    and o.day_date >= v_today
  order by o.day_date asc
  limit 1;

  select jsonb_build_object(
    'next_on_call', v_next_on_call,
    'on_call_active_today', coalesce(v_on_call_active_today, false),
    'next_day_override', v_next_override,
    'weekly_hours_days_configured', coalesce((
      select count(distinct wh.weekday)::integer
      from public.pharmacy_weekly_hours wh
      where wh.pharmacy_id = v_pharmacy_id
    ), 0)
  )
  into v_schedule;

  select count(*)::bigint
  into v_unread_conversations
  from public.requests r
  where r.pharmacy_id = v_pharmacy_id
    and exists (
      select 1
      from public.request_comments c
      where c.request_id = r.id
        and c.is_internal is false
        and c.deleted_at is null
        and c.author_id is distinct from auth.uid()
        and c.created_at > coalesce(
          (
            select rcr.last_read_at
            from public.request_conversation_reads rcr
            where rcr.request_id = r.id
              and rcr.user_id = auth.uid()
            limit 1
          ),
          '-infinity'::timestamptz
        )
    );

  select jsonb_build_object(
    'unread_conversations', coalesce(v_unread_conversations, 0)
  )
  into v_messages;

  select ph.rating_avg, ph.rating_count
  into v_rating_avg, v_rating_count
  from public.pharmacies ph
  where ph.id = v_pharmacy_id;

  select jsonb_build_object(
    'average_score', coalesce(v_rating_avg, 0),
    'total_count', coalesce(v_rating_count, 0)
  )
  into v_ratings;

  return jsonb_build_object(
    'period', jsonb_build_object('since', p_since, 'until', p_until),
    'engagement', v_engagement,
    'requests', v_requests,
    'promo_reservations', v_promo,
    'clients', v_clients,
    'operations', v_operations,
    'schedule', v_schedule,
    'messages', v_messages,
    'ratings', v_ratings
  );
end;
$$;

comment on function public.pharmacist_dashboard_snapshot(timestamptz, timestamptz) is
  'KPIs tableau de bord pharmacien v2 : engagement, demandes, promos, clients, operations, garde, messages, avis.';
