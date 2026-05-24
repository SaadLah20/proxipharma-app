-- Aligne pharmacies.statut avec l’admin (/admin) : ouverte | fermee | garde
-- Corrige : violates check constraint "pharmacies_statut_check"

alter table public.pharmacies
  drop constraint if exists pharmacies_statut_check;

-- Normalise d’éventuelles valeurs legacy (anglais / accents)
update public.pharmacies
set statut = case
  when statut in ('open', 'Open', 'OPEN') then 'ouverte'
  when statut in ('closed', 'Closed', 'CLOSED', 'fermée', 'fermee') then 'fermee'
  when statut in ('on_call', 'on-call', 'garde', 'de_garde', 'De garde') then 'garde'
  else statut
end
where statut is not null;

update public.pharmacies
set statut = 'ouverte'
where statut is null or btrim(statut) = '';

alter table public.pharmacies
  alter column statut set default 'ouverte';

alter table public.pharmacies
  add constraint pharmacies_statut_check
  check (statut in ('ouverte', 'fermee', 'garde'));

comment on column public.pharmacies.statut is
  'Disponibilité affichée pilote : ouverte, fermee, garde (sans accent sur fermee).';
