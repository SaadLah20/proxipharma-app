-- Reset pilote : demandes + produits, puis catalogue 31 lignes seulement.
-- SQL Editor Supabase (rôle service / postgres). Une seule exécution.
--
-- Ensuite : photos dans catalog/images/ → node scripts/attach-catalog-images.mjs

begin;

update public.request_items
set patient_chosen_alternative_id = null
where patient_chosen_alternative_id is not null;

delete from public.requests;
delete from public.pharmacy_request_ref_counters;
delete from public.market_shortages;
delete from public.products;

insert into public.products (name, price_pph, price_ppv, product_type, laboratory, category, subcategory, photo_url, is_active)
values
  ('Doliprane 1000 mg, 8 comprimés', 38.90, 49.90, 'medicament', 'SANOFI', 'ma_catalog_photos', 'doliprane-1000', null, true),
  ('Paracétamol Biopharma 500 mg, 16 cp', 12.40, 16.00, 'medicament', 'BIOCODEX', 'ma_catalog_photos', 'paracetamol-biopharma', null, true),
  ('Maxilase sirop pédiatrique 200 ml', 64.80, 79.90, 'medicament', 'SANOFI', 'ma_catalog_photos', 'maxilase-sirop', null, true),
  ('Vogalène Flash 10 comprimés', 71.90, 89.00, 'medicament', 'PIERRE FABRE', 'ma_catalog_photos', 'vogalene-flash', null, true),
  ('Smecta oranges-vanilles, 10 sachets', 108.90, 134.90, 'medicament', 'IPSEN', 'ma_catalog_photos', 'smecta', null, true),
  ('Maalox menthe suspension 250 ml', 58.70, 72.00, 'medicament', 'SANOFI', 'ma_catalog_photos', 'maalox', null, true),
  ('Gaviscon anis sachets, 24 sachets', 219.90, 269.90, 'medicament', 'RB', 'ma_catalog_photos', 'gaviscon', null, true),
  ('Bisolvon sirop enfants', 94.70, 115.00, 'medicament', 'SANOFI', 'ma_catalog_photos', 'bisolvon', null, true),
  ('Motilium 10 mg filmoméprisibles, 10 cp', 48.65, 59.90, 'medicament', 'JANSSEN', 'ma_catalog_photos', 'motilium', null, true),
  ('Aerius anti-histaminique comprimés, 7 cp', 92.95, 114.90, 'medicament', 'MSD', 'ma_catalog_photos', 'aerius', null, true),
  ('Voltaren Emulgel tube 120 g', 179.95, 219.90, 'medicament', 'NOVARTIS', 'ma_catalog_photos', 'voltaren-emulgel', null, true),
  ('Flector Tissugel enveloppes, 10', 289.95, 349.00, 'medicament', 'SANOFI', 'ma_catalog_photos', 'flector', null, true),
  ('Ibuprofen 400 mg coop 20 cp', 19.95, 24.90, 'medicament', 'COOPER', 'ma_catalog_photos', 'ibuprofene-400', null, true),
  ('Spasfon lyoc 160 mg, 20 lyophilisés', 79.96, 98.90, 'medicament', 'MAYOLY', 'ma_catalog_photos', 'spasfon', null, true),
  ('Magnésium B6 coop 120 cp', 99.94, 122.90, 'medicament', 'COOPER', 'ma_catalog_photos', 'magnesium-b6', null, true),
  ('Vitamin C 500 mg coop 60 cp', 45.93, 55.90, 'medicament', 'COOPER', 'ma_catalog_photos', 'vitamine-c-500', null, true),
  ('Sérum physiologique 5 ml unidoses, boîte 40', 32.93, 39.90, 'parapharmacie', 'Gilbert', 'ma_catalog_photos', 'serum-physio', null, true),
  ('Eau distillée coop 250 ml', 9.93, 12.50, 'parapharmacie', 'COOPER', 'ma_catalog_photos', 'eau-distillee', null, true),
  ('Betadine derm solution 125 ml', 56.93, 69.90, 'medicament', 'MUNDIPHARMA', 'ma_catalog_photos', 'betadine', null, true),
  ('Savon dermatologique Dove Sensitive barre', 18.93, 22.90, 'parapharmacie', 'UNILEVER', 'ma_catalog_photos', 'dove-savon', null, true),
  ('Solaire enfants FPS 50+ spray 150 ml', 159.93, 199.90, 'parapharmacie', 'LA ROCHE-POSAY', 'ma_catalog_photos', 'solaire-enfant', null, true),
  ('Hydratant corps CeraVe 473 ml', 229.93, 279.90, 'parapharmacie', 'Cerave', 'ma_catalog_photos', 'cerave-hydratant', null, true),
  ('Listerine Fraîcheur 500 ml', 69.93, 85.90, 'parapharmacie', 'JH', 'ma_catalog_photos', 'listerine', null, true),
  ('Sensodyne Réparation toothpaste 75 ml', 59.93, 72.90, 'parapharmacie', 'HALEON', 'ma_catalog_photos', 'sensodyne', null, true),
  ('Optive yeux secs collyre multidose', 124.93, 152.90, 'medicament', 'ABBVIE', 'ma_catalog_photos', 'optive', null, true),
  ('Strepsils miel-citron, 24 pastilles', 79.93, 97.90, 'medicament', 'RB', 'ma_catalog_photos', 'strepsils', null, true),
  ('Thymotabs pastilles gorge 36', 92.93, 114.90, 'medicament', 'Cooper', 'ma_catalog_photos', 'thymotabs', null, true),
  ('Ventoline spray 100 µg, 200 doses', 129.93, 158.90, 'medicament', 'GSK', 'ma_catalog_photos', 'ventoline', null, true),
  ('Polaramine syrup 125 ml enfants', 42.93, 52.90, 'medicament', 'MSD', 'ma_catalog_photos', 'polaramine', null, true),
  ('Zyrtec 10 mg pelliculés boîte 7', 86.93, 105.90, 'medicament', 'UCB', 'ma_catalog_photos', 'zyrtec-10', null, true),
  ('Toplexil pédiatrique sirop allergies', 38.93, 47.90, 'medicament', 'SANOFI', 'ma_catalog_photos', 'toplexil', null, true);

commit;

-- Vérification :
-- select count(*) from products;  -- 31
-- select count(*) from requests;  -- 0
