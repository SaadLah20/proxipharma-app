-- Ranking recherche produit : préfixe nom avant sous-chaîne (ex. doliprane avant codoliprane).

-- ---------------------------------------------------------------------------
-- Score de pertinence (plus petit = meilleur)
-- ---------------------------------------------------------------------------
create or replace function public._product_search_match_rank(
  p_name text,
  p_brand text,
  p_laboratory text,
  p_query text
)
returns int
language sql
immutable
parallel safe
as $$
  select case
    when lower(coalesce(p_name, '')) like lower(p_query) || '%' then 0
    when lower(coalesce(p_name, '')) like '%' || lower(p_query) || '%' then 1
    when lower(coalesce(p_brand, '')) like lower(p_query) || '%' then 2
    when lower(coalesce(p_brand, '')) like '%' || lower(p_query) || '%' then 3
    when lower(coalesce(p_laboratory, '')) like lower(p_query) || '%' then 4
    when lower(coalesce(p_laboratory, '')) like '%' || lower(p_query) || '%' then 5
    else 6
  end;
$$;

revoke all on function public._product_search_match_rank(text, text, text, text) from public;
grant execute on function public._product_search_match_rank(text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Recherche catalogue national (paginée, ranking préfixe)
-- ---------------------------------------------------------------------------
create or replace function public.products_catalog_search(
  p_query text,
  p_product_type text default null,
  p_brand text default null,
  p_offset int default 0,
  p_limit int default 60
)
returns table (
  id uuid,
  name text,
  product_type text,
  brand text,
  laboratory text,
  photo_url text,
  price_pph numeric,
  price_ppv numeric,
  full_description text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_q text;
  v_pattern text;
  v_offset int;
  v_lim int;
  v_type text;
  v_brand text;
begin
  v_q := btrim(coalesce(p_query, ''));
  if char_length(v_q) < 2 then
    return;
  end if;

  v_q := regexp_replace(v_q, '[%_,]', ' ', 'g');
  v_q := regexp_replace(v_q, '\s+', ' ', 'g');
  v_q := btrim(v_q);
  if char_length(v_q) < 2 then
    return;
  end if;

  v_pattern := '%' || v_q || '%';
  v_offset := greatest(0, coalesce(p_offset, 0));
  v_lim := greatest(1, least(coalesce(p_limit, 60), 100));

  v_type := btrim(coalesce(p_product_type, ''));
  if v_type = '' or lower(v_type) = 'all' then
    v_type := null;
  end if;

  v_brand := btrim(coalesce(p_brand, ''));
  if v_brand = '' then
    v_brand := null;
  end if;

  return query
  select
    p.id,
    p.name,
    p.product_type,
    p.brand,
    p.laboratory,
    p.photo_url,
    p.price_pph,
    p.price_ppv,
    p.full_description
  from public.products p
  where p.is_active = true
    and (
      p.name ilike v_pattern
      or coalesce(p.brand, '') ilike v_pattern
      or coalesce(p.laboratory, '') ilike v_pattern
    )
    and (v_type is null or p.product_type = v_type)
    and (v_brand is null or coalesce(p.brand, '') ilike v_brand)
  order by
    public._product_search_match_rank(p.name, p.brand, p.laboratory, v_q),
    p.name
  offset v_offset
  limit v_lim;
end;
$$;

grant execute on function public.products_catalog_search(text, text, text, int, int) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Recherche unifiée officine (ranking préfixe + tri global)
-- ---------------------------------------------------------------------------
create or replace function public.pharmacy_catalog_search(
  p_pharmacy_id uuid,
  p_query text,
  p_limit int default 48
)
returns table (
  source text,
  id uuid,
  name text,
  product_type text,
  brand text,
  laboratory text,
  photo_url text,
  price_pph numeric,
  price_ppv numeric,
  full_description text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_q text;
  v_pattern text;
  v_lim int;
begin
  if p_pharmacy_id is null then
    return;
  end if;

  if not public._pharmacy_accessible_to_current_user(p_pharmacy_id) then
    raise exception 'Pharmacie non accessible';
  end if;

  v_q := btrim(coalesce(p_query, ''));
  if char_length(v_q) < 2 then
    return;
  end if;

  v_q := regexp_replace(v_q, '[%_,]', ' ', 'g');
  v_q := regexp_replace(v_q, '\s+', ' ', 'g');
  v_q := btrim(v_q);
  if char_length(v_q) < 2 then
    return;
  end if;

  v_pattern := '%' || v_q || '%';
  v_lim := greatest(1, least(coalesce(p_limit, 48), 100));

  return query
  select
    combined.source,
    combined.id,
    combined.name,
    combined.product_type,
    combined.brand,
    combined.laboratory,
    combined.photo_url,
    combined.price_pph,
    combined.price_ppv,
    combined.full_description
  from (
    (
      select
        'global'::text as source,
        p.id,
        p.name,
        p.product_type,
        p.brand,
        p.laboratory,
        p.photo_url,
        p.price_pph,
        p.price_ppv,
        p.full_description,
        public._product_search_match_rank(p.name, p.brand, p.laboratory, v_q) as match_rank
      from public.products p
      where p.is_active = true
        and (
          p.name ilike v_pattern
          or coalesce(p.brand, '') ilike v_pattern
          or coalesce(p.laboratory, '') ilike v_pattern
        )
      order by
        public._product_search_match_rank(p.name, p.brand, p.laboratory, v_q),
        p.name
      limit v_lim
    )
    union all
    (
      select
        'pharmacy'::text as source,
        cp.id,
        cp.name,
        cp.product_type,
        cp.brand,
        cp.laboratory,
        cp.photo_url,
        cp.price_pph,
        cp.price_ppv,
        cp.full_description,
        public._product_search_match_rank(cp.name, cp.brand, cp.laboratory, v_q) as match_rank
      from public.pharmacy_catalog_products cp
      where cp.pharmacy_id = p_pharmacy_id
        and cp.status = 'active'
        and (
          cp.name ilike v_pattern
          or coalesce(cp.brand, '') ilike v_pattern
          or coalesce(cp.laboratory, '') ilike v_pattern
        )
      order by
        public._product_search_match_rank(cp.name, cp.brand, cp.laboratory, v_q),
        cp.name
      limit v_lim
    )
  ) combined
  order by combined.match_rank, combined.name
  limit v_lim;
end;
$$;

grant execute on function public.pharmacy_catalog_search(uuid, text, int) to anon, authenticated;
