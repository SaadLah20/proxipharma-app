-- Hub pharmacien : avis patients sur l'officine (liste + KPIs).

create or replace function public.pharmacist_pharmacy_ratings_for_my_pharmacy(
  p_limit integer default 200,
  p_offset integer default 0
)
returns table (
  rating_id uuid,
  author_id uuid,
  patient_display_name text,
  patient_ref text,
  score smallint,
  comment text,
  created_at timestamptz,
  updated_at timestamptz,
  was_updated boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pharmacy uuid;
  v_limit integer := greatest(1, least(coalesce(p_limit, 200), 500));
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select ps.pharmacy_id
  into v_pharmacy
  from public.pharmacy_staff ps
  join public.profiles me on me.id = ps.user_id
  where ps.user_id = v_uid
    and me.role = 'pharmacien'
  limit 1;

  if v_pharmacy is null then
    raise exception 'Accès pharmacien requis';
  end if;

  return query
  select
    pr.id as rating_id,
    pr.author_id,
    coalesce(nullif(btrim(pat.full_name), ''), 'Patient')::text as patient_display_name,
    coalesce(pat.patient_ref, '')::text as patient_ref,
    pr.score,
    pr.comment,
    pr.created_at,
    pr.updated_at,
    (pr.updated_at > pr.created_at + interval '1 second') as was_updated
  from public.pharmacy_ratings pr
  join public.profiles pat on pat.id = pr.author_id
  where pr.pharmacy_id = v_pharmacy
  order by pr.created_at desc
  limit v_limit
  offset v_offset;
end;
$$;

create or replace function public.pharmacist_pharmacy_ratings_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pharmacy uuid;
  v_avg numeric(3, 2);
  v_count integer;
  v_with_comment bigint;
  v_last_7 bigint;
  v_last_30 bigint;
  v_by_score jsonb;
begin
  if v_uid is null then
    return null;
  end if;

  select ps.pharmacy_id
  into v_pharmacy
  from public.pharmacy_staff ps
  join public.profiles me on me.id = ps.user_id
  where ps.user_id = v_uid
    and me.role = 'pharmacien'
  limit 1;

  if v_pharmacy is null then
    return null;
  end if;

  select ph.rating_avg, ph.rating_count
  into v_avg, v_count
  from public.pharmacies ph
  where ph.id = v_pharmacy;

  select
    count(*) filter (where nullif(btrim(pr.comment), '') is not null)::bigint,
    count(*) filter (where pr.created_at >= now() - interval '7 days')::bigint,
    count(*) filter (where pr.created_at >= now() - interval '30 days')::bigint
  into v_with_comment, v_last_7, v_last_30
  from public.pharmacy_ratings pr
  where pr.pharmacy_id = v_pharmacy;

  select coalesce(
    jsonb_object_agg(x.score::text, x.cnt),
    '{}'::jsonb
  )
  into v_by_score
  from (
    select pr.score, count(*)::bigint as cnt
    from public.pharmacy_ratings pr
    where pr.pharmacy_id = v_pharmacy
    group by pr.score
  ) x;

  return jsonb_build_object(
    'rating_avg', coalesce(v_avg, 0),
    'rating_count', coalesce(v_count, 0),
    'with_comment', coalesce(v_with_comment, 0),
    'last_7_days', coalesce(v_last_7, 0),
    'last_30_days', coalesce(v_last_30, 0),
    'by_score', coalesce(v_by_score, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.pharmacist_pharmacy_ratings_for_my_pharmacy(integer, integer) from public;
grant execute on function public.pharmacist_pharmacy_ratings_for_my_pharmacy(integer, integer) to authenticated;

revoke all on function public.pharmacist_pharmacy_ratings_snapshot() from public;
grant execute on function public.pharmacist_pharmacy_ratings_snapshot() to authenticated;

comment on function public.pharmacist_pharmacy_ratings_for_my_pharmacy(integer, integer) is
  'Liste des avis patients laissés sur l''officine du pharmacien connecté.';

comment on function public.pharmacist_pharmacy_ratings_snapshot() is
  'KPIs avis officine pour le hub pharmacien (moyenne, volume, commentaires, périodes, répartition).';
