# Extraction automatique des marques (catalogue BeautyMall)

Remplit les colonnes **`products.brand`** et **`products.brand_confidence`** à partir du nom, du slug Beautymall (`subcategory`) et de la description HTML (`full_description`).

**Prérequis** : Python 3.11+ · dépendances · migration Supabase **`20260710_001_products_brand_columns.sql`**.

```powershell
cd C:\Users\pc\Desktop\proxipharma-app
pip install -r scripts/requirements-product-brands.txt
```

Variables dans **`.env.local`** : `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (optionnel : `DATABASE_URL` pour bulk SQL plus rapide).

---

## Migration Supabase

Fichier : **`supabase/migrations/20260710_001_products_brand_columns.sql`**

Ajoute :

| Colonne | Type | Valeurs |
|---------|------|---------|
| `brand` | `text` | libellé affiché (ex. `La Roche-Posay`) |
| `brand_confidence` | `integer` | `100`, `80`, `50`, `0` |

**Pilote (juin 2026)** : migration **déjà appliquée** avant la 1re passe d’extraction. **Ne pas réexécuter** sauf si les colonnes n’existent pas.

Vérification SQL Editor :

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'products'
  and column_name in ('brand', 'brand_confidence');
-- 2 lignes attendues si migration OK

select
  count(*) filter (where brand is not null) as avec_marque,
  count(*) filter (where brand is null) as sans_marque,
  round(100.0 * count(*) filter (where brand is not null) / nullif(count(*), 0), 2) as couverture_pct
from products;
```

---

## Script

**Fichier** : **`scripts/extract-product-brands.py`**

Sources analysées :

- préfixe du **nom** (marques composées : La Roche-Posay, Dr Brown's, MGD Nature…)
- **slug** Beautymall (`subcategory` ou `url_produit` du CSV)
- **description** (`Marque:` dans le HTML)
- **packs / offres** (détection lot, coffret, promo, `1+1`…) → marque embarquée dans le nom ou slug

Scores de confiance :

| Score | Signification typique |
|-------|------------------------|
| **100** | nom + slug (ou nom + marque très fréquente) |
| **80** | nom ou slug seul, marque fiable |
| **50** | description, pack/offre, marque partielle |
| **0** | non identifié |

---

## Commandes

**Simulation locale** (CSV, aucune écriture Supabase) :

```powershell
python scripts/extract-product-brands.py --source csv --dry-run --preview-count 0
```

**Appliquer sur Supabase** (écrase `brand` / `brand_confidence` sur tous les produits lus) :

```powershell
python scripts/extract-product-brands.py --yes
```

**Audit des produits sans marque** :

```powershell
python scripts/extract-product-brands.py --source csv --audit-unidentified --preview-count 0
```

Sorties : **`scripts/brand-unidentified-audit.csv`**, **`scripts/brand-unidentified-patterns.json`**.

Rapport dry-run : **`scripts/brand-extraction-report.json`**.

---

## État au 2026-06-06 (session interrompue — reprise plus tard)

| Passe | Couverture | En base Supabase ? | Remarque |
|-------|------------|--------------------|----------|
| **v1** | **83,62 %** (~11 415 / 13 651) | **Oui** — 13 651 lignes mises à jour | Première extraction réussie |
| **v2** (améliorations code) | **~92,37 %** (~12 609 / 13 651) en dry-run CSV | **Non** | Script trop lent en local (~10–15 min+) ; **non relancé** sur Supabase |

**Améliorations v2 déjà dans le code** (pas encore poussées en prod données) :

- décodage entités HTML dans les noms (`L&rsquo;Oréal`, `&#038;`)
- marques composées (`Dr`, `MGD`, `Pro`, `Bio`…)
- packs / offres / lots (marque dans le nom ou le slug)
- seeds **`KNOWN_BRAND_DISPLAY`** élargis (Eluday, Elgydium, Bio-Oil, Wella…)
- mode **`--audit-unidentified`**
- index **`BrandMatcher`** (perf partielle — boucles description HTML encore lentes)

**Prochain jalon** (quand on reprend l’extraction) :

1. Valider dry-run v2 (couverture + échantillon qualité).
2. Relancer **`--yes`** sur Supabase (ou bulk via `DATABASE_URL`).

**Déjà livré côté app** (migration **`20260713_001`**) : pricing officine par **marque** (plus laboratoire) ; libellé marque dans le catalogue et les dossiers patient/pharmacien. Optionnel restant : filtre catalogue par `brand`.

---

## Fichiers liés

| Fichier | Rôle |
|---------|------|
| `scripts/extract-product-brands.py` | Script principal |
| `scripts/requirements-product-brands.txt` | Dépendances Python |
| `scripts/products_final.csv` | Source locale (même jeu que l’import catalogue) |
| `supabase/migrations/20260710_001_products_brand_columns.sql` | Colonnes BDD |

Chaîne catalogue amont : **`scripts/README-beautymall-catalog.md`**.

Journal projet : **`CAHIER_DES_CHARGES.md` §10 session 2026-06-06 (suite) — marques**.
