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

## Suite

Import Supabase / Storage : pas encore automatisé — voir `import-products-catalog.mjs` et le cahier §10 session 2026-06-04.

## Python (optionnel)

```bash
pip install -r scripts/requirements-beautymall-merge.txt
python scripts/merge_beautymall_products.py
```
