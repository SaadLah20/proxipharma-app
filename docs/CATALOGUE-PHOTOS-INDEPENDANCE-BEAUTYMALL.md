# Indépendance photos catalogue — reprise par étapes

Guide pour **vous** (non développeur) et pour **un agent Cursor** qui reprend le travail plus tard.

**Contexte (juin 2026)**  
- Catalogue déjà en base : **~13 651** parapharmacie + **~6 026** médicaments.  
- **Noms + descriptions** : déjà chez vous (Supabase) — **aucune dépendance BeautyMall**.  
- **Photos** : encore des **liens** `https://beautymall.ma/wp-content/...` en base (~**12 171** produits).  
- Script de sauvegarde locale livré : `scripts/download-beautymall-catalog-images.mjs`.  
- Test pilote : **3 images** déjà dans `catalog/images/` (validation OK).

**Objectif final** : photos hébergées sur **Supabase Storage** (`public-assets/products/{id}/main.*`), plus d’URL BeautyMall en `photo_url`.

---

## Vue d’ensemble (4 phases)

```
Phase 0  [FAIT]     Catalogue + script téléchargement créé
    ↓
Phase 1  [À FAIRE]  Télécharger ~12 171 images → dossier PC `catalog/images/`
    ↓
Phase 2  [À FAIRE]  Vérifier le téléchargement (comptes + échantillon visuel)
    ↓
Phase 3  [OPTION]   Pendant les tests app : ne rien changer (URLs BeautyMall OK)
    ↓
Phase 4  [PLUS TARD] Upload PC → Supabase Storage + bascule `photo_url` interne
    ↓
Phase 5  [PLUS TARD] Tester preview Vercel + merge PR
```

| Phase | Supabase Storage utilisé ? | App affiche quoi ? |
|-------|---------------------------|-------------------|
| 1–2 | Non | Rien ne change (BeautyMall) |
| 3 (tests) | Non | Toujours BeautyMall |
| 4–5 | Oui (~1–3 Go) | Vos photos Supabase |

---

## État d’avancement (à cocher)

- [x] Script `download-beautymall-catalog-images.mjs` créé  
- [x] Test dry-run + 3 images réelles OK  
- [x] `attach-catalog-images.mjs` accepte `--category beautymall_catalog`  
- [ ] **Téléchargement complet** `catalog/images/` (~12 171 fichiers)  
- [ ] Vérification post-téléchargement (manifeste + SQL)  
- [ ] Upload vers Supabase Storage (prod / plan adapté)  
- [ ] Test preview : photos catalogue patient + pharmacien  
- [ ] Merge PR → production  

---

## Phase 1 — Lancer le téléchargement complet

### Ce que vous faites

1. Ouvrir une **nouvelle conversation agent** (mode Agent, pas Ask).  
2. Copier-coller **exactement** le texte ci-dessous.

### Ce que vous dites à l’agent

```
On reprend l’indépendance photos BeautyMall.

Lis docs/CATALOGUE-PHOTOS-INDEPENDANCE-BEAUTYMALL.md — Phase 1.

Lance le téléchargement complet des photos catalogue en local :
  node --use-system-ca scripts/download-beautymall-catalog-images.mjs

Avant le lot complet : dry-run sur 10 produits pour confirmer que tout est OK.
Puis lance le lot complet en arrière-plan si possible.

Ne touche pas à Supabase Storage ni à photo_url en base.
À la fin : donne-moi le résumé (OK / ignorés / erreurs) et le chemin du journal.
```

### Ce que l’agent doit faire

| Action | Détail |
|--------|--------|
| Dry-run | `node --use-system-ca scripts/download-beautymall-catalog-images.mjs --dry-run` |
| Lot complet | `node --use-system-ca scripts/download-beautymall-catalog-images.mjs` |
| Durée | **2 à 8 h** — laisser tourner ; reprise auto si relancé |
| Windows | Toujours `node --use-system-ca` (certificat TLS) |

### Si le script s’arrête en cours de route

**Ce que vous dites à l’agent :**

```
Le téléchargement photos BeautyMall s’est arrêté. Relance la même commande
(node --use-system-ca scripts/download-beautymall-catalog-images.mjs) —
le script ignore les fichiers déjà présents. Donne-moi le bilan après reprise.
```

### Fichiers produits

| Fichier | Rôle |
|---------|------|
| `catalog/images/{slug}.jpg\|png\|webp` | Une image par produit (slug = `subcategory` en base) |
| `catalog/images/beautymall-download-log.jsonl` | Journal ligne par ligne |
| `catalog/images/beautymall-download-manifest.json` | Résumé du dernier run |

> Les images **ne sont pas** dans Git (`.gitignore`) — elles restent sur **votre disque**.

---

## Phase 2 — Vérifier après le téléchargement

### Ce que vous dites à l’agent

```
Phase 2 du guide docs/CATALOGUE-PHOTOS-INDEPENDANCE-BEAUTYMALL.md.

Vérifie que le téléchargement local des photos BeautyMall est complet :
- lis beautymall-download-manifest.json
- compte les fichiers dans catalog/images/
- compare avec ~12 171 attendus
- liste les erreurs dans beautymall-download-log.jsonl si échecs

Dis-moi si c’est suffisant pour passer à l’upload Storage ou s’il faut relancer.
```

### Critères de succès

| Indicateur | Attendu |
|------------|---------|
| Fichiers image dans `catalog/images/` | **~12 000+** (pas les 1 480 sans photo source) |
| `failed` dans le manifeste | **0** ou très faible (relancer si besoin) |
| Espace disque | **~1 à 3 Go** libérés |

### Vérification SQL optionnelle (Supabase → SQL Editor)

```sql
-- Produits encore liés à BeautyMall (normal AVANT phase 4)
select count(*) as urls_beautymall
from products
where photo_url ilike 'https://beautymall.ma/wp-content/%';
-- ~12 171 attendu tant que phase 4 pas faite
```

---

## Phase 3 — Pendant la phase de test (rien à faire)

L’app sur **preview Vercel** continue d’afficher les photos via les **URLs BeautyMall** en base.

- Vos copies dans `catalog/images/` = **assurance** si BeautyMall coupe.  
- **Pas besoin** du plan Pro Supabase pour cette phase.  
- **Aucune migration** Supabase à appliquer.

**Vous n’avez rien à dire à un agent** sauf si vous voulez tester l’app normalement.

---

## Phase 4 — Upload vers Supabase Storage (quand vous êtes prêts pour la prod)

**Prérequis**

1. Téléchargement local **terminé** (phase 2 OK).  
2. Espace Storage : comptez **~1 à 3 Go** → souvent **plan Pro Supabase** si &gt; 1 Go (free tier ~1 Go).  
3. `.env.local` avec `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.

### Ce que vous dites à l’agent

```
Phase 4 du guide docs/CATALOGUE-PHOTOS-INDEPENDANCE-BEAUTYMALL.md.

Les photos sont dans catalog/images/ (téléchargement local terminé).
Upload vers Supabase Storage et bascule photo_url pour le catalogue beautymall_catalog :

1. D’abord dry-run :
   node --use-system-ca scripts/attach-catalog-images.mjs --category beautymall_catalog --dry-run

2. Si OK, upload réel (même commande sans --dry-run).

Ne pas toucher aux médicaments (sans photo) ni aux photos officines pharmacies/.
À la fin : requête SQL de contrôle + combien de produits restent encore en URL BeautyMall.
```

### Ce que l’agent fait

| Étape | Commande |
|-------|----------|
| Simulation | `node --use-system-ca scripts/attach-catalog-images.mjs --category beautymall_catalog --dry-run` |
| Réel | `node --use-system-ca scripts/attach-catalog-images.mjs --category beautymall_catalog` |

Chaque fichier local `{slug}.*` est relié au produit dont `subcategory = slug`, uploadé en `public-assets/products/{id}/main.{ext}`, puis `photo_url` mis à jour en chemin interne.

### Vérification SQL après upload

```sql
-- Doit tendre vers 0
select count(*) as encore_beautymall
from products
where photo_url ilike 'https://beautymall.ma/wp-content/%';

-- Doit être ~12 171 (parapharmacie avec photo locale trouvée)
select count(*) as storage_interne
from products
where category = 'beautymall_catalog'
  and photo_url like 'products/%';

-- Produits sans photo (icône UI) — inchangé ~1 480
select count(*) as sans_photo
from products
where category = 'beautymall_catalog' and photo_url is null;
```

---

## Phase 5 — Tester sur preview et livrer

### Ce que vous dites à l’agent

```
Phase 5 du guide docs/CATALOGUE-PHOTOS-INDEPENDANCE-BEAUTYMALL.md.

Les photo_url catalogue beautymall_catalog pointent vers Supabase Storage.
Commit + push sur la branche de feature, PR vers main si besoin.
Indique-moi l’URL preview Vercel.

Je testerai : catalogue patient, fiche produit (modale photo), dossier pharmacien.
```

### Ce que **vous** testez sur la preview

- [ ] Catalogue patient : vignettes s’affichent  
- [ ] Clic vignette → modale photo + description  
- [ ] Recherche catalogue pharmacien : même rendu  
- [ ] Produit sans photo → icône générique (normal)

### Ce que **vous** faites ensuite (livraison habituelle)

1. Attendre la **preview Vercel**.  
2. Tester.  
3. GitHub → **Merge** la PR si tout est bon.  
4. **Pas de migration SQL** pour cette bascule photos (Storage + UPDATE `photo_url` seulement).

---

## Phrase de reprise globale (nouvel agent, contexte perdu)

Si vous rouvrez le sujet dans plusieurs semaines :

```
On reprend Pharmeto — indépendance photos catalogue BeautyMall.
Lis docs/CATALOGUE-PHOTOS-INDEPENDANCE-BEAUTYMALL.md et dis-moi à quelle phase on en est
(en regardant catalog/images/beautymall-download-manifest.json et les photo_url en base).
Puis exécute la prochaine phase du guide.
```

---

## Dépannage rapide

| Problème | Solution |
|----------|----------|
| Erreur certificat TLS (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`) | Préfixer avec `node --use-system-ca` |
| Script interrompu | Relancer la même commande (reprise auto) |
| `Manque SUPABASE_SERVICE_ROLE_KEY` | Vérifier `.env.local` ou utiliser `--source csv` |
| Upload Storage timeout | Relancer `attach-catalog-images.mjs` (upsert) |
| Photos absentes en app après phase 4 | Vérifier SQL `photo_url like 'products/%'` + bucket `public-assets` public |

---

## Fichiers techniques (référence agent)

| Fichier | Rôle |
|---------|------|
| `scripts/download-beautymall-catalog-images.mjs` | Phase 1 — téléchargement local |
| `scripts/attach-catalog-images.mjs` | Phase 4 — upload Storage + UPDATE BDD |
| `scripts/README-beautymall-catalog.md` | Chaîne CSV / import catalogue |
| `lib/storage-media.ts` | Résolution URL (`resolvePublicMediaUrl`) |
| `catalog/images/` | Dossier images locales (gitignored) |

---

## Rappel : ce qui ne dépend pas de BeautyMall

Déjà **autonome** en base Supabase :

- noms (`products.name`)  
- prix (`price_pph`, `price_ppv`)  
- descriptions (`full_description`)  
- marques (`brand`)  

Seules les **photos** passent par BeautyMall tant que la phase 4 n’est pas faite.
