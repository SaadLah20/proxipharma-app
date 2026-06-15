-- Rupture marché : ne pas insérer dans market_shortages si la ligne n'a pas de product_id
-- (produits privés officine : pharmacy_product_id seul). Sinon violation NOT NULL à la réponse pharmacien.

create or replace function public._sync_market_shortage_from_request_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ph uuid;
begin
  if NEW.availability_status is distinct from 'market_shortage' then
    return NEW;
  end if;

  -- Catalogue privé officine : pas d'entrée hub national (product_id requis sur market_shortages).
  if NEW.product_id is null then
    return NEW;
  end if;

  select r.pharmacy_id into v_ph
  from public.requests r
  where r.id = NEW.request_id;

  if v_ph is null then
    return NEW;
  end if;

  if exists (
    select 1 from public.market_shortages ms
    where ms.pharmacy_id = v_ph
      and ms.product_id = NEW.product_id
      and ms.is_active = true
  ) then
    return NEW;
  end if;

  insert into public.market_shortages (
    pharmacy_id,
    product_id,
    source_request_item_id,
    declared_by,
    note,
    is_active
  ) values (
    v_ph,
    NEW.product_id,
    NEW.id,
    null,
    nullif(trim(NEW.pharmacist_comment), ''),
    true
  );

  return NEW;
end;
$$;

comment on function public._sync_market_shortage_from_request_item() is
  'Déclare une rupture hub national uniquement pour les lignes catalogue global (product_id). Les produits privés officine gardent availability_status=market_shortage sur la ligne sans entrée market_shortages.';
