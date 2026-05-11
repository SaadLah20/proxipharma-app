-- Seed demo products with Unsplash photos.
-- Inserted columns: `name`, `photo_url` (BDD), `product_type` (NOT NULL).
-- Idempotent by exact match on `name`.

insert into public.products (name, photo_url, product_type)
select
  v.name,
  v.photo_url,
  v.product_type
from (
  values
    ('Sérum physiologique 5 ml', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400', 'parapharmacie'),
    ('Thymotabs', 'https://images.unsplash.com/photo-1550572017-ed20015ade30?w=400', 'medicament'),
    ('Vogalène Flash', 'https://images.unsplash.com/photo-1471864190281-ad5f9f81ce4c?w=400', 'medicament'),
    ('Sensodyne Réparation', 'https://images.unsplash.com/photo-1559599141-38141c2a053c?w=400', 'parapharmacie'),
    ('Savon Dove', 'https://images.unsplash.com/photo-1600857062241-98e5dba7f214?w=400', 'parapharmacie'),
    ('Aerius', 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=400', 'medicament'),
    ('Flector Tissugel', 'https://images.unsplash.com/photo-1585435557343-3b092031a831?w=400', 'medicament'),
    ('Maxilase sirop', 'https://images.unsplash.com/photo-1587854692152-cbe660dbbb88?w=400', 'medicament'),
    ('Vitamine C 1000', 'https://images.unsplash.com/photo-1614859324967-bdf281f55515?w=400', 'medicament'),
    ('Strepsils', 'https://images.unsplash.com/photo-1550572017-4f1b2d399120?w=400', 'medicament'),
    ('Vitamin C 500', 'https://images.unsplash.com/photo-1576073719710-aa465040ca70?w=400', 'medicament'),
    ('Zyrtec 10 mg', 'https://images.unsplash.com/photo-1512069772995-ec65ed45afd6?w=400', 'medicament'),
    ('Listerine', 'https://images.unsplash.com/photo-1631729371254-42c2892f0e6e?w=400', 'parapharmacie'),
    ('Ibuprofen 400 mg', 'https://images.unsplash.com/photo-1626285861696-9f0bf5a49c6d?w=400', 'medicament'),
    ('Amoxicilline 1g', 'https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=400', 'medicament'),
    ('Motilium 10 mg', 'https://images.unsplash.com/photo-1471864190281-ad5f9f81ce4c?w=400', 'medicament'),
    ('Solaire enfants FPS 50+', 'https://images.unsplash.com/photo-1521223344201-d169129f7b7d?w=400', 'parapharmacie'),
    ('Ventoline spray', 'https://images.unsplash.com/photo-1596463059283-da258325d033?w=400', 'medicament'),
    ('Magnésium B6', 'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=400', 'medicament'),
    ('Gaviscon anis', 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=400', 'medicament'),
    ('Doliprane 1000mg', 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=400', 'medicament'),
    ('Toplexil pédiatrique', 'https://images.unsplash.com/photo-1587854692152-cbe660dbbb88?w=400', 'medicament'),
    ('Maalox menthe', 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=400', 'medicament'),
    ('Hydratant CeraVe', 'https://images.unsplash.com/photo-1626784215021-2e39ccf971cd?w=400', 'parapharmacie'),
    ('Eau distillée', 'https://images.unsplash.com/photo-1548839140-29a749e1cf3d?w=400', 'parapharmacie'),
    ('Paracétamol Biopharma', 'https://images.unsplash.com/photo-1471864190281-ad5f9f81ce4c?w=400', 'medicament'),
    ('Voltaren Emulgel', 'https://images.unsplash.com/photo-1585435557343-3b092031a831?w=400', 'medicament'),
    ('Optive yeux secs', 'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=400', 'medicament'),
    ('Smecta Sachets', 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=400', 'medicament'),
    ('Betadine derm', 'https://images.unsplash.com/photo-1581594693702-fbdc51b2ad49?w=400', 'medicament')
  ) as v(name, photo_url, product_type)
where not exists (
  select 1
  from public.products p
  where p.name = v.name
);

