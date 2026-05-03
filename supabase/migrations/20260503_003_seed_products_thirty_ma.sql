-- Référentiel démo MAROC : ~30 produits avec PPH fictifs (MAD), idempotent par nom.
-- À appliquer une fois après les migrations produits ; n’efface aucune donnée existante.

insert into public.products (name, price_pph, price_ppv, product_type, laboratory, category)
select v.name, v.price_pph, v.price_ppv, v.product_type, v.lab, 'seed_ma_catalog_v1'
from (
  values
    ('Doliprane 1000 mg, 8 comprimés', 38.90::numeric, 49.90::numeric, 'medicament', 'SANOFI'),
    ('Paracétamol Biopharma 500 mg, 16 cp', 12.40::numeric, 16.00::numeric, 'medicament', 'BIOCODEX'),
    ('Maxilase sirop pédiatrique 200 ml', 64.80::numeric, 79.90::numeric, 'medicament', 'SANOFI'),
    ('Vogalène Flash 10 comprimés', 71.90::numeric, 89.00::numeric, 'medicament', 'PIERRE FABRE'),
    ('Smecta oranges-vanilles, 10 sachets', 108.90::numeric, 134.90::numeric, 'medicament', 'IPSEN'),
    ('Maalox menthe suspension 250 ml', 58.70::numeric, 72.00::numeric, 'medicament', 'SANOFI'),
    ('Gaviscon anis sachets, 24 sachets', 219.90::numeric, 269.90::numeric, 'medicament', 'RB'),
    ('Bisolvon sirop enfants', 94.70::numeric, 115.00::numeric, 'medicament', 'SANOFI'),
    ('Motilium 10 mg filmoméprisibles, 10 cp', 48.65::numeric, 59.90::numeric, 'medicament', 'JANSSEN'),
    ('Aerius anti-histaminique comprimés, 7 cp', 92.95::numeric, 114.90::numeric, 'medicament', 'MSD'),
    ('Voltaren Emulgel tube 120 g', 179.95::numeric, 219.90::numeric, 'medicament', 'NOVARTIS'),
    ('Flector Tissugel enveloppes, 10', 289.95::numeric, 349.00::numeric, 'medicament', 'SANOFI'),
    ('Ibuprofen 400 mg coop 20 cp', 19.95::numeric, 24.90::numeric, 'medicament', 'COOPER'),
    ('Spasfon lyoc 160 mg, 20 lyophilisés', 79.96::numeric, 98.90::numeric, 'medicament', 'MAYOLY'),
    ('Magnésium B6 coop 120 cp', 99.94::numeric, 122.90::numeric, 'medicament', 'COOPER'),
    ('Vitamin C 500 mg coop 60 cp', 45.93::numeric, 55.90::numeric, 'medicament', 'COOPER'),
    ('Sérum physiologique 5 ml unidoses, boîte 40', 32.93::numeric, 39.90::numeric, 'parapharmacie', 'Gilbert'),
    ('Eau distillée coop 250 ml', 9.93::numeric, 12.50::numeric, 'parapharmacie', 'COOPER'),
    ('Betadine derm solution 125 ml', 56.93::numeric, 69.90::numeric, 'medicament', 'MUNDIPHARMA'),
    ('Savon dermatologique Dove Sensitive barre', 18.93::numeric, 22.90::numeric, 'parapharmacie', 'UNILEVER'),
    ('Solaire enfants FPS 50+ spray 150 ml', 159.93::numeric, 199.90::numeric, 'parapharmacie', 'LA ROCHE-POSAY'),
    ('Hydratant corps CeraVe 473 ml', 229.93::numeric, 279.90::numeric, 'parapharmacie', 'Cerave'),
    ('Listerine Fraîcheur 500 ml', 69.93::numeric, 85.90::numeric, 'parapharmacie', 'JH'),
    ('Sensodyne Réparation toothpaste 75 ml', 59.93::numeric, 72.90::numeric, 'parapharmacie', 'HALEON'),
    ('Optive yeux secs collyre multidose', 124.93::numeric, 152.90::numeric, 'medicament', 'ABBVIE'),
    ('Strepsils miel-citron, 24 pastilles', 79.93::numeric, 97.90::numeric, 'medicament', 'RB'),
    ('Thymotabs pastilles gorge 36', 92.93::numeric, 114.90::numeric, 'medicament', 'Cooper'),
    ('Ventoline spray 100 µg, 200 doses', 129.93::numeric, 158.90::numeric, 'medicament', 'GSK'),
    ('Polaramine syrup 125 ml enfants', 42.93::numeric, 52.90::numeric, 'medicament', 'MSD'),
    ('Zyrtec 10 mg pelliculés boîte 7', 86.93::numeric, 105.90::numeric, 'medicament', 'UCB'),
    ('Toplexil pédiatrique sirop allergies', 38.93::numeric, 47.90::numeric, 'medicament', 'SANOFI')
) as v(name, price_pph, price_ppv, product_type, lab)
where not exists (select 1 from public.products p where p.name = v.name);
