-- Reset complet horaires / exceptions / gardes (pilote)
-- À exécuter dans l’éditeur SQL Supabase (rôle avec droits sur public).
--
-- Effet :
--   1. Supprime toutes les gardes (pharmacy_on_call_periods)
--   2. Supprime toutes les exceptions calendrier (pharmacy_day_overrides)
--   3. Réapplique les horaires hebdo Maroc par défaut pour chaque officine
--      (lun–ven 9h–13h / 15h–21h, sam 9h–13h, dim fermé)
--
-- Variante UNE seule pharmacie : décommenter le bloc en bas et renseigner l’UUID.

begin;

-- Toutes les officines
delete from public.pharmacy_on_call_periods;
delete from public.pharmacy_day_overrides;

do $$
declare
  r record;
begin
  for r in select id from public.pharmacies
  loop
    perform public.seed_pharmacy_default_weekly_hours_morocco(r.id);
  end loop;
end;
$$;

commit;

-- ---------------------------------------------------------------------------
-- UNE seule pharmacie (remplacer l’UUID, exécuter à la place du bloc ci-dessus)
-- ---------------------------------------------------------------------------
-- begin;
-- delete from public.pharmacy_on_call_periods
--   where pharmacy_id = '00000000-0000-0000-0000-000000000000'::uuid;
-- delete from public.pharmacy_day_overrides
--   where pharmacy_id = '00000000-0000-0000-0000-000000000000'::uuid;
-- select public.seed_pharmacy_default_weekly_hours_morocco('00000000-0000-0000-0000-000000000000'::uuid);
-- commit;
