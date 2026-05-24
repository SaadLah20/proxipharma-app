-- Visibilité publique du titulaire + préremplissage depuis le profil propriétaire.

alter table public.pharmacies
  add column if not exists titular_public boolean not null default true;

comment on column public.pharmacies.titular_public is
  'Si false, titular_name/titular_title ne sont pas affichés sur la fiche publique.';

-- Pharmacies existantes : nom titulaire depuis le pharmacien propriétaire si vide.
update public.pharmacies p
set
  titular_name = pr.full_name,
  titular_title = coalesce(nullif(trim(p.titular_title), ''), 'Pharmacien titulaire')
from public.pharmacy_staff ps
join public.profiles pr on pr.id = ps.user_id
where ps.pharmacy_id = p.id
  and ps.is_owner is true
  and pr.role = 'pharmacien'
  and (p.titular_name is null or trim(p.titular_name) = '')
  and pr.full_name is not null
  and trim(pr.full_name) <> '';
