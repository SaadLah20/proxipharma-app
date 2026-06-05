# Export catalogue BeautyMall (CSV)

Chaîne en **2 étapes** (Node — pas de Python requis).

## 1. Sitemap → URLs produits

```bash
cd C:\Users\pc\Desktop\proxipharma-app
node scripts/fetch-beautymall-sitemap-products.mjs
```

**Sortie** : `scripts/beautymall_sitemap_products.csv`  
Colonnes : `slug`, `url_produit`, `url_image`

## 2. Fusion avec votre export WooCommerce

CSV principal par défaut :  
`C:\Users\pc\Downloads\wp-https___PRODUCTS PARA (1).csv`

```bash
node scripts/merge-beautymall-products.mjs
```

Autre chemin :

```bash
node scripts/merge-beautymall-products.mjs --main "C:\chemin\vers\votre-export.csv"
```

**Sorties** :

| Fichier | Contenu |
|---------|---------|
| `products_final.csv` | Toutes vos colonnes + `url_produit` + `url_image_valide` |
| `products_unmatched.csv` | Lignes sans match (score &lt; 85 %) |

## Résultat pilote (2026-06-04)

- 13 651 produits source  
- 12 173 correspondances (**89,17 %**)  
- 1 478 sans correspondance  

## 3. Import dans ProxiPharma (Supabase)

**Avant l’import** — dans Supabase → SQL Editor, exécuter tout le fichier :

`supabase/scripts/wipe-catalog-beautymall-import.sql`

(Si erreur de clé étrangère : exécuter d’abord `supabase/scripts/clear-all-requests.sql`.)

**Simulation** (aucune écriture) :

```bash
node scripts/import-beautymall-catalog.mjs --dry-run
```

**Import réel** (`.env.local` avec `SUPABASE_SERVICE_ROLE_KEY`) :

```bash
node --use-system-ca scripts/import-beautymall-catalog.mjs
```

Règles d’import :

| Champ BDD | Source |
|-----------|--------|
| `name` | `name` |
| `price_pph` | `sale_price` |
| `price_ppv` | `regular_price` |
| `product_type` | `parapharmacie` |
| `photo_url` | `url_image_valide` (BeautyMall) ; sinon `null` → icône produit dans l’app |
| `full_description` | `description` (HTML) |
| `subcategory` | slug extrait de `url_produit` |

Photos : les URLs BeautyMall restent externes pour l’instant. Migration progressive vers Storage = à prévoir (`import-products-catalog.mjs` comme modèle).

## Python (optionnel)

```bash
pip install -r scripts/requirements-beautymall-merge.txt
python scripts/merge_beautymall_products.py
```
