-- ---------------------------------------------------------------------------
-- Vider toutes les demandes (tests / dev) — SQL Editor Supabase ou psql
-- (rôle postgres / service_role, ou membre bypass RLS).
--
-- Efface :
--   • Demandes D / O / C : public.requests + CASCADE
--     (request_items, alternatives, comments, history, supply_amendments,
--      product_requests / prescription_requests / free_consultation_requests,
--      app_notifications, notification_external_queue, conversation_reads, …).
--   • Packs promo : réservations Pnnn/YY + historique + notifs promo (pas les offres publiées).
--
-- Ne supprime pas : pharmacies, produits, profils, comptes Auth, offres promo (pharmacy_promo_offers).
-- market_shortages.source_request_item_id → NULL (SET NULL).
-- Storage ordonnances / consultations (garde photos officine + produits) :
--   node --use-system-ca scripts/clear-request-private-media.mjs --confirm
-- (ne touche pas public-assets ; ne supprime pas private-media/patient/).
--
-- Compteurs codes publics : Dnnn/YY et Pnnn/YY repartent à 001.
-- ---------------------------------------------------------------------------

begin;

-- ---------------------------------------------------------------------------
-- Packs promo (workflow séparé des requests ; RESTRICT sur offer_id)
-- ---------------------------------------------------------------------------
delete from public.promo_in_app_notifications;
delete from public.pharmacy_promo_reservation_status_history;
delete from public.pharmacy_promo_reservations;
delete from public.pharmacy_promo_reservation_ref_counters;

-- ---------------------------------------------------------------------------
-- Demandes produits / ordonnances / consultations
-- ---------------------------------------------------------------------------
update public.request_items
set patient_chosen_alternative_id = null
where patient_chosen_alternative_id is not null;

delete from public.requests;

delete from public.pharmacy_request_ref_counters;

commit;
