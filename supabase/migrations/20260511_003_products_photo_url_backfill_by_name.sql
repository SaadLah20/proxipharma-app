-- Backfill `photo_url` on rows that already existed when `20260511_002` ran.
-- That migration only INSERTs when `name` is absent; catalogue pré-rempli = pas de photo.
update public.products as p
set photo_url = v.photo_url
from (
  values
    ('Sérum physiologique 5 ml', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400'),
    ('Thymotabs', 'https://images.unsplash.com/photo-1550572017-ed20015ade30?w=400'),
    ('Vogalène Flash', 'https://images.unsplash.com/photo-1471864190281-ad5f9f81ce4c?w=400'),
    ('Sensodyne Réparation', 'https://images.unsplash.com/photo-1559599141-38141c2a053c?w=400'),
    ('Savon Dove', 'https://images.unsplash.com/photo-1600857062241-98e5dba7f214?w=400'),
    ('Aerius', 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=400'),
    ('Flector Tissugel', 'https://images.unsplash.com/photo-1585435557343-3b092031a831?w=400'),
    ('Maxilase sirop', 'https://images.unsplash.com/photo-1587854692152-cbe660dbbb88?w=400'),
    ('Vitamine C 1000', 'https://images.unsplash.com/photo-1614859324967-bdf281f55515?w=400'),
    ('Strepsils', 'https://images.unsplash.com/photo-1550572017-4f1b2d399120?w=400'),
    ('Vitamin C 500', 'https://images.unsplash.com/photo-1576073719710-aa465040ca70?w=400'),
    ('Zyrtec 10 mg', 'https://images.unsplash.com/photo-1512069772995-ec65ed45afd6?w=400'),
    ('Listerine', 'https://images.unsplash.com/photo-1631729371254-42c2892f0e6e?w=400'),
    ('Ibuprofen 400 mg', 'https://images.unsplash.com/photo-1626285861696-9f0bf5a49c6d?w=400'),
    ('Amoxicilline 1g', 'https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=400'),
    ('Motilium 10 mg', 'https://images.unsplash.com/photo-1471864190281-ad5f9f81ce4c?w=400'),
    ('Solaire enfants FPS 50+', 'https://images.unsplash.com/photo-1521223344201-d169129f7b7d?w=400'),
    ('Ventoline spray', 'https://images.unsplash.com/photo-1596463059283-da258325d033?w=400'),
    ('Magnésium B6', 'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=400'),
    ('Gaviscon anis', 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=400'),
    ('Doliprane 1000mg', 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=400'),
    ('Toplexil pédiatrique', 'https://images.unsplash.com/photo-1587854692152-cbe660dbbb88?w=400'),
    ('Maalox menthe', 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=400'),
    ('Hydratant CeraVe', 'https://images.unsplash.com/photo-1626784215021-2e39ccf971cd?w=400'),
    ('Eau distillée', 'https://images.unsplash.com/photo-1548839140-29a749e1cf3d?w=400'),
    ('Paracétamol Biopharma', 'https://images.unsplash.com/photo-1471864190281-ad5f9f81ce4c?w=400'),
    ('Voltaren Emulgel', 'https://images.unsplash.com/photo-1585435557343-3b092031a831?w=400'),
    ('Optive yeux secs', 'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=400'),
    ('Smecta Sachets', 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=400'),
    ('Betadine derm', 'https://images.unsplash.com/photo-1581594693702-fbdc51b2ad49?w=400')
) as v(name, photo_url)
where p.name = v.name
  and (p.photo_url is null or btrim(p.photo_url) = '');
