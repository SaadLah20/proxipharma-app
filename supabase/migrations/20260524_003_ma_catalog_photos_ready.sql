-- Catalogue MAROC ~31 produits : données en base, photos à fournir ensuite.
-- subcategory = nom du fichier image (sans extension) dans catalog/images/
-- category = ma_catalog_photos pour scripts/attach-catalog-images.mjs
-- Idempotent par name (une seule requête MERGE).

merge into public.products as p
using (
  select *
  from (
    values
      ('Doliprane 1000 mg, 8 comprimés', 'doliprane-1000', 38.90::numeric, 49.90::numeric, 'medicament', 'SANOFI'),
      ('Paracétamol Biopharma 500 mg, 16 cp', 'paracetamol-biopharma', 12.40::numeric, 16.00::numeric, 'medicament', 'BIOCODEX'),
      ('Maxilase sirop pédiatrique 200 ml', 'maxilase-sirop', 64.80::numeric, 79.90::numeric, 'medicament', 'SANOFI'),
      ('Vogalène Flash 10 comprimés', 'vogalene-flash', 71.90::numeric, 89.00::numeric, 'medicament', 'PIERRE FABRE'),
      ('Smecta oranges-vanilles, 10 sachets', 'smecta', 108.90::numeric, 134.90::numeric, 'medicament', 'IPSEN'),
      ('Maalox menthe suspension 250 ml', 'maalox', 58.70::numeric, 72.00::numeric, 'medicament', 'SANOFI'),
      ('Gaviscon anis sachets, 24 sachets', 'gaviscon', 219.90::numeric, 269.90::numeric, 'medicament', 'RB'),
      ('Bisolvon sirop enfants', 'bisolvon', 94.70::numeric, 115.00::numeric, 'medicament', 'SANOFI'),
      ('Motilium 10 mg filmoméprisibles, 10 cp', 'motilium', 48.65::numeric, 59.90::numeric, 'medicament', 'JANSSEN'),
      ('Aerius anti-histaminique comprimés, 7 cp', 'aerius', 92.95::numeric, 114.90::numeric, 'medicament', 'MSD'),
      ('Voltaren Emulgel tube 120 g', 'voltaren-emulgel', 179.95::numeric, 219.90::numeric, 'medicament', 'NOVARTIS'),
      ('Flector Tissugel enveloppes, 10', 'flector', 289.95::numeric, 349.00::numeric, 'medicament', 'SANOFI'),
      ('Ibuprofen 400 mg coop 20 cp', 'ibuprofene-400', 19.95::numeric, 24.90::numeric, 'medicament', 'COOPER'),
      ('Spasfon lyoc 160 mg, 20 lyophilisés', 'spasfon', 79.96::numeric, 98.90::numeric, 'medicament', 'MAYOLY'),
      ('Magnésium B6 coop 120 cp', 'magnesium-b6', 99.94::numeric, 122.90::numeric, 'medicament', 'COOPER'),
      ('Vitamin C 500 mg coop 60 cp', 'vitamine-c-500', 45.93::numeric, 55.90::numeric, 'medicament', 'COOPER'),
      ('Sérum physiologique 5 ml unidoses, boîte 40', 'serum-physio', 32.93::numeric, 39.90::numeric, 'parapharmacie', 'Gilbert'),
      ('Eau distillée coop 250 ml', 'eau-distillee', 9.93::numeric, 12.50::numeric, 'parapharmacie', 'COOPER'),
      ('Betadine derm solution 125 ml', 'betadine', 56.93::numeric, 69.90::numeric, 'medicament', 'MUNDIPHARMA'),
      ('Savon dermatologique Dove Sensitive barre', 'dove-savon', 18.93::numeric, 22.90::numeric, 'parapharmacie', 'UNILEVER'),
      ('Solaire enfants FPS 50+ spray 150 ml', 'solaire-enfant', 159.93::numeric, 199.90::numeric, 'parapharmacie', 'LA ROCHE-POSAY'),
      ('Hydratant corps CeraVe 473 ml', 'cerave-hydratant', 229.93::numeric, 279.90::numeric, 'parapharmacie', 'Cerave'),
      ('Listerine Fraîcheur 500 ml', 'listerine', 69.93::numeric, 85.90::numeric, 'parapharmacie', 'JH'),
      ('Sensodyne Réparation toothpaste 75 ml', 'sensodyne', 59.93::numeric, 72.90::numeric, 'parapharmacie', 'HALEON'),
      ('Optive yeux secs collyre multidose', 'optive', 124.93::numeric, 152.90::numeric, 'medicament', 'ABBVIE'),
      ('Strepsils miel-citron, 24 pastilles', 'strepsils', 79.93::numeric, 97.90::numeric, 'medicament', 'RB'),
      ('Thymotabs pastilles gorge 36', 'thymotabs', 92.93::numeric, 114.90::numeric, 'medicament', 'Cooper'),
      ('Ventoline spray 100 µg, 200 doses', 'ventoline', 129.93::numeric, 158.90::numeric, 'medicament', 'GSK'),
      ('Polaramine syrup 125 ml enfants', 'polaramine', 42.93::numeric, 52.90::numeric, 'medicament', 'MSD'),
      ('Zyrtec 10 mg pelliculés boîte 7', 'zyrtec-10', 86.93::numeric, 105.90::numeric, 'medicament', 'UCB'),
      ('Toplexil pédiatrique sirop allergies', 'toplexil', 38.93::numeric, 47.90::numeric, 'medicament', 'SANOFI')
  ) as v(name, slug, price_pph, price_ppv, product_type, laboratory)
) as c
on p.name = c.name
when matched then
  update set
    category = 'ma_catalog_photos',
    subcategory = c.slug,
    price_pph = c.price_pph,
    price_ppv = c.price_ppv,
    product_type = c.product_type,
    laboratory = c.laboratory,
    photo_url = null,
    is_active = true
when not matched then
  insert (name, price_pph, price_ppv, product_type, laboratory, category, subcategory, photo_url)
  values (c.name, c.price_pph, c.price_ppv, c.product_type, c.laboratory, 'ma_catalog_photos', c.slug, null);

comment on column public.products.subcategory is
'Pilote catalogue : peut contenir le slug fichier photo (ex. doliprane-1000) quand category = ma_catalog_photos.';
