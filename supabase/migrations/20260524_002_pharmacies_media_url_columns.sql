-- Colonnes pour lier les photos officine au bucket public-assets (chemins ou URLs).
-- Ex. logo_url = 'pharmacies/{uuid}/logo.webp' → resolvePublicMediaUrl() côté app.

alter table public.pharmacies
  add column if not exists logo_url text,
  add column if not exists cover_url text;

comment on column public.pharmacies.logo_url is
'Chemin objet public-assets (pharmacies/{id}/logo.*) ou URL absolue.';

comment on column public.pharmacies.cover_url is
'Chemin objet public-assets (pharmacies/{id}/cover.*) ou URL absolue.';
