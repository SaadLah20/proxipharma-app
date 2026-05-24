-- ---------------------------------------------------------------------------
-- RESET PILOTE — garder : catalogue products + 1 seul compte admin
--
-- À exécuter dans Supabase SQL Editor (rôle postgres / service_role).
-- Une seule exécution. Lire les NOTICE au début (admin conservé).
--
-- IMPORTANT : tout sélectionner (Ctrl+A) puis « Run selected », ou Run sans sélection.
-- Ne pas lancer uniquement la fin (commit / vérifs) : exécuter depuis begin; (l.19).
-- À la modale Supabase : « Run without RLS » (pas de table permanente créée).
--
-- CONSERVE :
--   public.products
--   public.pharmacy_service_catalog (référentiel services)
--   1 profil admin (le plus ancien par created_at, sinon par id)
--   auth.users correspondant
--
-- SUPPRIME : demandes, officines, promos, patients, pharmaciens, notifs, files…
-- Storage : voir scripts/reset-storage-keep-product-photos-only.mjs
-- ---------------------------------------------------------------------------

begin;

-- Admin conservé (un seul) — contrôle avant suppressions (NOTICE dans l’onglet Messages)
do $$
declare
  n_admin int;
  k uuid;
  k_email text;
begin
  select count(*) into n_admin from public.profiles where role = 'admin';

  select p.id, coalesce(p.email, '(sans email)')
  into k, k_email
  from public.profiles p
  where p.role = 'admin'
  order by p.created_at nulls last, p.id
  limit 1;

  if k is null then
    raise exception 'Aucun profil role=admin trouvé. Créez un admin avant ce reset.';
  end if;

  raise notice 'Admins en base : %. Admin CONSERVÉ : % (%)', n_admin, k_email, k;

  if n_admin > 1 then
    raise notice 'Les autres comptes admin seront supprimés (profil + auth.users).';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Promos (RESTRICT sur pharmacy / patient — avant officines et profils)
-- ---------------------------------------------------------------------------
delete from public.promo_in_app_notifications;
delete from public.pharmacy_promo_reservation_status_history;
delete from public.pharmacy_promo_reservations;
delete from public.pharmacy_promo_offer_lines;
delete from public.pharmacy_promo_offers;
delete from public.pharmacy_promo_reservation_ref_counters;

-- ---------------------------------------------------------------------------
-- Demandes (+ cascade : items, comments, history, supply_amendments, reads…)
-- ---------------------------------------------------------------------------
update public.request_items
set patient_chosen_alternative_id = null
where patient_chosen_alternative_id is not null;

delete from public.requests;
delete from public.pharmacy_request_ref_counters;

-- ---------------------------------------------------------------------------
-- Données liées aux officines
-- ---------------------------------------------------------------------------
delete from public.market_shortages;
delete from public.pharmacy_ratings;
delete from public.pharmacy_engagement_events;

delete from public.pharmacy_pricing_product_overrides;
delete from public.pharmacy_pricing_laboratory_rules;
delete from public.pharmacy_pricing_settings;

delete from public.pharmacy_services;
delete from public.pharmacy_weekly_hours;
delete from public.pharmacy_day_overrides;
delete from public.pharmacy_on_call_periods;

delete from public.pharmacy_staff;
delete from public.pharmacies;

-- ---------------------------------------------------------------------------
-- Notifications (tout vider, y compris admin — demandé pilote)
-- ---------------------------------------------------------------------------
delete from public.app_notifications;
delete from public.notification_external_queue;

delete from public.notification_external_prefs
where user_id not in (
  select p.id
  from public.profiles p
  where p.role = 'admin'
  order by p.created_at nulls last, p.id
  limit 1
);

-- ---------------------------------------------------------------------------
-- Comptes (patients, pharmaciens, admins en trop)
-- ---------------------------------------------------------------------------
delete from public.profiles
where id not in (
  select p.id
  from public.profiles p
  where p.role = 'admin'
  order by p.created_at nulls last, p.id
  limit 1
);

delete from auth.users
where id not in (
  select p.id
  from public.profiles p
  where p.role = 'admin'
  order by p.created_at nulls last, p.id
  limit 1
);

commit;

-- ---------------------------------------------------------------------------
-- Vérifications (lecture seule)
-- ---------------------------------------------------------------------------
-- select count(*) as products from public.products;
-- select id, role, email, full_name from public.profiles;
-- select count(*) as pharmacies from public.pharmacies;
-- select count(*) as requests from public.requests;
-- select count(*) as auth_users from auth.users;
