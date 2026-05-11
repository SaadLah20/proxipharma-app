-- ---------------------------------------------------------------------------
-- Vider toutes les demandes (tests / dev) — SQL Editor Supabase ou psql
-- (rôle postgres / service_role, ou membre bypass RLS).
--
-- Efface : public.requests et tout ce qui référence requests en ON DELETE CASCADE
--   (request_items, request_item_alternatives, request_comments,
--    request_status_history, product_requests / prescription_requests /
--    free_consultation_requests, app_notifications, notification_external_queue,
--    request_supply_amendments, …).
--
-- Ne supprime pas : pharmacies, produits, profils.
-- market_shortages.source_request_item_id repasse en NULL (contrainte SET NULL).
--
-- Optionnel : compteurs codes publics Dnnn/YY par officine (repart à D001…).
-- ---------------------------------------------------------------------------

begin;

-- Évite un blocage éventuel sur la FK circulaire ligne → alternative choisie.
update public.request_items
set patient_chosen_alternative_id = null
where patient_chosen_alternative_id is not null;

delete from public.requests;

delete from public.pharmacy_request_ref_counters;

commit;
