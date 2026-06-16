-- Signalements pharmacien sur le catalogue national (products).
-- Workflow : open → awaiting_pharmacist → closed | reopened (boucle admin/pharmacien).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enum statut signalement
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'catalog_product_report_status') then
    create type public.catalog_product_report_status as enum (
      'open',
      'awaiting_pharmacist',
      'reopened',
      'closed',
      'cancelled'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.catalog_product_reports (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  reported_by uuid not null references public.profiles (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  status public.catalog_product_report_status not null default 'open',
  product_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create unique index if not exists catalog_product_reports_active_unique_idx
  on public.catalog_product_reports (pharmacy_id, product_id)
  where status in ('open', 'awaiting_pharmacist', 'reopened');

create index if not exists catalog_product_reports_pharmacy_status_idx
  on public.catalog_product_reports (pharmacy_id, status, updated_at desc);

create index if not exists catalog_product_reports_product_idx
  on public.catalog_product_reports (product_id);

drop trigger if exists trg_catalog_product_reports_set_updated_at on public.catalog_product_reports;
create trigger trg_catalog_product_reports_set_updated_at
before update on public.catalog_product_reports
for each row
execute function public.set_updated_at();

create table if not exists public.catalog_product_report_fields (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.catalog_product_reports (id) on delete cascade,
  field_key text not null check (
    field_key in (
      'name', 'product_type', 'price_pph', 'price_ppv', 'brand', 'laboratory',
      'form', 'category', 'subcategory', 'photo_url', 'short_description',
      'full_description', 'usage', 'advice'
    )
  ),
  current_value text,
  suggested_value text not null check (char_length(trim(suggested_value)) >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_id, field_key)
);

create index if not exists catalog_product_report_fields_report_idx
  on public.catalog_product_report_fields (report_id);

drop trigger if exists trg_catalog_product_report_fields_set_updated_at on public.catalog_product_report_fields;
create trigger trg_catalog_product_report_fields_set_updated_at
before update on public.catalog_product_report_fields
for each row
execute function public.set_updated_at();

create table if not exists public.catalog_product_report_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.catalog_product_reports (id) on delete cascade,
  event_type text not null check (
    event_type in (
      'submitted', 'updated', 'cancelled', 'admin_resolved',
      'pharmacist_accepted', 'pharmacist_rejected'
    )
  ),
  actor_id uuid references public.profiles (id) on delete set null,
  body text,
  created_at timestamptz not null default now()
);

create index if not exists catalog_product_report_events_report_idx
  on public.catalog_product_report_events (report_id, created_at asc);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public._catalog_product_snapshot(p_row public.products)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', p_row.id,
    'name', p_row.name,
    'product_type', p_row.product_type,
    'price_pph', p_row.price_pph,
    'price_ppv', p_row.price_ppv,
    'brand', p_row.brand,
    'laboratory', p_row.laboratory,
    'form', p_row.form,
    'category', p_row.category,
    'subcategory', p_row.subcategory,
    'photo_url', p_row.photo_url,
    'short_description', p_row.short_description,
    'full_description', p_row.full_description,
    'usage', p_row.usage,
    'advice', p_row.advice
  );
$$;

create or replace function public._pharmacist_resolve_pharmacy_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pharmacy uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select ps.pharmacy_id
  into v_pharmacy
  from public.pharmacy_staff ps
  join public.profiles me on me.id = ps.user_id and me.role = 'pharmacien'
  where ps.user_id = auth.uid()
  limit 1;

  if v_pharmacy is null then
    raise exception 'Officine introuvable pour ce pharmacien';
  end if;

  return v_pharmacy;
end;
$$;

create or replace function public._validate_catalog_report_fields(p_fields jsonb)
returns void
language plpgsql
immutable
as $$
declare
  v_elem jsonb;
  v_key text;
  v_suggested text;
  v_count integer := 0;
begin
  if p_fields is null or jsonb_typeof(p_fields) <> 'array' or jsonb_array_length(p_fields) = 0 then
    raise exception 'Au moins un champ doit être signalé';
  end if;

  for v_elem in select value from jsonb_array_elements(p_fields)
  loop
    v_key := v_elem->>'field_key';
    v_suggested := nullif(btrim(v_elem->>'suggested_value'), '');

    if v_key is null or v_key = '' then
      raise exception 'field_key manquant';
    end if;

    if v_suggested is null then
      raise exception 'Valeur corrigée obligatoire pour le champ %', v_key;
    end if;

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'Au moins un champ doit être signalé';
  end if;
end;
$$;

create or replace function public._replace_catalog_report_fields(
  p_report_id uuid,
  p_fields jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_elem jsonb;
  v_key text;
  v_current text;
  v_suggested text;
begin
  perform public._validate_catalog_report_fields(p_fields);

  delete from public.catalog_product_report_fields
  where report_id = p_report_id;

  for v_elem in select value from jsonb_array_elements(p_fields)
  loop
    v_key := v_elem->>'field_key';
    v_current := v_elem->>'current_value';
    v_suggested := nullif(btrim(v_elem->>'suggested_value'), '');

    insert into public.catalog_product_report_fields (
      report_id, field_key, current_value, suggested_value
    ) values (
      p_report_id, v_key, v_current, v_suggested
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC pharmacien
-- ---------------------------------------------------------------------------
create or replace function public.pharmacist_get_product_reportable_snapshot(p_product_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pharmacy uuid;
  v_row public.products;
begin
  v_pharmacy := public._pharmacist_resolve_pharmacy_id();

  select * into v_row
  from public.products p
  where p.id = p_product_id
    and p.is_active = true;

  if not found then
    raise exception 'Produit catalogue introuvable';
  end if;

  return public._catalog_product_snapshot(v_row);
end;
$$;

create or replace function public.pharmacist_catalog_product_active_report_ids(p_product_ids uuid[])
returns table (
  product_id uuid,
  report_id uuid,
  status public.catalog_product_report_status
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pharmacy uuid;
begin
  v_pharmacy := public._pharmacist_resolve_pharmacy_id();

  if p_product_ids is null or cardinality(p_product_ids) = 0 then
    return;
  end if;

  return query
  select r.product_id, r.id, r.status
  from public.catalog_product_reports r
  where r.pharmacy_id = v_pharmacy
    and r.product_id = any (p_product_ids)
    and r.status in ('open', 'awaiting_pharmacist', 'reopened');
end;
$$;

create or replace function public.pharmacist_submit_catalog_product_report(
  p_product_id uuid,
  p_fields jsonb
)
returns public.catalog_product_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pharmacy uuid;
  v_uid uuid := auth.uid();
  v_row public.products;
  v_report public.catalog_product_reports;
  v_existing uuid;
begin
  v_pharmacy := public._pharmacist_resolve_pharmacy_id();
  perform public._validate_catalog_report_fields(p_fields);

  select id into v_existing
  from public.catalog_product_reports
  where pharmacy_id = v_pharmacy
    and product_id = p_product_id
    and status in ('open', 'awaiting_pharmacist', 'reopened')
  limit 1;

  if v_existing is not null then
    raise exception 'Produit déjà signalé — consultez Produits signalés';
  end if;

  select * into v_row
  from public.products p
  where p.id = p_product_id
    and p.is_active = true;

  if not found then
    raise exception 'Produit catalogue introuvable';
  end if;

  insert into public.catalog_product_reports (
    pharmacy_id, reported_by, product_id, status, product_snapshot
  ) values (
    v_pharmacy, v_uid, p_product_id, 'open', public._catalog_product_snapshot(v_row)
  )
  returning * into v_report;

  perform public._replace_catalog_report_fields(v_report.id, p_fields);

  insert into public.catalog_product_report_events (report_id, event_type, actor_id)
  values (v_report.id, 'submitted', v_uid);

  return v_report;
end;
$$;

create or replace function public.pharmacist_update_catalog_product_report(
  p_report_id uuid,
  p_fields jsonb
)
returns public.catalog_product_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pharmacy uuid;
  v_uid uuid := auth.uid();
  v_report public.catalog_product_reports;
  v_row public.products;
begin
  v_pharmacy := public._pharmacist_resolve_pharmacy_id();
  perform public._validate_catalog_report_fields(p_fields);

  select * into v_report
  from public.catalog_product_reports
  where id = p_report_id
    and pharmacy_id = v_pharmacy
  for update;

  if not found then
    raise exception 'Signalement introuvable';
  end if;

  if v_report.status not in ('open', 'reopened') then
    raise exception 'Ce signalement ne peut plus être modifié';
  end if;

  select * into v_row
  from public.products p
  where p.id = v_report.product_id;

  if not found then
    raise exception 'Produit catalogue introuvable';
  end if;

  update public.catalog_product_reports
  set product_snapshot = public._catalog_product_snapshot(v_row),
      updated_at = now()
  where id = p_report_id
  returning * into v_report;

  perform public._replace_catalog_report_fields(v_report.id, p_fields);

  insert into public.catalog_product_report_events (report_id, event_type, actor_id)
  values (v_report.id, 'updated', v_uid);

  return v_report;
end;
$$;

create or replace function public.pharmacist_cancel_catalog_product_report(p_report_id uuid)
returns public.catalog_product_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pharmacy uuid;
  v_uid uuid := auth.uid();
  v_report public.catalog_product_reports;
begin
  v_pharmacy := public._pharmacist_resolve_pharmacy_id();

  select * into v_report
  from public.catalog_product_reports
  where id = p_report_id
    and pharmacy_id = v_pharmacy
  for update;

  if not found then
    raise exception 'Signalement introuvable';
  end if;

  if v_report.status not in ('open', 'reopened', 'awaiting_pharmacist') then
    raise exception 'Ce signalement ne peut plus être annulé';
  end if;

  update public.catalog_product_reports
  set status = 'cancelled',
      closed_at = now(),
      updated_at = now()
  where id = p_report_id
  returning * into v_report;

  insert into public.catalog_product_report_events (report_id, event_type, actor_id)
  values (v_report.id, 'cancelled', v_uid);

  return v_report;
end;
$$;

create or replace function public.pharmacist_respond_catalog_product_report(
  p_report_id uuid,
  p_accept boolean,
  p_message text default null
)
returns public.catalog_product_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pharmacy uuid;
  v_uid uuid := auth.uid();
  v_report public.catalog_product_reports;
  v_body text := nullif(btrim(coalesce(p_message, '')), '');
begin
  v_pharmacy := public._pharmacist_resolve_pharmacy_id();

  select * into v_report
  from public.catalog_product_reports
  where id = p_report_id
    and pharmacy_id = v_pharmacy
  for update;

  if not found then
    raise exception 'Signalement introuvable';
  end if;

  if v_report.status <> 'awaiting_pharmacist' then
    raise exception 'Aucun traitement en attente de validation';
  end if;

  if p_accept then
    update public.catalog_product_reports
    set status = 'closed',
        closed_at = now(),
        updated_at = now()
    where id = p_report_id
    returning * into v_report;

    insert into public.catalog_product_report_events (report_id, event_type, actor_id, body)
    values (v_report.id, 'pharmacist_accepted', v_uid, v_body);
  else
    if v_body is null then
      raise exception 'Merci de préciser pourquoi le traitement ne convient pas';
    end if;

    update public.catalog_product_reports
    set status = 'reopened',
        updated_at = now()
    where id = p_report_id
    returning * into v_report;

    insert into public.catalog_product_report_events (report_id, event_type, actor_id, body)
    values (v_report.id, 'pharmacist_rejected', v_uid, v_body);
  end if;

  return v_report;
end;
$$;

create or replace function public.pharmacist_list_catalog_product_reports(
  p_filter text default 'active'
)
returns table (
  id uuid,
  product_id uuid,
  product_name text,
  status public.catalog_product_report_status,
  field_summary text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pharmacy uuid;
begin
  v_pharmacy := public._pharmacist_resolve_pharmacy_id();

  return query
  select
    r.id,
    r.product_id,
    coalesce(p.name, r.product_snapshot->>'name', 'Produit')::text as product_name,
    r.status,
    coalesce(
      (
        select string_agg(
          case f.field_key
            when 'name' then 'Nom'
            when 'product_type' then 'Type'
            when 'price_pph' then 'PPH'
            when 'price_ppv' then 'PPV'
            when 'brand' then 'Marque'
            when 'laboratory' then 'Laboratoire'
            when 'form' then 'Forme'
            when 'category' then 'Catégorie'
            when 'subcategory' then 'Sous-catégorie'
            when 'photo_url' then 'Photo'
            when 'short_description' then 'Desc. courte'
            when 'full_description' then 'Desc. complète'
            when 'usage' then 'Usage'
            when 'advice' then 'Conseil'
            else f.field_key
          end,
          ', ' order by f.field_key
        )
        from public.catalog_product_report_fields f
        where f.report_id = r.id
      ),
      ''
    )::text as field_summary,
    r.created_at,
    r.updated_at
  from public.catalog_product_reports r
  left join public.products p on p.id = r.product_id
  where r.pharmacy_id = v_pharmacy
    and (
      (p_filter = 'active' and r.status in ('open', 'awaiting_pharmacist', 'reopened'))
      or (p_filter = 'awaiting_pharmacist' and r.status = 'awaiting_pharmacist')
      or (p_filter = 'open' and r.status in ('open', 'reopened'))
      or (p_filter = 'closed' and r.status = 'closed')
      or (p_filter = 'cancelled' and r.status = 'cancelled')
      or (p_filter = 'all')
    )
  order by r.updated_at desc
  limit 500;
end;
$$;

create or replace function public.pharmacist_catalog_product_report_detail(p_report_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pharmacy uuid;
  v_report public.catalog_product_reports;
  v_fields jsonb;
  v_events jsonb;
  v_product_name text;
  v_latest_admin_message text;
begin
  v_pharmacy := public._pharmacist_resolve_pharmacy_id();

  select * into v_report
  from public.catalog_product_reports
  where id = p_report_id
    and pharmacy_id = v_pharmacy;

  if not found then
    raise exception 'Signalement introuvable';
  end if;

  select coalesce(p.name, v_report.product_snapshot->>'name', 'Produit')
  into v_product_name
  from public.products p
  where p.id = v_report.product_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'field_key', f.field_key,
      'current_value', f.current_value,
      'suggested_value', f.suggested_value
    ) order by f.field_key
  ), '[]'::jsonb)
  into v_fields
  from public.catalog_product_report_fields f
  where f.report_id = p_report_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'event_type', e.event_type,
      'actor_id', e.actor_id,
      'body', e.body,
      'created_at', e.created_at
    ) order by e.created_at asc
  ), '[]'::jsonb)
  into v_events
  from public.catalog_product_report_events e
  where e.report_id = p_report_id;

  select e.body
  into v_latest_admin_message
  from public.catalog_product_report_events e
  where e.report_id = p_report_id
    and e.event_type = 'admin_resolved'
  order by e.created_at desc
  limit 1;

  return jsonb_build_object(
    'id', v_report.id,
    'product_id', v_report.product_id,
    'product_name', v_product_name,
    'status', v_report.status,
    'product_snapshot', v_report.product_snapshot,
    'fields', v_fields,
    'events', v_events,
    'latest_admin_message', v_latest_admin_message,
    'created_at', v_report.created_at,
    'updated_at', v_report.updated_at,
    'closed_at', v_report.closed_at
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC admin
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_catalog_product_reports(
  p_filter text default 'open',
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  id uuid,
  pharmacy_id uuid,
  pharmacy_name text,
  pharmacy_ville text,
  product_id uuid,
  product_name text,
  status public.catalog_product_report_status,
  field_summary text,
  reported_by_name text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 500));
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.is_admin() then
    raise exception 'Accès admin requis';
  end if;

  return query
  select
    r.id,
    r.pharmacy_id,
    coalesce(ph.nom, 'Officine')::text,
    coalesce(ph.ville, '')::text,
    r.product_id,
    coalesce(p.name, r.product_snapshot->>'name', 'Produit')::text,
    r.status,
    coalesce(
      (
        select string_agg(f.field_key, ', ' order by f.field_key)
        from public.catalog_product_report_fields f
        where f.report_id = r.id
      ),
      ''
    )::text,
    coalesce(nullif(btrim(rep.full_name), ''), 'Pharmacien')::text,
    r.created_at,
    r.updated_at
  from public.catalog_product_reports r
  join public.pharmacies ph on ph.id = r.pharmacy_id
  left join public.products p on p.id = r.product_id
  left join public.profiles rep on rep.id = r.reported_by
  where (
    (p_filter = 'open' and r.status in ('open', 'reopened'))
    or (p_filter = 'awaiting_pharmacist' and r.status = 'awaiting_pharmacist')
    or (p_filter = 'closed' and r.status = 'closed')
    or (p_filter = 'cancelled' and r.status = 'cancelled')
    or (p_filter = 'all')
  )
  order by
    case r.status when 'reopened' then 0 when 'open' then 1 else 2 end,
    r.updated_at desc
  limit v_limit
  offset v_offset;
end;
$$;

create or replace function public.admin_catalog_product_report_detail(p_report_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_report public.catalog_product_reports;
  v_fields jsonb;
  v_events jsonb;
begin
  if not public.is_admin() then
    raise exception 'Accès admin requis';
  end if;

  select * into v_report
  from public.catalog_product_reports
  where id = p_report_id;

  if not found then
    raise exception 'Signalement introuvable';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'field_key', f.field_key,
      'current_value', f.current_value,
      'suggested_value', f.suggested_value
    ) order by f.field_key
  ), '[]'::jsonb)
  into v_fields
  from public.catalog_product_report_fields f
  where f.report_id = p_report_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'event_type', e.event_type,
      'actor_id', e.actor_id,
      'body', e.body,
      'created_at', e.created_at
    ) order by e.created_at asc
  ), '[]'::jsonb)
  into v_events
  from public.catalog_product_report_events e
  where e.report_id = p_report_id;

  return jsonb_build_object(
    'id', v_report.id,
    'pharmacy_id', v_report.pharmacy_id,
    'product_id', v_report.product_id,
    'status', v_report.status,
    'product_snapshot', v_report.product_snapshot,
    'fields', v_fields,
    'events', v_events,
    'reported_by', v_report.reported_by,
    'created_at', v_report.created_at,
    'updated_at', v_report.updated_at
  );
end;
$$;

create or replace function public.admin_resolve_catalog_product_report(
  p_report_id uuid,
  p_message text default null
)
returns public.catalog_product_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_report public.catalog_product_reports;
  v_body text := nullif(btrim(coalesce(p_message, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Accès admin requis';
  end if;

  select * into v_report
  from public.catalog_product_reports
  where id = p_report_id
  for update;

  if not found then
    raise exception 'Signalement introuvable';
  end if;

  if v_report.status not in ('open', 'reopened') then
    raise exception 'Ce signalement ne peut pas être marqué traité';
  end if;

  update public.catalog_product_reports
  set status = 'awaiting_pharmacist',
      updated_at = now()
  where id = p_report_id
  returning * into v_report;

  insert into public.catalog_product_report_events (report_id, event_type, actor_id, body)
  values (v_report.id, 'admin_resolved', v_uid, v_body);

  return v_report;
end;
$$;

create or replace function public.admin_count_open_catalog_product_reports()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.catalog_product_reports r
  where r.status in ('open', 'reopened')
    and public.is_admin();
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.catalog_product_reports enable row level security;
alter table public.catalog_product_report_fields enable row level security;
alter table public.catalog_product_report_events enable row level security;

drop policy if exists "catalog_product_reports_admin_all" on public.catalog_product_reports;
create policy "catalog_product_reports_admin_all"
on public.catalog_product_reports
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "catalog_product_reports_pharmacist_select" on public.catalog_product_reports;
create policy "catalog_product_reports_pharmacist_select"
on public.catalog_product_reports
for select
to authenticated
using (
  exists (
    select 1
    from public.pharmacy_staff ps
    join public.profiles p on p.id = ps.user_id
    where ps.pharmacy_id = catalog_product_reports.pharmacy_id
      and ps.user_id = auth.uid()
      and p.role = 'pharmacien'
  )
);

drop policy if exists "catalog_product_report_fields_admin_all" on public.catalog_product_report_fields;
create policy "catalog_product_report_fields_admin_all"
on public.catalog_product_report_fields
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "catalog_product_report_fields_pharmacist_select" on public.catalog_product_report_fields;
create policy "catalog_product_report_fields_pharmacist_select"
on public.catalog_product_report_fields
for select
to authenticated
using (
  exists (
    select 1
    from public.catalog_product_reports r
    join public.pharmacy_staff ps on ps.pharmacy_id = r.pharmacy_id and ps.user_id = auth.uid()
    join public.profiles p on p.id = ps.user_id and p.role = 'pharmacien'
    where r.id = catalog_product_report_fields.report_id
  )
);

drop policy if exists "catalog_product_report_events_admin_all" on public.catalog_product_report_events;
create policy "catalog_product_report_events_admin_all"
on public.catalog_product_report_events
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "catalog_product_report_events_pharmacist_select" on public.catalog_product_report_events;
create policy "catalog_product_report_events_pharmacist_select"
on public.catalog_product_report_events
for select
to authenticated
using (
  exists (
    select 1
    from public.catalog_product_reports r
    join public.pharmacy_staff ps on ps.pharmacy_id = r.pharmacy_id and ps.user_id = auth.uid()
    join public.profiles p on p.id = ps.user_id and p.role = 'pharmacien'
    where r.id = catalog_product_report_events.report_id
  )
);

-- Grants RPC
revoke all on function public.pharmacist_get_product_reportable_snapshot(uuid) from public;
revoke all on function public.pharmacist_catalog_product_active_report_ids(uuid[]) from public;
revoke all on function public.pharmacist_submit_catalog_product_report(uuid, jsonb) from public;
revoke all on function public.pharmacist_update_catalog_product_report(uuid, jsonb) from public;
revoke all on function public.pharmacist_cancel_catalog_product_report(uuid) from public;
revoke all on function public.pharmacist_respond_catalog_product_report(uuid, boolean, text) from public;
revoke all on function public.pharmacist_list_catalog_product_reports(text) from public;
revoke all on function public.pharmacist_catalog_product_report_detail(uuid) from public;
revoke all on function public.admin_list_catalog_product_reports(text, integer, integer) from public;
revoke all on function public.admin_catalog_product_report_detail(uuid) from public;
revoke all on function public.admin_resolve_catalog_product_report(uuid, text) from public;
revoke all on function public.admin_count_open_catalog_product_reports() from public;

grant execute on function public.pharmacist_get_product_reportable_snapshot(uuid) to authenticated;
grant execute on function public.pharmacist_catalog_product_active_report_ids(uuid[]) to authenticated;
grant execute on function public.pharmacist_submit_catalog_product_report(uuid, jsonb) to authenticated;
grant execute on function public.pharmacist_update_catalog_product_report(uuid, jsonb) to authenticated;
grant execute on function public.pharmacist_cancel_catalog_product_report(uuid) to authenticated;
grant execute on function public.pharmacist_respond_catalog_product_report(uuid, boolean, text) to authenticated;
grant execute on function public.pharmacist_list_catalog_product_reports(text) to authenticated;
grant execute on function public.pharmacist_catalog_product_report_detail(uuid) to authenticated;
grant execute on function public.admin_list_catalog_product_reports(text, integer, integer) to authenticated;
grant execute on function public.admin_catalog_product_report_detail(uuid) to authenticated;
grant execute on function public.admin_resolve_catalog_product_report(uuid, text) to authenticated;
grant execute on function public.admin_count_open_catalog_product_reports() to authenticated;

comment on table public.catalog_product_reports is 'Signalements pharmacien sur le catalogue national products';
