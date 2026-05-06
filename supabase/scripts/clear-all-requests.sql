-- ---------------------------------------------------------------------------
-- Vider toutes les demandes (tests) — à exécuter en SQL Editor Supabase
-- ou via psql avec un rôle suffisant (service_role / postgres).
--
-- Efface : requests + lignes liées en cascade (items, alternatives, historique,
--         product_requests, commentaires, files d’attente notif liées, etc.)
-- Ne supprime pas : pharmacies, produits, profils, comptes.
--
-- Optionnel : remet à zéro les compteurs de codes publics Dnnn/YY par officine.
-- ---------------------------------------------------------------------------

begin;

delete from public.requests;

-- Repartir les références publiques type D001/26 pour l’année suivante insérée
delete from public.pharmacy_request_ref_counters;

commit;
