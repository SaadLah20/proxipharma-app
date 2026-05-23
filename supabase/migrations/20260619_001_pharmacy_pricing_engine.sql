-- Moteur de pricing par officine : PPV médicaments (fixe), parapharmacie PPH ± marge, règles labo / produit.

-- ---------------------------------------------------------------------------
-- Schéma
-- ---------------------------------------------------------------------------
create table if not exists public.pharmacy_pricing_settings (
  pharmacy_id uuid primary key references public.pharmacies (id) on delete cascade,
  parapharmacy_mode text not null default 'at_pph'
    check (parapharmacy_mode in ('at_pph', 'margin_on_pph')),
  parapharmacy_margin_pct numeric(6, 2) not null default 0
    check (parapharmacy_margin_pct >= -10 and parapharmacy_margin_pct <= 40),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

create table if not exists public.pharmacy_pricing_laboratory_rules (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  laboratory_key text not null,
  margin_pct numeric(6, 2) not null
    check (margin_pct >= -10 and margin_pct <= 40),
  created_at timestamptz not null default now(),
  unique (pharmacy_id, laboratory_key)
);

create index if not exists pharmacy_pricing_laboratory_rules_pharmacy_idx
  on public.pharmacy_pricing_laboratory_rules (pharmacy_id);

create table if not exists public.pharmacy_pricing_product_overrides (
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  margin_pct numeric(6, 2) not null
    check (margin_pct >= -10 and margin_pct <= 40),
  updated_at timestamptz not null default now(),
  primary key (pharmacy_id, product_id)
);

alter table public.pharmacy_pricing_settings enable row level security;
alter table public.pharmacy_pricing_laboratory_rules enable row level security;
alter table public.pharmacy_pricing_product_overrides enable row level security;

drop policy if exists "pharmacy_pricing_settings_staff" on public.pharmacy_pricing_settings;
create policy "pharmacy_pricing_settings_staff"
  on public.pharmacy_pricing_settings for all to authenticated
  using (
    exists (
      select 1 from public.pharmacy_staff ps
      where ps.pharmacy_id = pharmacy_pricing_settings.pharmacy_id and ps.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.pharmacy_staff ps
      join public.profiles me on me.id = auth.uid() and me.role = 'pharmacien'
      where ps.pharmacy_id = pharmacy_pricing_settings.pharmacy_id and ps.user_id = auth.uid()
    )
  );

drop policy if exists "pharmacy_pricing_lab_rules_staff" on public.pharmacy_pricing_laboratory_rules;
create policy "pharmacy_pricing_lab_rules_staff"
  on public.pharmacy_pricing_laboratory_rules for all to authenticated
  using (
    exists (
      select 1 from public.pharmacy_staff ps
      where ps.pharmacy_id = pharmacy_pricing_laboratory_rules.pharmacy_id and ps.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.pharmacy_staff ps
      join public.profiles me on me.id = auth.uid() and me.role = 'pharmacien'
      where ps.pharmacy_id = pharmacy_pricing_laboratory_rules.pharmacy_id and ps.user_id = auth.uid()
    )
  );

drop policy if exists "pharmacy_pricing_product_overrides_staff" on public.pharmacy_pricing_product_overrides;
create policy "pharmacy_pricing_product_overrides_staff"
  on public.pharmacy_pricing_product_overrides for all to authenticated
  using (
    exists (
      select 1 from public.pharmacy_staff ps
      where ps.pharmacy_id = pharmacy_pricing_product_overrides.pharmacy_id and ps.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.pharmacy_staff ps
      join public.profiles me on me.id = auth.uid() and me.role = 'pharmacien'
      where ps.pharmacy_id = pharmacy_pricing_product_overrides.pharmacy_id and ps.user_id = auth.uid()
    )
  );

-- PPV obligatoire pour les médicaments (seed / données existantes)
update public.products p
set price_ppv = round(p.price_pph * 1.28, 2)
where p.product_type = 'medicament'
  and p.price_ppv is null
  and p.price_pph is not null;

update public.products p
set price_ppv = round(p.price_pph * 1.28, 2)
where p.product_type = 'medicament'
  and p.price_ppv is null;

-- ---------------------------------------------------------------------------
-- Résolution prix unitaire (source de vérité côté serveur)
-- ---------------------------------------------------------------------------
create or replace function public._normalize_laboratory_key(p_lab text)
returns text
language sql
immutable
as $$
  select upper(btrim(coalesce(p_lab, '')));
$$;

create or replace function public.resolve_pharmacy_product_unit_price(
  p_pharmacy_id uuid,
  p_product_id uuid
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_prod public.products%rowtype;
  v_settings public.pharmacy_pricing_settings%rowtype;
  v_margin numeric(6, 2);
  v_lab_key text;
  v_base numeric(10, 2);
begin
  if p_pharmacy_id is null or p_product_id is null then
    return null;
  end if;

  select * into v_prod from public.products p where p.id = p_product_id and p.is_active = true;
  if not found then
    return null;
  end if;

  if v_prod.product_type = 'medicament' then
    return v_prod.price_ppv;
  end if;

  v_base := v_prod.price_pph;
  if v_base is null then
    return null;
  end if;

  select * into v_settings
  from public.pharmacy_pricing_settings s
  where s.pharmacy_id = p_pharmacy_id;

  if not found then
    return round(v_base, 2);
  end if;

  select o.margin_pct into v_margin
  from public.pharmacy_pricing_product_overrides o
  where o.pharmacy_id = p_pharmacy_id and o.product_id = p_product_id;

  if v_margin is null then
    v_lab_key := public._normalize_laboratory_key(v_prod.laboratory);
    if v_lab_key <> '' then
      select r.margin_pct into v_margin
      from public.pharmacy_pricing_laboratory_rules r
      where r.pharmacy_id = p_pharmacy_id and r.laboratory_key = v_lab_key;
    end if;
  end if;

  if v_margin is null then
    if v_settings.parapharmacy_mode = 'at_pph' then
      v_margin := 0;
    else
      v_margin := v_settings.parapharmacy_margin_pct;
    end if;
  end if;

  return round(v_base * (1 + v_margin / 100.0), 2);
end;
$$;

-- ---------------------------------------------------------------------------
-- Config CRUD (pharmacien staff)
-- ---------------------------------------------------------------------------
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
        'parapharmacy_margin_pct', 0
      )
      else jsonb_build_object(
        'parapharmacy_mode', v_settings.parapharmacy_mode,
        'parapharmacy_margin_pct', v_settings.parapharmacy_margin_pct
      )
    end,
    'laboratory_rules', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', r.id,
            'laboratory_key', r.laboratory_key,
            'laboratory_display', r.laboratory_key,
            'margin_pct', r.margin_pct
          )
          order by r.laboratory_key
        )
        from public.pharmacy_pricing_laboratory_rules r
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
            'laboratory', pr.laboratory,
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
  v_lab jsonb;
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

  insert into public.pharmacy_pricing_settings (
    pharmacy_id, parapharmacy_mode, parapharmacy_margin_pct, updated_by
  )
  values (v_pharmacy, v_mode, v_margin, auth.uid())
  on conflict (pharmacy_id) do update set
    parapharmacy_mode = excluded.parapharmacy_mode,
    parapharmacy_margin_pct = excluded.parapharmacy_margin_pct,
    updated_at = now(),
    updated_by = excluded.updated_by;

  delete from public.pharmacy_pricing_laboratory_rules where pharmacy_id = v_pharmacy;

  for v_lab in select * from jsonb_array_elements(coalesce(p_payload->'laboratory_rules', '[]'::jsonb))
  loop
    if public._normalize_laboratory_key(v_lab->>'laboratory_key') = '' then
      continue;
    end if;
    v_margin := (v_lab->>'margin_pct')::numeric;
    if v_margin < -10 or v_margin > 40 then
      raise exception 'Marge laboratoire hors bornes';
    end if;
    insert into public.pharmacy_pricing_laboratory_rules (pharmacy_id, laboratory_key, margin_pct)
    values (
      v_pharmacy,
      public._normalize_laboratory_key(v_lab->>'laboratory_key'),
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

create or replace function public.pharmacist_pricing_distinct_laboratories()
returns table (laboratory_key text, laboratory_display text, product_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    public._normalize_laboratory_key(p.laboratory) as laboratory_key,
    max(btrim(p.laboratory)) as laboratory_display,
    count(*)::bigint as product_count
  from public.products p
  where p.is_active = true
    and p.product_type = 'parapharmacie'
    and btrim(coalesce(p.laboratory, '')) <> ''
  group by public._normalize_laboratory_key(p.laboratory)
  order by laboratory_display;
$$;

revoke all on function public.resolve_pharmacy_product_unit_price(uuid, uuid) from public;
grant execute on function public.resolve_pharmacy_product_unit_price(uuid, uuid) to authenticated, anon;

revoke all on function public.pharmacist_pricing_config_get() from public;
grant execute on function public.pharmacist_pricing_config_get() to authenticated;

revoke all on function public.pharmacist_pricing_config_save(jsonb) from public;
grant execute on function public.pharmacist_pricing_config_save(jsonb) to authenticated;

revoke all on function public.pharmacist_pricing_distinct_laboratories() from public;
grant execute on function public.pharmacist_pricing_distinct_laboratories() to authenticated;

-- Lecture config par officine (parcours patient / catalogue)
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
        'parapharmacy_margin_pct', 0
      )
      else jsonb_build_object(
        'parapharmacy_mode', v_settings.parapharmacy_mode,
        'parapharmacy_margin_pct', v_settings.parapharmacy_margin_pct
      )
    end,
    'laboratory_rules', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'laboratory_key', r.laboratory_key,
            'margin_pct', r.margin_pct
          )
          order by r.laboratory_key
        )
        from public.pharmacy_pricing_laboratory_rules r
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

revoke all on function public.pharmacy_pricing_config_public_get(uuid) from public;
grant execute on function public.pharmacy_pricing_config_public_get(uuid) to authenticated, anon;

comment on table public.pharmacy_pricing_settings is
  'Règle globale parapharmacie : PPH ou marge -10 % à +40 % (médicaments = PPV catalogue, non paramétrable).';
