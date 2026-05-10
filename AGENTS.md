<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

Demande « produits » (MVP), ordre d’affinage UI par statut et règles dossiers figés : **`CAHIER_DES_CHARGES.md` §4.6**.

Après validation patient : statuts DB **`processing`** (préparation officine) et **`treated`** (préparation déclarée terminée, suivi comptoir), colonne **`request_items.withdrawn_after_confirm`**, table **`request_supply_amendments`** et RPC associées — voir **`CAHIER_DES_CHARGES.md` §4.4** et migration **`supabase/migrations/20260508_002_processing_treated_supply_workflow.sql`**. Le hub peut encore afficher **`in_progress_virtual`** quand le dossier est **`confirmed`** avec **`post_confirm_fulfillment`** sans passage en **`processing`**.

**UI patient (mai 2026, branche `fix/rls-recursion`)** — détail demande produits : après **`responded`**, ordre des lignes **`request_items`** comme la pharmacie ; libellé **`responded`** · **« Répondue - à valider »** ; réponse figée côté officine sans **Réagir** tant que pas **Modifier** ; message global pharmacien via **`request_comments`** ; hubs liste : cartes compactes + **`updated_at`** ; une fois **`confirmed` / `processing` / `treated`** : cartes courtes sur les **lignes validées** (groupement réservation / commande), **lignes non retenues** en **`<details>`** fermé par défaut, **Historique** par produit (modal + **`lib/build-patient-line-timeline-fr.ts`**, enrichi par **`request_status_history`** chargé en parallèle du détail dans **`page.tsx`**). Bandeau **Suivi** (réservation / commande / **`arrived_reserved`**) + ligne **Comptoir** : **`lib/patient-line-suivi-fr.ts`** · **`PatientLineSuiviStrip`** pour **`confirmed`**, **`processing`** et **`treated`**. Dossiers **terminés** (`cancelled`, `abandoned`, `expired`, `completed`, `partially_collected`, `fully_collected`) : bloc **`PatientRequestOutcomeBanner`** en tête + même grille de cartes compactes en **lecture seule** (**`ReadonlyArchivedProductBucketsView`** dans **`PatientProductRequestActions`**), **`request_status_history`** aussi chargé sur ces statuts. Badge **« Ajout officine »** : seulement **`pharmacist_proposed`** + amendement **`line_added_after_confirm`** (**`lib/supply-line-post-confirm.ts`**).

**Sauvegarde pharmacien post-validé** — **`post_confirm_fulfillment`** : envoyer l’enum **`unset`**, jamais **`null`** (colonne NOT NULL) ; pour une **alternative choisie**, le clamp à l’enregistrement utilise la dispo de la branche retenue (**`inferredAvailabilityForPostConfirmClamp`** dans **`app/dashboard/pharmacien/demandes/[id]/page.tsx`**).

**UI pharmacien post-validé** — **`app/dashboard/pharmacien/demandes/[id]/page.tsx`** + **`components/pharmacist/pharmacist-supply-compact-line.tsx`** : brouillon (réservé/commandé, écart, comptoir **en attente / récupéré**) validé par **Enregistrer les modifications** ; pas d’auto-save comptoir sur cette vue compacte ; migrations **`20260509_001`** / **`20260509_002`** si infra à jour.

**Ne pas réécrire tout le détail produit** sans relire **`CONTEXTE.md` §6** et **`CAHIER_DES_CHARGES.md` §4.4 + dernier §10 Journal + §13.10** (phrase de reprise type).
