-- Lecture catalogue privé référencé par un dossier (même dépublié) :
-- conserve nom / PPH sur les lignes request_items déjà envoyées ou répondues.

drop policy if exists "pharmacy_catalog_products_read" on public.pharmacy_catalog_products;

create policy "pharmacy_catalog_products_read"
on public.pharmacy_catalog_products
for select
to authenticated, anon
using (
  public.is_admin()
  or public._user_is_pharmacy_staff(pharmacy_id)
  or (
    status = 'active'
    and public._pharmacy_accessible_to_current_user(pharmacy_id)
  )
  or exists (
    select 1
    from public.request_items ri
    inner join public.requests req on req.id = ri.request_id
    where ri.pharmacy_product_id = pharmacy_catalog_products.id
      and (
        req.patient_id = auth.uid()
        or public._user_is_pharmacy_staff(req.pharmacy_id)
      )
  )
  or exists (
    select 1
    from public.request_item_alternatives ria
    inner join public.request_items ri on ri.id = ria.request_item_id
    inner join public.requests req on req.id = ri.request_id
    where ria.pharmacy_product_id = pharmacy_catalog_products.id
      and (
        req.patient_id = auth.uid()
        or public._user_is_pharmacy_staff(req.pharmacy_id)
      )
  )
);
