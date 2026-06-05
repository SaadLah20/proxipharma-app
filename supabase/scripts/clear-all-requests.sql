-- ---------------------------------------------------------------------------
-- Vider toutes les demandes et données liées (tests / dev pilote)
--
-- Où : Supabase → SQL Editor → tout sélectionner (Ctrl+A) → Run
-- Modale : « Run without RLS » si proposée
-- Rôle : postgres / service_role
--
-- Efface :
--   • Demandes D / O / C : public.requests + CASCADE
--     (request_items, alternatives, comments, history, supply_amendments,
--      product_requests, prescription_requests, free_consultation_requests,
--      app_notifications liées, notification_external_queue, conversation_reads, …)
--   • Réservations packs promo Pnnn/YY + historique + notifs promo in-app
--     (ne supprime pas les offres publiées pharmacy_promo_offers)
--
-- Conserve :
--   • pharmacies, profils, comptes Auth, catalogue products, pricing, horaires,
--     fiches officine, offres promo publiées, compteurs PH (officines)
--
-- Réinitialise : compteurs codes publics demandes D/O/C (Dnnn/YY, Onnn/YY, Cnnn/YY)
--
-- market_shortages.source_request_item_id → NULL (ON DELETE SET NULL)
--
-- Ensuite (Storage) — dans l’ordre :
--   1. node --use-system-ca scripts/clear-request-private-media.mjs --confirm
--      (ordonnances, consultations, photos patient dossier produit)
--   2. node --use-system-ca scripts/reset-storage-keep-catalog-and-pharmacy-photos.mjs --confirm
--      (optionnel : vide le reste de public-assets hors products/ et pharmacies/)
--      En pratique après (1), public-assets est déjà intact ; (2) = filet de sécurité.
--
-- Alternative Node (BDD seule, sans promo si ancien script) :
--   node --use-system-ca scripts/clear-all-requests.mjs
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

-- ---------------------------------------------------------------------------
-- Vérifications (lecture seule — décommenter si besoin)
-- ---------------------------------------------------------------------------
-- select count(*) as requests from public.requests;
-- select count(*) as request_items from public.request_items;
-- select count(*) as promo_reservations from public.pharmacy_promo_reservations;
-- select count(*) as app_notifs from public.app_notifications;
