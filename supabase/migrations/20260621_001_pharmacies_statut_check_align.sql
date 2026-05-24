-- Aligne pharmacies.statut avec l’admin (/admin) : ouverte | fermee | garde
-- Corrige : violates check constraint "pharmacies_statut_check"

alter table public.pharmacies
  drop constraint if exists pharmacies_statut_check;

-- Toute valeur inconnue → ouverte (évite l'échec ADD CONSTRAINT sur lignes legacy)
update public.pharmacies
set statut = case
  when lower(btrim(coalesce(statut, ''))) in (
    'fermee', 'fermée', 'closed', 'close', 'ferme', 'fermé'
  ) then 'fermee'
  when lower(btrim(coalesce(statut, ''))) in (
    'garde', 'on_call', 'on-call', 'de_garde', 'permanence', 'oncall'
  ) then 'garde'
  when lower(btrim(coalesce(statut, ''))) in (
    'ouverte', 'open', 'opened', 'active', 'actif', 'actif'
  ) then 'ouverte'
  else 'ouverte'
end;

alter table public.pharmacies
  alter column statut set default 'ouverte';

alter table public.pharmacies
  add constraint pharmacies_statut_check
  check (statut in ('ouverte', 'fermee', 'garde'));

comment on column public.pharmacies.statut is
  'Disponibilité affichée pilote : ouverte, fermee, garde (sans accent sur fermee).';

-- Vérification :
-- select statut, count(*) from public.pharmacies group by statut order by statut;
