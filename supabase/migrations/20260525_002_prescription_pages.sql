-- Ordonnance : 2 pages max (page 1 = prescription_image_url, page 2 = page_2_path).

alter table public.prescription_requests
  add column if not exists page_2_path text;

alter table public.prescription_requests
  alter column prescription_image_url drop not null;

comment on column public.prescription_requests.prescription_image_url is
  'Chemin Storage page 1 (private-media/ordonnances/{request_id}/…).';
comment on column public.prescription_requests.page_2_path is
  'Chemin Storage page 2 optionnelle (max 2 pages par demande).';
