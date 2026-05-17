# Catalogue pilote — parcours complet

## Étape A — Reset (demandes + produits → 31 lignes seulement)

**Option 1 — SQL Editor Supabase** (recommandé si tu es déjà dans l’éditeur)  
Exécuter **tout** le fichier :  
`supabase/scripts/reset-pilot-catalog.sql`

**Option 2 — Terminal** (`.env.local` avec `SUPABASE_SERVICE_ROLE_KEY`) :

```powershell
cd c:\Users\pc\Desktop\proxipharma-app
node scripts/reset-pilot-catalog.mjs
```

Vérification :

```sql
select count(*) from products;   -- 31
select count(*) from requests;   -- 0
```

*(Optionnel)* Vider les anciennes images Storage : Supabase → Storage → `public-assets` → supprimer le dossier `products/` si présent.

---

## Étape B — Tes photos

Dossier **`catalog/images/`** — un fichier par ligne du tableau ci-dessous  
(ex. `doliprane-1000.webp`)

| Fichier | Produit |
|---------|---------|
| `doliprane-1000` | Doliprane 1000 mg, 8 comprimés |
| `paracetamol-biopharma` | Paracétamol Biopharma 500 mg, 16 cp |
| `maxilase-sirop` | Maxilase sirop pédiatrique 200 ml |
| `vogalene-flash` | Vogalène Flash 10 comprimés |
| `smecta` | Smecta oranges-vanilles, 10 sachets |
| `maalox` | Maalox menthe suspension 250 ml |
| `gaviscon` | Gaviscon anis sachets, 24 sachets |
| `bisolvon` | Bisolvon sirop enfants |
| `motilium` | Motilium 10 mg filmoméprisibles, 10 cp |
| `aerius` | Aerius anti-histaminique comprimés, 7 cp |
| `voltaren-emulgel` | Voltaren Emulgel tube 120 g |
| `flector` | Flector Tissugel enveloppes, 10 |
| `ibuprofene-400` | Ibuprofen 400 mg coop 20 cp |
| `spasfon` | Spasfon lyoc 160 mg, 20 lyophilisés |
| `magnesium-b6` | Magnésium B6 coop 120 cp |
| `vitamine-c-500` | Vitamin C 500 mg coop 60 cp |
| `serum-physio` | Sérum physiologique 5 ml unidoses, boîte 40 |
| `eau-distillee` | Eau distillée coop 250 ml |
| `betadine` | Betadine derm solution 125 ml |
| `dove-savon` | Savon dermatologique Dove Sensitive barre |
| `solaire-enfant` | Solaire enfants FPS 50+ spray 150 ml |
| `cerave-hydratant` | Hydratant corps CeraVe 473 ml |
| `listerine` | Listerine Fraîcheur 500 ml |
| `sensodyne` | Sensodyne Réparation toothpaste 75 ml |
| `optive` | Optive yeux secs collyre multidose |
| `strepsils` | Strepsils miel-citron, 24 pastilles |
| `thymotabs` | Thymotabs pastilles gorge 36 |
| `ventoline` | Ventoline spray 100 µg, 200 doses |
| `polaramine` | Polaramine syrup 125 ml enfants |
| `zyrtec-10` | Zyrtec 10 mg pelliculés boîte 7 |
| `toplexil` | Toplexil pédiatrique sirop allergies |

---

## Étape C — Relier photos → Storage + BDD

```powershell
node scripts/attach-catalog-images.mjs
```

Test sans écriture : `node scripts/attach-catalog-images.mjs --dry-run`

---

## Étape D — Tester l’app

Créer une demande produits, vérifier les vignettes au choix catalogue.
