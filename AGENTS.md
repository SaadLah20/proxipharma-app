<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Pharmeto — règles agent (slim)

Prod **`pharmeto.ma`**. Marque **Pharmeto** (ex-ProxiPharma). Dev : **`npm run dev:clean`**.

## Documentation (lire à la demande, pas tout d’un coup)

| Besoin | Fichier |
|--------|---------|
| Contexte onboarding / Supabase | `CONTEXTE.md` §6 |
| Spec produit + journal sessions | `CAHIER_DES_CHARGES.md` — §0.1, §4.4–§4.6, §10, §11, §12 |
| Reprise sans tâche | `CAHIER_DES_CHARGES.md` §13.35 |
| Reprise courte (infra à jour) | §13.71 (menu profil pharmacien), §13.70 (titres dossier patient), §13.69 (TDB pharmacien), §13.67 (hubs + footers), §13.66 (WhatsApp lot 3), §13.65 (inbox), §13.64 (expiration passage), §13.63 (photos catalogue), §13.62 (général), §13.61 (catalogue) |
| Livraison git/PR (utilisateur non dev) | `.cursor/rules/delivery-workflow-user.mdc` |
| WhatsApp notifs | `docs/WHATSAPP-NOTIFS-REPRISE.md`, `RUNBOOK.md` §10 |
| Runbook ops | `RUNBOOK.md` |

**Ne pas réécrire le détail produit** sans relire les sections pertinentes du cahier. **Ne pas** empiler migrations SQL hors `supabase/migrations/` sans demander.

## Migrations Supabase (ancre pilote)

Appliquer dans l’ordre `YYYYMMDD_*` jusqu’à **`20260836_001`** (tableau de bord pharmacien v2 ; après **`20260835_001`** signalements admin form + **`20260834_001`** avis patients hub).

Piège : **`20260503_007`** (policy profiles) ≠ **`20260505_007`** (codes publics). **`20260718_001`** + **`20260718_002`** = deux runs. **`20260819_001`** puis **`20260819_002`**.

## Règles métier critiques

- **Workflow dossier** : après validation patient → **`confirmed`** (réservé/commandé) → **`treated`** (comptoir, RPC **`pharmacist_mark_request_treated`**). Hub **`in_progress_virtual`** si **`confirmed`** + **`post_confirm_fulfillment`** avancé. Détail §4.4, amendements **`request_supply_amendments`**.
- **Expiration `responded`** : validation patient sous **24 h** (`expire_overdue_requests`, rappel patient T−4 h, alerte pharmacien T−1 h). Défaut cron ; test : **`EXPIRE_RESPONDED_SILENCE`**.
- **Expiration passage `treated`** : sans retrait comptoir ni modification date → **`abandoned`** (`auto_abandon_after_pickup_window`) — fin **J+1 23:59** Casablanca si pas d’heure, sinon **passage + 24 h**. RPC cron **`abandon_overdue_pickup_requests`** + rappels **`remind_planned_visit_passage`**. Migration **`20260823_001`** ; helper TS **`lib/planned-visit-abandon-deadline.ts`**. Ne pas confondre avec **`expired`** (pré-validation).
- **`post_confirm_fulfillment`** : envoyer **`unset`**, jamais **`null`** (NOT NULL). Clamp = dispo déduite du brouillon (`buildItemUpdatePayload`, **`inferredAvailabilityForPostConfirmClamp`**).
- **Post-validé pharmacien** : enregistrer via **Enregistrer les modifications** (`PharmacistSupplyCompactLine`) — pas d’auto-save comptoir.
- **Titres sections dossier** : buckets produit (`Patient*BucketSection`) — en-tête **14px**, barre **neutre** + filet gauche (`lib/patient-dossier-bucket-section-chrome.ts`) ; patient et pharmacien.
- **Types de demande** (`lib/request-kinds/`) : produits **sky**, ordonnances **amber**, consultations **violet**, promos **emerald**. Compte/officine = **`lib/platform-dashboard-chrome.ts`** (pas couleurs dossier). **Hub demandes unifié** : bandeau **`RequestUnifiedHubChrome`** ; parcours **`tous`** = accent plateforme (`PLATFORM_HUB_BANNER_SHELL`, pas `p.hero` avec padding) ; titre centré via **`unifiedHubTitleKey`** (rôle `pharmacien` → clé i18n `pharmacist`) ; liste **X/Y actives** (`HubListScopeCount`). Hubs : `patient-demandes-hub.tsx`, `pharmacist-demandes-hub.tsx` — plus **`PatientWorkflowHubHeader`** / **`PharmacistWorkflowHubHeader`** sur ces écrans.
- **Pricing** : médicament **PPV** ; parapharmacie PPH + marge −10 % à +40 % (produit > marque > global). Modal patient = **`lib/patient-responded-line-pricing.ts`**.
- **Rupture marché** : dispo **`market_shortage`** sur la ligne OK partout ; entrée hub **`market_shortages`** **uniquement** si la ligne a un **`product_id`** catalogue national (`pharmacy_product_id` seul → pas d’insert hub — migration **`20260829_001`**).
- **Mes produits** : « Supprimer » → `archived_hidden`, onglet **Supprimés** + **Restaurer** (`pharmacist_restore_pharmacy_product`, migrations **`20260830_001`** + **`20260831_001`** si `20260830` déjà appliquée).
- **Annuaire pilote** : public + nouveaux patients → **Al Jazira seule** (`public_listed` + RLS) ; test → **`pilot_access`** (`lib/annuaire/pilot-directory-access.ts`).
- **Refonte UX Glovo-like** : **ABANDONNÉE** — ne pas recréer. UI = affinages incrémentaux, preview PR.
- **Pilote en dev** : si plus simple, **proposer vidage** demandes (`CAHIER_DES_CHARGES.md` §0.1) plutôt que préserver jeux obsolètes.

## Code / CI

- **ESLint** : pas de **`setState` dans `useEffect`** pour resynchroniser un formulaire → sous-composant avec **`key={…}`** ou reset en rendu (ex. **`PromoReserveForm`**).
- **Auth locale** : tester **`/auth`** dans **Chrome/Edge**, pas le navigateur intégré IDE.
- **i18n patient** : FR/AR, CI **`npm run i18n:parity`**. Pharmacien/admin FR.

## Scripts utiles

- Vidage demandes : `supabase/scripts/clear-all-requests.sql` + `scripts/clear-request-private-media.mjs --confirm`
- Reset pilote : `supabase/scripts/reset-pilot-keep-products-single-admin.sql`
