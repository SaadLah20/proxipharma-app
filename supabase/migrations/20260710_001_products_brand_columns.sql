-- Colonnes marque pour le catalogue parapharmacie (extraction Beautymall)
-- Safe to run multiple times (IF NOT EXISTS).
-- Pilote juin 2026 : deja appliquee avant 1re passe extract-product-brands.py (~83,6 % couverture).
-- Reprise v2 (~92 % dry-run) : voir scripts/README-product-brands.md — pas de changement DDL.

alter table public.products
  add column if not exists brand text;

alter table public.products
  add column if not exists brand_confidence integer
  check (brand_confidence is null or brand_confidence in (0, 50, 80, 100));

create index if not exists products_brand_idx on public.products (brand);
create index if not exists products_brand_confidence_idx on public.products (brand_confidence);

comment on column public.products.brand is 'Marque détectée automatiquement (script extract-product-brands.py)';
comment on column public.products.brand_confidence is 'Score confiance extraction marque : 100, 80, 50, 0';
