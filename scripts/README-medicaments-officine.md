# Import médicaments officine (Excel TVA=0)

Ajoute les **médicaments** au catalogue Supabase **sans supprimer** la parapharmacie BeautyMall.

## Source

Fichier Excel type « Base de données médicaments » :

| Colonne | Usage |
|---------|--------|
| **Article** | `products.name` |
| **Ppv** | `products.price_ppv` |
| **Pph** | `products.price_pph` |
| **TVA** | `0` = médicament · `20` = parapharmacie (ignoré ici) |

Pilote : **~6 026** médicaments uniques (TVA=0, dédoublonnés).

## Étapes

```powershell
cd C:\Users\pc\Desktop\proxipharma-app

# 1. Excel → CSV
python scripts/convert-medicaments-xlsx.py "C:\Users\pc\Downloads\Base de données médicaments (1).xlsx"

# 2. Simulation
node scripts/import-medicaments-officine.mjs --dry-run

# 3. Import Supabase (additif)
node --use-system-ca scripts/import-medicaments-officine.mjs
```

## Champs en base

| Champ | Valeur |
|-------|--------|
| `product_type` | `medicament` |
| `category` | `medicaments_officine` |
| `photo_url` | `null` (icône UI) |
| `laboratory` | `null` |

**Pricing app** : médicament = **PPV fixe** (`lib/pharmacy-pricing/resolve.ts`).

## Re-import

Relancer l’import **met à jour les prix** des médicaments déjà présents (même nom + catégorie), sans dupliquer.

## Fichiers

| Fichier | Rôle |
|---------|------|
| `scripts/convert-medicaments-xlsx.py` | Excel → CSV |
| `scripts/import-medicaments-officine.mjs` | Écriture Supabase |
| `scripts/medicaments_officine.csv` | CSV généré (gitignored) |
