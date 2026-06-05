-- Vide le catalogue produits avant import BeautyMall (~13 650 lignes).
-- Prérequis : aucune demande active ne doit référencer des produits (ON DELETE RESTRICT).
--
-- Où : Supabase → SQL Editor → tout sélectionner → Run
-- Modale : « Run without RLS » si proposée
--
-- Si erreur FK sur request_items : exécuter d'abord supabase/scripts/clear-all-requests.sql
-- (ou supabase/scripts/reset-pilot-keep-products-single-admin.sql pour reset pilote complet).

begin;

-- Packs promo : les lignes « product » imposent product_id NOT NULL (CHECK).
-- DELETE products déclenchait ON DELETE SET NULL → erreur 23514.
delete from public.promo_in_app_notifications;
delete from public.pharmacy_promo_reservation_status_history;
delete from public.pharmacy_promo_reservations;
delete from public.pharmacy_promo_reservation_ref_counters;
delete from public.pharmacy_promo_offer_lines;

update public.request_items
set patient_chosen_alternative_id = null
where patient_chosen_alternative_id is not null;

delete from public.market_shortages;
delete from public.request_item_alternatives;
delete from public.request_items;
delete from public.requests;
delete from public.pharmacy_request_ref_counters;
delete from public.products;

commit;

-- Vérification :
-- select count(*) from products;  -- 0
