-- E-mail de contact public facultatif pour affichage côté patient (lien mailto).
alter table public.pharmacies add column if not exists contact_email text;

comment on column public.pharmacies.contact_email is
'Adresse e-mail de contact officine pour patients (facultatif, non vérifiée automatiquement).';
