-- Phase C : espace admin — file produits communautaires, enrichissement, publication nationale.

-- ---------------------------------------------------------------------------
-- Liste admin (file + historique)
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_pharmacy_catalog_products(
  p_status text default null,
  p_limit int default 100,
  p_offset int default 0
)
returns table (
  id uuid,
  pharmacy_id uuid,
  pharmacy_name text,
  pharmacy_ville text,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  name text,
  product_type text,
  price_pph numeric,
  price_ppv numeric,
  brand text,
  laboratory text,
  photo_url text,
  short_description text,
  full_description text,
  form text,
  category text,
  subcategory text,
  status public.pharmacy_catalog_product_status,
  promoted_product_id uuid,
  promoted_at timestamptz,
  pharmacist_name text,
  event_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès réservé aux administrateurs';
  end if;

  return query
  select
    cp.id,
    cp.pharmacy_id,
    ph.nom as pharmacy_name,
    ph.ville as pharmacy_ville,
    cp.created_by,
    cp.created_at,
    cp.updated_at,
    cp.name,
    cp.product_type,
    cp.price_pph,
    cp.price_ppv,
    cp.brand,
    cp.laboratory,
    cp.photo_url,
    cp.short_description,
    cp.full_description,
    cp.form,
    cp.category,
    cp.subcategory,
    cp.status,
    cp.promoted_product_id,
    cp.promoted_at,
    pr.full_name as pharmacist_name,
    (
      select count(*)::bigint
      from public.pharmacy_catalog_product_admin_events ev
      where ev.pharmacy_product_id = cp.id
    ) as event_count
  from public.pharmacy_catalog_products cp
  join public.pharmacies ph on ph.id = cp.pharmacy_id
  left join public.profiles pr on pr.id = cp.created_by
  where (
    p_status is null
    or cp.status::text = p_status
  )
  order by
    case cp.status
      when 'active' then 0
      when 'unpublished' then 1
      when 'archived_published' then 2
      else 3
    end,
    cp.updated_at desc,
    cp.name asc
  limit greatest(coalesce(p_limit, 100), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- Compteur file admin (non encore publiés au national)
-- ---------------------------------------------------------------------------
create or replace function public.admin_count_pending_community_catalog_products()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint
  from public.pharmacy_catalog_products cp
  where public.is_admin()
    and cp.status in ('active', 'unpublished');
$$;

-- ---------------------------------------------------------------------------
-- Enrichissement admin (avant publication)
-- ---------------------------------------------------------------------------
create or replace function public.admin_enrich_pharmacy_catalog_product(
  p_product_id uuid,
  p_name text default null,
  p_product_type text default null,
  p_price_pph numeric default null,
  p_price_ppv numeric default null,
  p_brand text default null,
  p_laboratory text default null,
  p_photo_url text default null,
  p_short_description text default null,
  p_full_description text default null,
  p_form text default null,
  p_category text default null,
  p_subcategory text default null,
  p_notes text default null
)
returns public.pharmacy_catalog_products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.pharmacy_catalog_products;
  v_name text;
begin
  if not public.is_admin() then
    raise exception 'Accès réservé aux administrateurs';
  end if;

  select * into v_row
  from public.pharmacy_catalog_products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'Produit officine introuvable';
  end if;

  if v_row.status = 'archived_published' then
    raise exception 'Produit déjà publié au catalogue national — enrichissement via products';
  end if;

  v_name := coalesce(nullif(btrim(coalesce(p_name, '')), ''), v_row.name);
  if char_length(v_name) < 1 then
    raise exception 'Le nom du produit est obligatoire';
  end if;

  if p_product_type is not null and p_product_type not in ('medicament', 'parapharmacie') then
    raise exception 'Type de produit invalide';
  end if;

  update public.pharmacy_catalog_products
  set
    name = v_name,
    product_type = coalesce(p_product_type, product_type),
    price_pph = case
      when coalesce(p_product_type, product_type) = 'parapharmacie'
        then coalesce(p_price_pph, price_pph)
      else null
    end,
    price_ppv = case
      when coalesce(p_product_type, product_type) = 'medicament'
        then coalesce(p_price_ppv, price_ppv)
      else null
    end,
    brand = coalesce(nullif(btrim(coalesce(p_brand, '')), ''), brand),
    laboratory = coalesce(nullif(btrim(coalesce(p_laboratory, '')), ''), laboratory),
    photo_url = coalesce(nullif(btrim(coalesce(p_photo_url, '')), ''), photo_url),
    short_description = coalesce(nullif(btrim(coalesce(p_short_description, '')), ''), short_description),
    full_description = coalesce(nullif(btrim(coalesce(p_full_description, '')), ''), full_description),
    form = coalesce(nullif(btrim(coalesce(p_form, '')), ''), form),
    category = coalesce(nullif(btrim(coalesce(p_category, '')), ''), category),
    subcategory = coalesce(nullif(btrim(coalesce(p_subcategory, '')), ''), subcategory)
  where id = p_product_id
  returning * into v_row;

  if v_row.product_type = 'parapharmacie' and v_row.price_pph is null then
    raise exception 'Le PPH est obligatoire pour la parapharmacie';
  end if;

  if v_row.product_type = 'medicament' and v_row.price_ppv is null then
    raise exception 'Le PPV est obligatoire pour les médicaments';
  end if;

  insert into public.pharmacy_catalog_product_admin_events (
    pharmacy_product_id,
    event_type,
    actor_id,
    snapshot,
    notes
  )
  values (
    v_row.id,
    'admin_enriched',
    auth.uid(),
    public._pharmacy_catalog_product_snapshot(v_row),
    nullif(btrim(coalesce(p_notes, '')), '')
  );

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Publication au catalogue national
-- ---------------------------------------------------------------------------
create or replace function public.admin_publish_pharmacy_product_to_global(
  p_product_id uuid,
  p_force_duplicate boolean default false,
  p_notes text default null
)
returns table (
  pharmacy_product public.pharmacy_catalog_products,
  global_product public.products
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.pharmacy_catalog_products;
  v_global public.products;
  v_dup_count int;
  v_dup_names text;
begin
  if not public.is_admin() then
    raise exception 'Accès réservé aux administrateurs';
  end if;

  select * into v_row
  from public.pharmacy_catalog_products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'Produit officine introuvable';
  end if;

  if v_row.status = 'archived_published' then
    raise exception 'Produit déjà publié au catalogue national';
  end if;

  select count(*), string_agg(p.name, ', ' order by p.name)
  into v_dup_count, v_dup_names
  from public.products p
  where p.is_active = true
    and p.product_type = v_row.product_type
    and lower(btrim(p.name)) = lower(btrim(v_row.name));

  if v_dup_count > 0 and not coalesce(p_force_duplicate, false) then
    raise exception
      'Doublon probable dans le catalogue national (% produit(s) actif(s) : %). Republiez avec force si vous confirmez.',
      v_dup_count,
      coalesce(v_dup_names, '—');
  end if;

  insert into public.products (
    name,
    product_type,
    price_pph,
    price_ppv,
    brand,
    laboratory,
    photo_url,
    short_description,
    full_description,
    form,
    category,
    subcategory,
    is_active
  )
  values (
    v_row.name,
    v_row.product_type,
    v_row.price_pph,
    v_row.price_ppv,
    v_row.brand,
    v_row.laboratory,
    v_row.photo_url,
    v_row.short_description,
    v_row.full_description,
    v_row.form,
    v_row.category,
    v_row.subcategory,
    true
  )
  returning * into v_global;

  update public.pharmacy_catalog_products
  set
    status = 'archived_published',
    promoted_product_id = v_global.id,
    promoted_at = now()
  where id = p_product_id
  returning * into v_row;

  insert into public.pharmacy_catalog_product_admin_events (
    pharmacy_product_id,
    event_type,
    actor_id,
    snapshot,
    notes
  )
  values (
    v_row.id,
    'published',
    auth.uid(),
    jsonb_build_object(
      'pharmacy_product', public._pharmacy_catalog_product_snapshot(v_row),
      'global_product_id', v_global.id,
      'global_product_name', v_global.name,
      'forced_duplicate', coalesce(p_force_duplicate, false)
    ),
    nullif(btrim(coalesce(p_notes, '')), '')
  );

  pharmacy_product := v_row;
  global_product := v_global;
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- Historique events admin (lecture)
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_pharmacy_catalog_product_events(
  p_product_id uuid,
  p_limit int default 50
)
returns setof public.pharmacy_catalog_product_admin_events
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès réservé aux administrateurs';
  end if;

  return query
  select ev.*
  from public.pharmacy_catalog_product_admin_events ev
  where ev.pharmacy_product_id = p_product_id
  order by ev.created_at desc
  limit greatest(coalesce(p_limit, 50), 1);
end;
$$;

grant execute on function public.admin_list_pharmacy_catalog_products(text, int, int) to authenticated;
grant execute on function public.admin_count_pending_community_catalog_products() to authenticated;
grant execute on function public.admin_enrich_pharmacy_catalog_product(uuid, text, text, numeric, numeric, text, text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.admin_publish_pharmacy_product_to_global(uuid, boolean, text) to authenticated;
grant execute on function public.admin_list_pharmacy_catalog_product_events(uuid, int) to authenticated;
