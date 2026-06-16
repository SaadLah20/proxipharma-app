-- Mes produits : filtre RPC « Dépubliés » ≠ « Supprimés » (archived_hidden séparé).

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
      or cp.status::text = p_status
    )
  order by cp.updated_at desc, cp.name asc;
end;
$$;
