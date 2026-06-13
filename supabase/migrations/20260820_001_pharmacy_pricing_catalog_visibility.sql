-- Visibilité prix catalogue patient + upsert atomique règle produit (ajustement PU pré-réponse).

alter table public.pharmacy_pricing_settings
  add column if not exists show_catalog_prices_before_response boolean not null default true;

comment on column public.pharmacy_pricing_settings.show_catalog_prices_before_response is
  'Si false, le patient ne voit pas les PU catalogue avant la réponse officine (saisie + dossier submitted/in_review).';

create or replace function public.pharmacist_pricing_config_get()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pharmacy uuid;
  v_settings public.pharmacy_pricing_settings%rowtype;
begin
  select ps.pharmacy_id into v_pharmacy
  from public.pharmacy_staff ps
  join public.profiles me on me.id = auth.uid() and me.role = 'pharmacien'
  where ps.user_id = auth.uid()
  limit 1;

  if v_pharmacy is null then
    return null;
  end if;

  select * into v_settings from public.pharmacy_pricing_settings s where s.pharmacy_id = v_pharmacy;

  return jsonb_build_object(
    'pharmacy_id', v_pharmacy,
    'settings', case
      when v_settings.pharmacy_id is null then jsonb_build_object(
        'parapharmacy_mode', 'at_pph',
        'parapharmacy_margin_pct', 0,
        'show_catalog_prices_before_response', true
      )
      else jsonb_build_object(
        'parapharmacy_mode', v_settings.parapharmacy_mode,
        'parapharmacy_margin_pct', v_settings.parapharmacy_margin_pct,
        'show_catalog_prices_before_response', v_settings.show_catalog_prices_before_response
      )
    end,
    'brand_rules', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', r.id,
            'brand_key', r.brand_key,
            'brand_display', r.brand_key,
            'margin_pct', r.margin_pct
          )
          order by r.brand_key
        )
        from public.pharmacy_pricing_brand_rules r
        where r.pharmacy_id = v_pharmacy
      ),
      '[]'::jsonb
    ),
    'product_overrides', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'product_id', o.product_id,
            'product_name', pr.name,
            'brand', pr.brand,
            'product_type', pr.product_type,
            'price_pph', pr.price_pph,
            'price_ppv', pr.price_ppv,
            'margin_pct', o.margin_pct,
            'resolved_price', public.resolve_pharmacy_product_unit_price(v_pharmacy, o.product_id)
          )
          order by pr.name
        )
        from public.pharmacy_pricing_product_overrides o
        join public.products pr on pr.id = o.product_id
        where o.pharmacy_id = v_pharmacy
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.pharmacist_pricing_config_save(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pharmacy uuid;
  v_mode text;
  v_margin numeric(6, 2);
  v_show_prices boolean;
  v_brand jsonb;
  v_prod jsonb;
  v_row record;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select ps.pharmacy_id into v_pharmacy
  from public.pharmacy_staff ps
  join public.profiles me on me.id = auth.uid() and me.role = 'pharmacien'
  where ps.user_id = auth.uid()
  limit 1;

  if v_pharmacy is null then
    raise exception 'Accès pharmacien requis';
  end if;

  v_mode := coalesce(p_payload->'settings'->>'parapharmacy_mode', 'at_pph');
  if v_mode not in ('at_pph', 'margin_on_pph') then
    raise exception 'Mode invalide';
  end if;

  v_margin := coalesce((p_payload->'settings'->>'parapharmacy_margin_pct')::numeric, 0);
  if v_margin < -10 or v_margin > 40 then
    raise exception 'Marge globale hors bornes (-10 %% à +40 %%)';
  end if;

  v_show_prices := coalesce((p_payload->'settings'->>'show_catalog_prices_before_response')::boolean, true);

  insert into public.pharmacy_pricing_settings (
    pharmacy_id,
    parapharmacy_mode,
    parapharmacy_margin_pct,
    show_catalog_prices_before_response,
    updated_by
  )
  values (v_pharmacy, v_mode, v_margin, v_show_prices, auth.uid())
  on conflict (pharmacy_id) do update set
    parapharmacy_mode = excluded.parapharmacy_mode,
    parapharmacy_margin_pct = excluded.parapharmacy_margin_pct,
    show_catalog_prices_before_response = excluded.show_catalog_prices_before_response,
    updated_at = now(),
    updated_by = excluded.updated_by;

  delete from public.pharmacy_pricing_brand_rules where pharmacy_id = v_pharmacy;

  for v_brand in select * from jsonb_array_elements(coalesce(p_payload->'brand_rules', '[]'::jsonb))
  loop
    if public._normalize_brand_key(v_brand->>'brand_key') = '' then
      continue;
    end if;
    v_margin := (v_brand->>'margin_pct')::numeric;
    if v_margin < -10 or v_margin > 40 then
      raise exception 'Marge marque hors bornes';
    end if;
    insert into public.pharmacy_pricing_brand_rules (pharmacy_id, brand_key, margin_pct)
    values (
      v_pharmacy,
      public._normalize_brand_key(v_brand->>'brand_key'),
      v_margin
    );
  end loop;

  delete from public.pharmacy_pricing_product_overrides where pharmacy_id = v_pharmacy;

  for v_prod in select * from jsonb_array_elements(coalesce(p_payload->'product_overrides', '[]'::jsonb))
  loop
    select p.* into v_row
    from public.products p
    where p.id = (v_prod->>'product_id')::uuid and p.product_type = 'parapharmacie';

    if not found then
      raise exception 'Produit parapharmacie introuvable';
    end if;

    v_margin := (v_prod->>'margin_pct')::numeric;
    if v_margin < -10 or v_margin > 40 then
      raise exception 'Marge produit hors bornes';
    end if;

    insert into public.pharmacy_pricing_product_overrides (pharmacy_id, product_id, margin_pct)
    values (v_pharmacy, v_row.id, v_margin);
  end loop;

  return public.pharmacist_pricing_config_get();
end;
$$;

create or replace function public.pharmacist_pricing_product_override_upsert(
  p_product_id uuid,
  p_margin_pct numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pharmacy uuid;
  v_row record;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select ps.pharmacy_id into v_pharmacy
  from public.pharmacy_staff ps
  join public.profiles me on me.id = auth.uid() and me.role = 'pharmacien'
  where ps.user_id = auth.uid()
  limit 1;

  if v_pharmacy is null then
    raise exception 'Accès pharmacien requis';
  end if;

  if p_product_id is null then
    raise exception 'Produit requis';
  end if;

  if p_margin_pct < -10 or p_margin_pct > 40 then
    raise exception 'Marge produit hors bornes (-10 %% à +40 %%)';
  end if;

  select p.* into v_row
  from public.products p
  where p.id = p_product_id
    and p.is_active = true
    and p.product_type = 'parapharmacie';

  if not found then
    raise exception 'Produit parapharmacie introuvable';
  end if;

  insert into public.pharmacy_pricing_product_overrides (pharmacy_id, product_id, margin_pct)
  values (v_pharmacy, v_row.id, p_margin_pct)
  on conflict (pharmacy_id, product_id) do update set
    margin_pct = excluded.margin_pct,
    updated_at = now();

  return public.pharmacist_pricing_config_get();
end;
$$;

create or replace function public.pharmacy_pricing_config_public_get(p_pharmacy_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_settings public.pharmacy_pricing_settings%rowtype;
begin
  if p_pharmacy_id is null then
    return null;
  end if;

  if not exists (select 1 from public.pharmacies ph where ph.id = p_pharmacy_id) then
    return null;
  end if;

  select * into v_settings from public.pharmacy_pricing_settings s where s.pharmacy_id = p_pharmacy_id;

  return jsonb_build_object(
    'pharmacy_id', p_pharmacy_id,
    'settings', case
      when v_settings.pharmacy_id is null then jsonb_build_object(
        'parapharmacy_mode', 'at_pph',
        'parapharmacy_margin_pct', 0,
        'show_catalog_prices_before_response', true
      )
      else jsonb_build_object(
        'parapharmacy_mode', v_settings.parapharmacy_mode,
        'parapharmacy_margin_pct', v_settings.parapharmacy_margin_pct,
        'show_catalog_prices_before_response', v_settings.show_catalog_prices_before_response
      )
    end,
    'brand_rules', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'brand_key', r.brand_key,
            'margin_pct', r.margin_pct
          )
          order by r.brand_key
        )
        from public.pharmacy_pricing_brand_rules r
        where r.pharmacy_id = p_pharmacy_id
      ),
      '[]'::jsonb
    ),
    'product_overrides', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'product_id', o.product_id,
            'margin_pct', o.margin_pct
          )
          order by o.product_id
        )
        from public.pharmacy_pricing_product_overrides o
        where o.pharmacy_id = p_pharmacy_id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke all on function public.pharmacist_pricing_product_override_upsert(uuid, numeric) from public;
grant execute on function public.pharmacist_pricing_product_override_upsert(uuid, numeric) to authenticated;
