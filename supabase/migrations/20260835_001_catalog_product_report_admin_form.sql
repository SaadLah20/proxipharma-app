-- Signalements catalogue : formulaire admin complet + valeurs appliquées pour validation pharmacien.

alter table public.catalog_product_report_fields
  add column if not exists applied_value text;

-- Autoriser l'événement « enregistré sans clôture »
alter table public.catalog_product_report_events
  drop constraint if exists catalog_product_report_events_event_type_check;

alter table public.catalog_product_report_events
  add constraint catalog_product_report_events_event_type_check
  check (
    event_type in (
      'submitted', 'updated', 'cancelled', 'admin_saved', 'admin_resolved',
      'pharmacist_accepted', 'pharmacist_rejected'
    )
  );

create or replace function public._catalog_product_json_to_applied_text(
  p_field_key text,
  p_product jsonb
)
returns text
language plpgsql
immutable
as $$
declare
  v_raw text;
begin
  if p_product is null then
    return null;
  end if;

  if p_field_key in ('price_pph', 'price_ppv') then
    v_raw := p_product->>p_field_key;
    if v_raw is null or btrim(v_raw) = '' then
      return null;
    end if;
    return btrim(v_raw);
  end if;

  v_raw := nullif(btrim(p_product->>p_field_key), '');
  return v_raw;
end;
$$;

create or replace function public._admin_apply_national_product_updates(
  p_product_id uuid,
  p_product jsonb
)
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.products;
  v_name text := nullif(btrim(p_product->>'name'), '');
  v_product_type text := nullif(btrim(p_product->>'product_type'), '');
  v_price_pph numeric(10, 2);
  v_price_ppv numeric(10, 2);
begin
  if not public.is_admin() then
    raise exception 'Accès admin requis';
  end if;

  if v_name is null then
    raise exception 'Le nom est obligatoire';
  end if;

  if v_product_type is not null and v_product_type not in ('medicament', 'parapharmacie') then
    raise exception 'Type de produit invalide';
  end if;

  if nullif(btrim(p_product->>'price_pph'), '') is not null then
    v_price_pph := (replace(btrim(p_product->>'price_pph'), ',', '.'))::numeric(10, 2);
  end if;

  if nullif(btrim(p_product->>'price_ppv'), '') is not null then
    v_price_ppv := (replace(btrim(p_product->>'price_ppv'), ',', '.'))::numeric(10, 2);
  end if;

  select * into v_row
  from public.products
  where id = p_product_id
    and is_active = true
  for update;

  if not found then
    raise exception 'Produit catalogue introuvable';
  end if;

  if v_product_type = 'parapharmacie' and v_price_pph is null then
    raise exception 'Le PPH est obligatoire pour la parapharmacie';
  end if;

  if v_product_type = 'medicament' and v_price_ppv is null then
    raise exception 'Le PPV est obligatoire pour les médicaments';
  end if;

  update public.products
  set
    name = v_name,
    product_type = coalesce(v_product_type, product_type),
    price_pph = coalesce(v_price_pph, price_pph),
    price_ppv = coalesce(v_price_ppv, price_ppv),
    brand = nullif(btrim(p_product->>'brand'), ''),
    laboratory = nullif(btrim(p_product->>'laboratory'), ''),
    form = nullif(btrim(p_product->>'form'), ''),
    category = nullif(btrim(p_product->>'category'), ''),
    subcategory = nullif(btrim(p_product->>'subcategory'), ''),
    photo_url = nullif(btrim(p_product->>'photo_url'), ''),
    short_description = nullif(btrim(p_product->>'short_description'), ''),
    full_description = nullif(btrim(p_product->>'full_description'), ''),
    usage = nullif(btrim(p_product->>'usage'), ''),
    advice = nullif(btrim(p_product->>'advice'), ''),
    updated_at = now()
  where id = p_product_id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public._sync_catalog_report_applied_values(
  p_report_id uuid,
  p_product jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.catalog_product_report_fields f
  set applied_value = public._catalog_product_json_to_applied_text(f.field_key, p_product),
      updated_at = now()
  where f.report_id = p_report_id;
end;
$$;

create or replace function public.admin_save_catalog_product_from_report(
  p_report_id uuid,
  p_product jsonb
)
returns public.catalog_product_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_report public.catalog_product_reports;
  v_product public.products;
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
    raise exception 'Ce signalement ne peut plus être modifié';
  end if;

  v_product := public._admin_apply_national_product_updates(v_report.product_id, p_product);
  perform public._sync_catalog_report_applied_values(v_report.id, public._catalog_product_snapshot(v_product));

  update public.catalog_product_reports
  set updated_at = now()
  where id = p_report_id
  returning * into v_report;

  insert into public.catalog_product_report_events (report_id, event_type, actor_id)
  values (v_report.id, 'admin_saved', v_uid);

  return v_report;
end;
$$;

create or replace function public.admin_resolve_catalog_product_report(
  p_report_id uuid,
  p_message text default null,
  p_product jsonb default null
)
returns public.catalog_product_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_report public.catalog_product_reports;
  v_product public.products;
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

  if p_product is not null then
    v_product := public._admin_apply_national_product_updates(v_report.product_id, p_product);
    perform public._sync_catalog_report_applied_values(v_report.id, public._catalog_product_snapshot(v_product));
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
  v_live_product jsonb;
  v_reported_keys text[];
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

  select coalesce(array_agg(f.field_key order by f.field_key), array[]::text[])
  into v_reported_keys
  from public.catalog_product_report_fields f
  where f.report_id = p_report_id;

  select public._catalog_product_snapshot(p)
  into v_live_product
  from public.products p
  where p.id = v_report.product_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'field_key', f.field_key,
      'current_value', f.current_value,
      'suggested_value', f.suggested_value,
      'applied_value', f.applied_value
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
    'live_product', coalesce(v_live_product, v_report.product_snapshot),
    'reported_field_keys', to_jsonb(v_reported_keys),
    'fields', v_fields,
    'events', v_events,
    'reported_by', v_report.reported_by,
    'created_at', v_report.created_at,
    'updated_at', v_report.updated_at
  );
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
      'suggested_value', f.suggested_value,
      'applied_value', f.applied_value
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

revoke all on function public.admin_save_catalog_product_from_report(uuid, jsonb) from public;
grant execute on function public.admin_save_catalog_product_from_report(uuid, jsonb) to authenticated;

revoke all on function public.admin_resolve_catalog_product_report(uuid, text, jsonb) from public;
grant execute on function public.admin_resolve_catalog_product_report(uuid, text, jsonb) to authenticated;

comment on column public.catalog_product_report_fields.applied_value is
  'Valeur effectivement appliquée au catalogue national lors du traitement admin';
