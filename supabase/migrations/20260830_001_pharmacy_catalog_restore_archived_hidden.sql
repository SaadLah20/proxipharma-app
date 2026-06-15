-- Mes produits : conserver les produits supprimés (archived_hidden) visibles comme dépubliés + restauration.

alter table public.pharmacy_catalog_product_admin_events
  drop constraint if exists pharmacy_catalog_product_admin_events_event_type_check;

alter table public.pharmacy_catalog_product_admin_events
  add constraint pharmacy_catalog_product_admin_events_event_type_check
  check (
    event_type in (
      'created',
      'updated_by_pharmacist',
      'unpublished',
      'republished',
      'admin_enriched',
      'published',
      'rejected',
      'archived_by_pharmacist',
      'restored_by_pharmacist'
    )
  );

-- Liste hub : inclure archived_hidden (filtre « Dépubliés » côté client ou p_status = unpublished)
create or replace function public.pharmacist_list_pharmacy_products(
  p_status text default null
)
returns setof public.pharmacy_catalog_products
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pharmacy uuid;
begin
  select ps.pharmacy_id into v_pharmacy
  from public.pharmacy_staff ps
  join public.profiles me on me.id = auth.uid() and me.role = 'pharmacien'
  where ps.user_id = auth.uid()
  limit 1;

  if v_pharmacy is null then
    return;
  end if;

  return query
  select cp.*
  from public.pharmacy_catalog_products cp
  where cp.pharmacy_id = v_pharmacy
    and (
      p_status is not null
      or cp.status in ('active', 'unpublished', 'archived_published', 'archived_hidden')
    )
    and (
      p_status is null
      or (
        p_status = 'unpublished'
        and cp.status in ('unpublished', 'archived_hidden')
      )
      or (
        p_status <> 'unpublished'
        and cp.status::text = p_status
      )
    )
  order by cp.updated_at desc, cp.name asc;
end;
$$;

-- Restaurer un produit masqué → actif (recherche + nouvelles demandes)
create or replace function public.pharmacist_restore_pharmacy_product(p_product_id uuid)
returns public.pharmacy_catalog_products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.pharmacy_catalog_products;
begin
  select * into v_row
  from public.pharmacy_catalog_products cp
  where cp.id = p_product_id
  for update;

  if not found then
    raise exception 'Produit introuvable';
  end if;

  if not public._user_is_pharmacy_staff(v_row.pharmacy_id) then
    raise exception 'Non autorisé';
  end if;

  if v_row.status = 'archived_published' then
    raise exception 'Produit archivé après publication nationale';
  end if;

  if v_row.status <> 'archived_hidden' then
    raise exception 'Seuls les produits supprimés peuvent être restaurés';
  end if;

  update public.pharmacy_catalog_products
  set status = 'active'
  where id = p_product_id
  returning * into v_row;

  insert into public.pharmacy_catalog_product_admin_events (
    pharmacy_product_id,
    event_type,
    actor_id,
    snapshot
  )
  values (
    v_row.id,
    'restored_by_pharmacist',
    auth.uid(),
    public._pharmacy_catalog_product_snapshot(v_row)
  );

  return v_row;
end;
$$;

grant execute on function public.pharmacist_restore_pharmacy_product(uuid) to authenticated;
