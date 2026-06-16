-- Hub « Notes officine » : agrégation des notes patient / officine (lignes, dossiers, promos).

create or replace function public.pharmacist_officine_notes_feed(
  p_limit integer default 300,
  p_offset integer default 0
)
returns table (
  note_key text,
  note_kind text,
  note_body text,
  noted_at timestamptz,
  patient_id uuid,
  patient_display_name text,
  patient_ref text,
  request_id uuid,
  request_public_ref text,
  request_type text,
  request_status text,
  context_label text,
  source_id uuid,
  promo_reservation_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pharmacy uuid;
  v_limit integer := greatest(1, least(coalesce(p_limit, 300), 500));
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select ps.pharmacy_id
  into v_pharmacy
  from public.pharmacy_staff ps
  join public.profiles p on p.id = ps.user_id
  where ps.user_id = v_uid
    and p.role = 'pharmacien'
  limit 1;

  if v_pharmacy is null then
    raise exception 'Accès pharmacien requis';
  end if;

  return query
  with base as (
    -- Note officine sur ligne produit
    select
      ('line_ph:' || ri.id::text)::text as note_key,
      'pharmacy_line'::text as note_kind,
      btrim(ri.pharmacist_comment)::text as note_body,
      ri.updated_at as noted_at,
      r.patient_id,
      coalesce(nullif(btrim(pat.full_name), ''), 'Patient')::text as patient_display_name,
      coalesce(pat.patient_ref, '')::text as patient_ref,
      r.id as request_id,
      coalesce(r.request_public_ref, '')::text as request_public_ref,
      r.request_type::text as request_type,
      r.status::text as request_status,
      coalesce(
        nullif(btrim(prd.name), ''),
        nullif(btrim(cp.name), ''),
        nullif(btrim(ri.patient_requested_label), ''),
        'Ligne demande'
      )::text as context_label,
      ri.id as source_id,
      null::uuid as promo_reservation_id
    from public.request_items ri
    join public.requests r on r.id = ri.request_id
    left join public.profiles pat on pat.id = r.patient_id
    left join public.products prd on prd.id = ri.product_id
    left join public.pharmacy_catalog_products cp on cp.id = ri.pharmacy_product_id
    where r.pharmacy_id = v_pharmacy
      and r.status <> 'draft'::public.request_status_enum
      and nullif(btrim(ri.pharmacist_comment), '') is not null

    union all

    -- Note patient sur ligne produit
    select
      ('line_pt:' || ri.id::text)::text,
      'patient_line'::text,
      btrim(ri.client_comment)::text,
      ri.updated_at,
      r.patient_id,
      coalesce(nullif(btrim(pat.full_name), ''), 'Patient')::text,
      coalesce(pat.patient_ref, '')::text,
      r.id,
      coalesce(r.request_public_ref, '')::text,
      r.request_type::text,
      r.status::text,
      coalesce(
        nullif(btrim(prd.name), ''),
        nullif(btrim(cp.name), ''),
        nullif(btrim(ri.patient_requested_label), ''),
        'Ligne demande'
      )::text,
      ri.id,
      null::uuid
    from public.request_items ri
    join public.requests r on r.id = ri.request_id
    left join public.profiles pat on pat.id = r.patient_id
    left join public.products prd on prd.id = ri.product_id
    left join public.pharmacy_catalog_products cp on cp.id = ri.pharmacy_product_id
    where r.pharmacy_id = v_pharmacy
      and r.status <> 'draft'::public.request_status_enum
      and nullif(btrim(ri.client_comment), '') is not null

    union all

    -- Note officine sur alternative
    select
      ('alt_ph:' || ria.id::text)::text,
      'pharmacy_alternative'::text,
      btrim(ria.pharmacist_comment)::text,
      ria.created_at,
      r.patient_id,
      coalesce(nullif(btrim(pat.full_name), ''), 'Patient')::text,
      coalesce(pat.patient_ref, '')::text,
      r.id,
      coalesce(r.request_public_ref, '')::text,
      r.request_type::text,
      r.status::text,
      (
        coalesce(nullif(btrim(alt_p.name), ''), 'Alternative')
        || ' (alt. ' || ria.rank::text || ')'
      )::text,
      ria.id,
      null::uuid
    from public.request_item_alternatives ria
    join public.request_items ri on ri.id = ria.request_item_id
    join public.requests r on r.id = ri.request_id
    left join public.profiles pat on pat.id = r.patient_id
    left join public.products alt_p on alt_p.id = ria.product_id
    where r.pharmacy_id = v_pharmacy
      and r.status <> 'draft'::public.request_status_enum
      and nullif(btrim(ria.pharmacist_comment), '') is not null

    union all

    -- Note globale patient — demande produits
    select
      ('dossier_pr:' || r.id::text)::text,
      'dossier_patient_product'::text,
      btrim(pr.patient_note)::text,
      coalesce(r.submitted_at, r.created_at),
      r.patient_id,
      coalesce(nullif(btrim(pat.full_name), ''), 'Patient')::text,
      coalesce(pat.patient_ref, '')::text,
      r.id,
      coalesce(r.request_public_ref, '')::text,
      r.request_type::text,
      r.status::text,
      'Message à l''envoi'::text,
      r.id,
      null::uuid
    from public.requests r
    join public.product_requests pr on pr.request_id = r.id
    left join public.profiles pat on pat.id = r.patient_id
    where r.pharmacy_id = v_pharmacy
      and r.request_type = 'product_request'::public.request_type_enum
      and r.status <> 'draft'::public.request_status_enum
      and nullif(btrim(pr.patient_note), '') is not null

    union all

    -- Note globale patient — ordonnance
    select
      ('dossier_rx:' || r.id::text)::text,
      'dossier_patient_prescription'::text,
      btrim(prx.patient_note)::text,
      coalesce(r.submitted_at, r.created_at),
      r.patient_id,
      coalesce(nullif(btrim(pat.full_name), ''), 'Patient')::text,
      coalesce(pat.patient_ref, '')::text,
      r.id,
      coalesce(r.request_public_ref, '')::text,
      r.request_type::text,
      r.status::text,
      'Message à l''envoi'::text,
      r.id,
      null::uuid
    from public.requests r
    join public.prescription_requests prx on prx.request_id = r.id
    left join public.profiles pat on pat.id = r.patient_id
    where r.pharmacy_id = v_pharmacy
      and r.request_type = 'prescription'::public.request_type_enum
      and r.status <> 'draft'::public.request_status_enum
      and nullif(btrim(prx.patient_note), '') is not null

    union all

    -- Note patient — réservation promo
    select
      ('promo_pt:' || res.id::text)::text,
      'promo_patient'::text,
      btrim(res.patient_note)::text,
      res.created_at,
      res.patient_id,
      coalesce(nullif(btrim(pat.full_name), ''), 'Patient')::text,
      coalesce(pat.patient_ref, '')::text,
      null::uuid,
      coalesce(res.public_ref, '')::text,
      'promo_reservation'::text,
      res.status::text,
      coalesce(nullif(btrim(off.title), ''), 'Réservation pack promo')::text,
      res.id,
      res.id
    from public.pharmacy_promo_reservations res
    left join public.profiles pat on pat.id = res.patient_id
    left join public.pharmacy_promo_offers off on off.id = res.offer_id
    where res.pharmacy_id = v_pharmacy
      and nullif(btrim(res.patient_note), '') is not null

    union all

    -- Note officine — réservation promo
    select
      ('promo_ph:' || res.id::text)::text,
      'promo_pharmacy'::text,
      btrim(res.pharmacist_note)::text,
      res.updated_at,
      res.patient_id,
      coalesce(nullif(btrim(pat.full_name), ''), 'Patient')::text,
      coalesce(pat.patient_ref, '')::text,
      null::uuid,
      coalesce(res.public_ref, '')::text,
      'promo_reservation'::text,
      res.status::text,
      coalesce(nullif(btrim(off.title), ''), 'Réservation pack promo')::text,
      res.id,
      res.id
    from public.pharmacy_promo_reservations res
    left join public.profiles pat on pat.id = res.patient_id
    left join public.pharmacy_promo_offers off on off.id = res.offer_id
    where res.pharmacy_id = v_pharmacy
      and nullif(btrim(res.pharmacist_note), '') is not null
  )
  select *
  from base
  order by noted_at desc
  limit v_limit
  offset v_offset;
end;
$$;

create or replace function public.pharmacist_officine_notes_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pharmacy uuid;
  v_cutoff_7 timestamptz := now() - interval '7 days';
  v_cutoff_30 timestamptz := now() - interval '30 days';
  v_total bigint := 0;
  v_pharmacy_notes bigint := 0;
  v_patient_notes bigint := 0;
  v_distinct_patients bigint := 0;
  v_last_7 bigint := 0;
  v_last_30 bigint := 0;
  v_by_kind jsonb := '{}'::jsonb;
begin
  if v_uid is null then
    return null;
  end if;

  select ps.pharmacy_id
  into v_pharmacy
  from public.pharmacy_staff ps
  join public.profiles p on p.id = ps.user_id
  where ps.user_id = v_uid
    and p.role = 'pharmacien'
  limit 1;

  if v_pharmacy is null then
    return null;
  end if;

  with feed as (
    select * from public.pharmacist_officine_notes_feed(5000, 0)
  )
  select
    count(*)::bigint,
    count(*) filter (where note_kind in ('pharmacy_line', 'pharmacy_alternative', 'promo_pharmacy'))::bigint,
    count(*) filter (where note_kind in ('patient_line', 'dossier_patient_product', 'dossier_patient_prescription', 'promo_patient'))::bigint,
    count(distinct patient_id)::bigint,
    count(*) filter (where noted_at >= v_cutoff_7)::bigint,
    count(*) filter (where noted_at >= v_cutoff_30)::bigint
  into v_total, v_pharmacy_notes, v_patient_notes, v_distinct_patients, v_last_7, v_last_30
  from feed;

  select coalesce(
    jsonb_object_agg(x.note_kind, x.cnt),
    '{}'::jsonb
  )
  into v_by_kind
  from (
    select f.note_kind, count(*)::bigint as cnt
    from public.pharmacist_officine_notes_feed(5000, 0) f
    group by f.note_kind
  ) x;

  return jsonb_build_object(
    'total_notes', v_total,
    'pharmacy_notes', v_pharmacy_notes,
    'patient_notes', v_patient_notes,
    'distinct_patients', v_distinct_patients,
    'last_7_days', v_last_7,
    'last_30_days', v_last_30,
    'by_kind', v_by_kind
  );
end;
$$;

revoke all on function public.pharmacist_officine_notes_feed(integer, integer) from public;
grant execute on function public.pharmacist_officine_notes_feed(integer, integer) to authenticated;

revoke all on function public.pharmacist_officine_notes_snapshot() from public;
grant execute on function public.pharmacist_officine_notes_snapshot() to authenticated;

comment on function public.pharmacist_officine_notes_feed(integer, integer) is
  'Journal unifié des notes patient / officine pour l''officine connectée (lignes, dossiers, promos).';

comment on function public.pharmacist_officine_notes_snapshot() is
  'KPIs agrégés pour le hub Notes officine pharmacien.';
