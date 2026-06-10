# CONTEXTE.md : Pharmeto (ex-ProxiPharma)

> **Marque publique (juin 2026)** : **Pharmeto** — domaine prod **`pharmeto.ma`**. Le dépôt Git conserve le nom historique `proxipharma-app`. Détail rebrand : `CAHIER_DES_CHARGES.md` §10 session **2026-06-08**, `AGENTS.md`, `RUNBOOK.md` §11.

## 1. Vision du Produit
Pharmeto est une plateforme de transformation digitale visant à moderniser les pharmacies au Maroc. Le MVP (12 pharmacies pilotes) a pour objectif de valider un modèle de fidélisation patient et d'efficacité opérationnelle.
La philosophie directrice est la **"réduction de la friction"** : l'application doit être instantanée, mobile-first, et intégrer des usages familiers (WhatsApp) pour éviter toute barrière technologique.

## 2. Proposition de Valeur

### Pour le Pharmacien (Efficacité & Sérénité)
* **Réduction de la charge administrative :** Automatisation du pricing (moteur PPH) pour supprimer les saisies manuelles.
* **Protection opérationnelle :** Mécanismes de gestion des statuts pour éviter les commandes "fantômes" ou les stocks bloqués trop longtemps.
* **Pilotage de l'activité :** Dashboard temps réel pour monitorer la réactivité de l'équipe et le volume de demandes.
* **Maîtrise de l'image :** Digitalisation de la fiche pharmacie (services, horaires, garde) avec mise à jour instantanée.

### Pour le Patient (Simplicité & Transparence)
* **Fluidité du parcours :** Annuaire "zéro friction" permettant de localiser une pharmacie et de passer à l'action (Appel/WhatsApp) en un clic.
* **Visibilité totale :** Suivi clair du statut de commande (En cours > Préparation > Prêt) sans avoir à se déplacer.
* **Gestion des alternatives :** Interface simplifiée pour valider les propositions du pharmacien en cas d'indisponibilité d'un produit.

## 3. Architecture Fonctionnelle

* **Annuaire Public :** Portail de découverte géolocalisé. Recherche rapide, filtres de garde et accès direct aux outils de contact.
* **Espace Patient :** Interface transactionnelle de suivi. Gestion des demandes, historique, notifications d'état, et validation d'alternatives.
* **Espace Pharmacien :** Outil de production. Réception et traitement des demandes, gestion des prix, dashboard de performance et notifications prioritaires. Coordonnées patient (nom, WhatsApp) sur les demandes de sa pharmacie via **RPC** dédiés, sans lecture large cross-rôle sur `profiles`.
* **Espace Admin :** Dashboard fondateur. Vision panoramique sur le réseau (12 pharmacies), maintenance proactive, gestion de base de données et impersonation pour débogage.

## 4. Règles Métier & UX Clés
* **Bilinguisme natif (cible patient) :** Arabe standard + français — implémenté juin 2026 (`next-intl`, switcher header, RTL). Détail **`CAHIER_DES_CHARGES.md` §14**.
* **Approche "Mobile-First" :** Design au pouce, typographie lisible, réactivité instantanée (Optimistic UI).
* **Moteur de Pricing :** Centralisé et automatisé (basé sur le PPH). Aucune saisie manuelle de prix pour le pharmacien lors de la vente.
* **Système d'Alertes :** Notifications agressives côté pharmacien pour garantir la réactivité (< 15 min), couplées à des rappels automatiques côté patient pour les commandes en attente.

## 5. Principes de Développement
* **Modulabilité :** Chaque fonctionnalité doit être développée de manière isolée pour permettre des itérations rapides basées sur les retours terrain du pilote.
* **Stabilité :** Priorité absolue sur la fluidité des données entre les espaces Patient et Pharmacien.
* **Stack Technique :** Cursor (IDE), Supabase (Base de données), React + Tailwind (Frontend).

---

## 6. État technique récent (aligné repo — mai–juin 2026)

**Mise à jour 2026-06-09 (suite 4) — scroll + hint inline date de passage (validation patient)** :
- **`PatientProductRequestActions`** : si le patient clique **Valider ma demande** sans date (ou date hors plage), la page **défile** vers le bloc **Date de passage** (centré) et affiche un **message rouge sous le champ** — plus d’erreur invisible en haut du dossier ; même logique pour **Mettre à jour ma date de passage** post-validation.
- **`validatePatientConfirmBeforeReview`** : erreurs typées (`focus: visit_passage` | `top`) ; i18n **`common.visitDateRequiredToValidate`** ; **`PlannedVisitDateInput`** `invalid`.
- Commit **`58909d6`** · phrase reprise **`§13.57`** · journal **§10 session 2026-06-09 (suite 4)**.

**Mise à jour 2026-06-09 (suite 3) — typographie, i18n dossiers, nom/adresse arabe officine, lot ville reporté** :
- **Typographie FR** : **Plus Jakarta Sans** sur `<body>` locale FR (`app/layout.tsx`, `app/globals.css`) — commit **`6ddcbb6`**.
- **Header** : wordmark Pharmeto rapproché du logo (`gap-1.5`) — **`d7f719c`**.
- **i18n patient lot 1 (dossiers)** : actions dossier, contact rapide, chooser répondue, compact line, fallbacks hub — commits **`e6eb40e`**, fix import **`f79ad89`** ; parité FR/AR **1211** clés.
- **Nom / adresse arabe officine (livré)** : migration **`20260716_001`** (`nom_ar`, `adresse_ar`) ; admin onboarding + **Ma fiche → Coordonnées** (section arabe facultative) ; affichage patient locale **ar** avec repli FR — **`lib/pharmacy-localized-field.ts`**, **`pharmacyPublicLabel(..., { locale, nomAr })`** ; fiche publique, annuaire, Mes pharmacies, **bandeau dossier + hubs demandes/promo** — commits **`2eed65a`**, **`d092794`**, fix build tri hub **`8e8b47a`** (`collatorForLocale().compare`).
- **Reporté** : **ville** liste admin + libellés AR intégrés — spec **`§13.55`** ; esquisse locale annulée ; consigne : *« Reprendre l'implémentation de la ville en arabe »* — doc **`04929df`**.
- **SQL à appliquer** si pas fait : **`20260716_001`**. Phrase reprise **`§13.56`** · journal **§10 session 2026-06-09 (suite 3)**.

**Mise à jour 2026-06-09 (suite 2) — affinages preview drift / ordonnances / packs promo (branche `fix/validated-supply-ecart-ui-modal`, commits **`55336d2`** · **`9768bda`** · **`f38c90b`** · **`f45728e`)** :
- **Drift dossier patient** : bandeau **`RequestDetailStaleBanner`** **visible** sur **`confirmed → treated`** (consultation incluse) — fin auto-refresh silencieux ; polling **5 s**.
- **Ordonnances patient** : **`lib/patient-prescription-dossier-shell.ts`** — marge header→scan, stack scan / titre / bandeaux séparés.
- **Hub packs promo** : tableau de bord = **tuiles seules** (`PromoStatDashboard`) ; cartes liste sans texte sous statut ; groupes sans sous-titre.
- **Amendement validée** : statut dossier conservé ; hint court **`demandes.header.amendedHint`** + **Résumé** dans header.
- **SQL** : aucune migration. Phrase reprise **`CAHIER_DES_CHARGES.md` §13.54** · journal **§10 session 2026-06-09 (suite 2)**.

**Mise à jour 2026-06-09 — retours UI drift / archives / ordonnances / amendements (commit `1330407`)** :
- **Drift** : **`RequestDetailStaleBanner`**, i18n **`demandes.drift`**, archives **`demandes.archive.footer`**, dispo pharmacien adoucie, amendements dans **`PatientProductRequestDossierHeader`**.

**Mise à jour 2026-06-07 — charte pharmacien par type + barre basse (branche `fix/validated-supply-ecart-ui-modal`, commits **`6ee6630`** … **`f2875c0`)** :
- **Pharmacien** : hubs + dossiers **sky** (produits), **amber** (ordonnances), **violet** (consultations), **emerald** (packs promo) — libs **`pharmacist-*-hub-dashboard-ui.ts`** et **`pharmacist-*-request-line-ui.ts`** ; cartes hub **`PharmacistProductDemandeHubCard`** ; bandeau patient **`PharmacistPatientDossierBand`** (RPC CRM, pas `profiles` direct).
- **Barre basse** : **`PlatformBottomNav`** — 4 onglets dossiers ; menu profil allégé ; détail dossier = onglet actif selon **`request_type`**.
- **Patient** : bandeau officine **`ville · ref pharmacie`** ; menu profil sans Annuaire/Notifications (cloche OK).
- **SQL** : aucune migration. Phrase reprise **`CAHIER_DES_CHARGES.md` §13.51** · journal **§10 session 2026-06-07**.

**Mise à jour 2026-06-02 — demande produits patient §4.6 + pharmacien aligné (branche `fix/validated-supply-ecart-ui-modal`, commit **`773ad62`**)**
- **Patient** : parcours **envoyée → répondue → validée → traitée → archives** épuré (couleurs indicatives, groupes bucket, cartes séparées) ; répondue : alternatives **sans présélection**, barre **Retenir cette alternative** ; modales **`AppModalOverlay`** (notes ligne, z-index au-dessus footers sticky).
- **Pharmacien** : détail **`/dashboard/pharmacien/demandes/[id]`** même clarté — **`PharmacistProductRequestDossierHeader`**, groupes **`PharmacistValidatedBucketSection`**, cartes **`PharmacistSupplyCompactLine`**, archives **`PharmacistClosedProductBucketsView`**, hub **`PharmacistProductDemandeHubCard`** ; logique supply/post-validé **inchangée**.
- **SQL** : aucune migration. Phrase reprise **§13.36** (`CAHIER_DES_CHARGES.md` §10 session **2026-06-03 suite 3** + **2026-06-02 suite 2**).

### Références publiques mémorisables (migration `20260505_007_public_reference_codes.sql`)
Réduire la dépendance aux UUID pour les humains ; annuaire, support téléphonique et filtres peuvent utiliser des codes courts.

| Champ | Table | Exemple | Note |
|--------|--------|---------|------|
| `public_ref` | `pharmacies` | `PH001R` | PH + rang + lettre ville (Latin, sinon X) |
| `patient_ref` | `profiles` (rôle patient) | `P0007-K` | Affiché paramètres patient ; clients pharmacien |
| `request_public_ref` | `requests` | `D042/26` | Compteur **par officine + année** (fuseau Africa/Casablanca) |

Implémentation : séquences PostgreSQL, table `pharmacy_request_ref_counters`, triggers (trigger demande en **SECURITY DEFINER**). Si la signature **`RETURNS TABLE`** des RPC `pharmacist_patient_contact_for_request` / `pharmacist_patient_directory_for_my_pharmacy` change → **`DROP FUNCTION` puis `CREATE`** (sinon erreur **`42P13`**). Front : **`lib/public-ref.ts`**, filtres hubs demandes patient/pharmacien, annuaire `/`.

### Chrome plateforme
`components/layout/platform-chrome.tsx` + `platform-header.tsx` + **`platform-bottom-nav.tsx`** : header fixe ; **dossiers = barre basse** (4 types D/O/C/packs) ; menu profil = pharmacies + paramètres (patient sans Annuaire/Notifications dans le menu — cloche in-app conservée). Redirection après auth : **`lib/post-auth-redirect.ts`**.

### Notifications & analytics pharmacie (migrations `20260505_003` … `006`)
Titres/corps contextuels (patient vs pharmacien) ; événements **`pharmacy_engagement_events`** pour vues/clics fiche ; dashboard pharmacien (Recharts) avec repli si table absente (`lib/pharmacy-engagement.ts`). Fallback nom patient dans le trigger d’émission si **`full_name` vide** (**`20260505_006`**, fichier SQL daté même jour).

### Types de demande — ordonnances & consultations libres (mise à jour 2026-05-17)
- **Registre** : **`lib/request-kinds/`** + UI partagée **`components/requests/shared/`** ; détail patient/pharmacien routé par type.
- **Ordonnances** : capture **`/pharmacie/[id]/demande-ordonnance`** ; saisie pharmacien via scan + modal (**qté prescrite / qté dispo**, rupture/indispo → **dispo 0**, complémentaires = **qté proposée** seule) ; badges **Ordonnance** / **Ordonnance + alternative** / **Proposé** ; enregistrement post-validé compare la **branche alternative retenue** (`supplyRowPersistedSupplyFields` dans **`app/dashboard/pharmacien/demandes/[id]/page.tsx`**) ; hubs ambre ; migrations **`20260525_001`**–**`004`**, **`20260526_001`**, **`20260530_001`**, **`20260531_001`** ; synthèse **`docs/workflow-ordonnance-consultation-REPONSES.md`**.
- **Consultations libres** : **`/pharmacie/[id]/consultation-libre`** (texte + 3 photos) ; détail pharmacien = onglets **Conversation / Produits** puis parcours produits post-réponse ; charte **violet** hubs + dossier pharma (**juin 2026**, **`f2875c0`**) ; patient hubs violet ; migration **`20260529_001`** ; `workflowEnabled: true`.
- **Demande produits** : notif pharmacien dédiée si patient change la date de passage — **`20260531_002`**.
- **Phrase de reprise** : **`CAHIER_DES_CHARGES.md` §13.36** (patient bandeau officine + pharmacien validée/traitée/archives ; voir §10 session **2026-06-03 suite 3**).

**Mise à jour 2026-05-19 — annuaire + fiche publique (UI)** :
- **Annuaire** : hero, cartes avec **avis**, menu rayon portail, lint **`set-state-in-effect`** corrigé — `components/annuaire/`.
- **Fiche** : chrome partagé **`pharmacy-public-chrome.tsx`** ; onglets Services / Offres / Horaires / Infos harmonisés ; demande produits + catalogue alignés.
- **Badge Ouverte / Fermée** (mai 2026, commit **`e7540d3`**) : rouge uniforme pour **Fermée** et libellés « fermé » — **`lib/pharmacy-open-status-ui.ts`** (annuaire, fiche, édition **`horaires-garde`**).

**Mise à jour 2026-05-19 — moteur de pricing officine** :
- **SQL** : **`20260619_001`** + **`20260713_001`** (règles **marque**, remplace laboratoire) — **appliquer **`20260713_001`** si l’onglet Marques pricing absent**.
- **UI** : **`/dashboard/pharmacien/pricing`** ; **médicament = PPV fixe** ; **parapharmacie = PPH + marge** (global / marque / produit) via **`lib/pharmacy-pricing/`**.

**Mise à jour 2026-06-06 — hub réservations packs promo** :
- Hubs **`/dashboard/patient/packs-promo`** et **`/dashboard/pharmacien/reservations-packs`** : onglets tableau de bord + liste (5 statuts, cartes hub, filtres) — analogie demandes produits. *(Tableau de bord épuré — tuiles seules — voir **2026-06-09 (suite 2)**.)*
- Préfixe **Pharmacie** sur nom officine (cartes pack, notifs patient).
- **Pharmacien emerald (juin 2026)** : thème hub/détail + noms patient via RPC annuaire (**`load-pharmacist-promo-patient-contacts.ts`**).

**Mise à jour 2026-05-19 — packs promo + horaires** :
- **SQL** : **`20260610_001`** — offres/réservations packs, refs **`P042/26`**, **`promo_in_app_notifications`** (workflow isolé des demandes D/O/C).
- **UI** : `offres-promos`, `reservations-packs`, `packs-promo`, onglet Offres fiche publique, cloche header fusionnée.
- **Horaires** : `pharmacy-weekly-hours-tab` (grille mobile corrigée, teintes par jour), fériés **`lib/morocco-public-holidays.ts`**, garde **`lib/pharmacy-on-call-compute.ts`**.

**Mise à jour 2026-06-05 (suite 3) — i18n patient ar/fr + fix ordonnance validée** :
- **i18n** : **`next-intl`**, cookie **`pp_locale`**, switcher header, RTL locale ar, **`messages/fr.json`** + **`messages/ar.json`** ; pharmacien/admin FR uniquement ; migration **`20260709_001`** (notifs in-app **`title_ar`** / **`body_ar`**). Détail **`CAHIER_DES_CHARGES.md` §14** · phrase reprise **§13.42**.
- **Ordonnance validée (pharmacien)** : dispo **À commander** → champ **Réception prévue** visible/obligatoire en édition supply (`pharmacistSupplyDraftNeedsReceptionDate`, **`effectiveAvailSupplyDraft`**).

**Mise à jour 2026-06-05 — consultation libre, messages vocaux, ordonnance (lots 1 + 2)** :
- **Consultation libre UX** (commits **`c507609`**, **`081fc02`**) : en-têtes dossier, fil scrollable + auto-scroll bas, brief hors zone messages, onglet **Produits** après réponse pharma, refresh notif validée, retrait badges « Produit », archive sans **`RequestKindHeader`** doublon ; migration **`20260705_001`** (notif 1er message chat).
- **Messages vocaux fil dossier** (commit **`ea54827`**) : **`ConversationComposer`** — enregistrement/lecture **30 s max** (FAB modal + inline consultation) ; migration **`20260706_001`** (colonnes audio, Storage, RLS, notifs).
- **Messages vocaux envoi initial** (commit **`cb90da3`**) : bouton **Vocal** sur saisie patient (**demande produits**, **ordonnance**, **consultation libre**) via **`ConversationMessageDraftField`** — même limite **30 s**, envoyé au submit comme premier message dossier.
- **Fix MIME Storage vocal** (commit **`fa897de`**) : migration **`20260707_001`** — bucket **`private-media`** accepte **`audio/webm`** et autres MIME audio (sinon erreur à l’upload).
- **Ordonnance pharmacien** (commit **`6cb3160`**) : retours UX saisie/réponse ; migrations **`20260707_002`** (note patient → conversation + drift), **`20260708_001`** (pas notif « mise à jour » au premier attach scan).
- **Ordonnance / consultation archive patient** : bandeau dossier seul (plus récap header doublon). Phrase reprise **§13.42**.

**Mise à jour 2026-06-06 — catalogue médicaments officine + marques parapharmacie** :
- **Médicaments** : Excel officine (**TVA = 0**) → **`convert-medicaments-xlsx.py`** + **`import-medicaments-officine.mjs`** (additif, ne vide pas la para). Pilote : **6 026** lignes (`product_type = medicament`, PPH/PPV, sans photo). Doc **`scripts/README-medicaments-officine.md`**. **Catalogue total ~19 677** (13 651 para + 6 026 méd.).
- **Marques para** : extraction **`extract-product-brands.py`** v2.1 appliquée Supabase — **~93,65 %** sur BeautyMall ; colonnes **`brand`** / **`brand_confidence`** (**`20260710_001`**) ; pricing par marque (**`20260713_001`**). Phrase reprise **§13.45**.

**Mise à jour 2026-06-04 — catalogue BeautyMall (CSV + import pilote + aperçu photo)** :
- **Sitemap** : `scripts/fetch-beautymall-sitemap-products.mjs` → `beautymall_sitemap_products.csv` (~13,5k URLs).
- **Fusion** : `scripts/merge-beautymall-products.mjs` (ou Python RapidFuzz) → `products_final.csv` + `products_unmatched.csv` (~**89 %** matchs, **1 478** sans URL).
- **Import Supabase** : `wipe-catalog-beautymall-import.sql` puis `import-beautymall-catalog.mjs` — **13 651** produits, **12 171** photos URL BeautyMall, **`full_description`** HTML ; pas de migration Git.
- **UI** : clic vignette produit (patient + pharmacien) → modale photo + description (`736100f`). Phrase reprise **§13.39**.

**Mise à jour 2026-06-03 — ordonnances UI = demandes produits** :
- **Commit `721c991`** : thème **ambre**, libellés **Ordonnance** / **qté prescrite**, historique saisie officine, hubs cartes produits, scan pharma au-dessus des lignes ; migrations **`20260703_001`**, **`20260703_002`**.
- **Vidage tests** : `supabase/scripts/clear-all-requests.sql` + `clear-request-private-media.mjs --confirm` (garde catalogue + photos officines). Phrase **§13.37**.

**Mise à jour 2026-06-01 — demandes produits + ordonnance alignée** :
- **Commit `aec8fad`** : UI saisie patient, notes, ordre lignes pharma post-validé, footer clôture + modal, libellés patient validé/traité ; migration notifs **`20260601_001`**.
- **Ordonnance** : après réponse pharma = parcours produits ; lignes scan → **`patient_request`** ; compléments → **`pharmacist_proposed`** ; **`PrescriptionScanCollapsible`**.

### Workflow « demande de produits » après validation patient (**`confirmed`** — mai 2026)
Sans migration dédiée pour l’historique structuré : le patient voit ce qu’il a **validé** vs la **préparation actuelle** ; l’historique peut inclure **`audit_v1:`** dans `reason` (voir **`lib/patient-request-history-audit.ts`**, **`CAHIER_DES_CHARGES.md`** §4.4 + §4.5 et journal §10 **2026-05-06** / **2026-05-07**). Côté officine : plafonds qté, alternatives retenues vs indicatif, lignes fermées lecture seule, brouillon conservé au rechargement. Compteur **Annulés** patient : lignes **`cancelled_at_counter`**. Réinitialiser les demandes de test : **`supabase/scripts/clear-all-requests.sql`** puis **`clear-request-private-media.mjs --confirm`** (voir **`CAHIER_DES_CHARGES.md` §0.1**). Canvas E2E : **`canvases/product-requests-e2e-test-plan.canvas.tsx`**.

**Mise à jour 2026-05-25 — patient demande produits (envoyée → traitée, UI)** :
- Branche **`fix/validated-supply-ecart-ui-modal`** (commits **`e37f667`** … **`449debd`**) ; migration **`20260625_001`** si revalidation patient (`patient_update_confirmation`).
- **Répondue** : **`patient-responded-line-chooser.tsx`** + **`lib/patient-responded-line-buckets.ts`** (groupes ; titre produit seul).
- **Validée** : cartes **`PatientValidatedCompactLineCard`** ; blocs sky/teal ; **`PatientPharmaUpdateBanner`** ; modifier validation + footer ambre ; **`lib/patient-validated-line-labels-fr.ts`**.
- **Traitée** : deux blocs réservés/commandés ; passage **`patientPlannedVisitPassageLineFr`** sous en-tête ; pastilles réception/reçu colorées ; détail **`CAHIER_DES_CHARGES.md` §10 session 2026-05-25 (suite)** · phrase **§13.33**.

**Mise à jour 2026-05-24 — catalogue photos Storage + saisie patient** :
- **SQL** : **`20260524_001`**–**`003`** — buckets Storage, catalogue pilote MAROC, `products.photo_url` = chemin `products/{uuid}/main.jpg`.
- **`lib/storage-media.ts`** : URLs publiques pour vignettes ; **`mapRequestItemsPhotos`** sur détail demande patient/pharmacien.
- **Patient** : **`demande-produits`** + **`demande-produits/catalogue`** (multi-sélection) ; **`lib/patient-demande-produits-draft.ts`** ; lien catalogue en **modification** demande **`submitted`/`in_review`**.
- **Scripts** : **`attach-catalog-images.mjs`** (`node --use-system-ca` sous Windows si TLS) ; **`reset-pilot-catalog`**.

**Mise à jour 2026-05-17 — notes ligne pharmacien + auth OTP** :
- **Pharmacien** : **`components/pharmacist/pharmacist-line-conversation-chip.tsx`** — **Confirmer la note** (plus d’insertion `"OK"` dans **`pharmacist_comment`**) ; commit **`06a4413`**.
- **Auth** : renvoi OTP inscription **`shouldCreateUser: false`** ; OTP peut passer par **WhatsApp Verify** ; doublons **`auth.users`** → reset pilote (demandes + suppression Auth).

**Mise à jour 2026-06-01 — annuaire public (`/`)** :
- Barre recherche **sticky** sous le header ; hero vert retiré sur mobile ; bandeau slate + image filigrine sur `sm+` ; cartes avec actions en pied (plus de rail photo). Fichiers : `annuaire-page.tsx`, `annuaire-pharmacy-card.tsx`.

**Mise à jour 2026-06-01 — hubs 8 statuts + charte menus compte** :
- **Hubs** (produits / ordonnances / consultations, patient + pharmacien) : **`RequestKindHubDashboard`** — **8 statuts** en premier (`DemandeStatDashboard`), reprise rapide, raccourcis par activité ; filtres liste **`hub-list-filter-chrome.ts`** (neutre).
- **Charte compte** : **`PatientAccountPageHeader`**, **`PharmacistAccountPageHeader`**, **`platform-dashboard-chrome.ts`** sur pharmacies, paramètres, packs promo, notifications, hubs ; menu **Notifications** + annuaire (patient).
- **Tableau de bord pharmacien** : grille **8 statuts** (tous types) après KPI prioritaires. Détail dossier : accents type inchangés. Phrase reprise **§13.37**.

**Mise à jour 2026-06-01 — FAB Conversation (détail dossier patient/pharmacien)** :
- **`RequestConversationFabDock`** : glisser pour déplacer ; plafond haut = **`PlatformHeader`** (`data-proxipharma-platform-header`) ; position session + défaut au-dessus footer sticky — **`lib/conversation-fab-position.ts`**, **`request-conversation-panel.tsx`**. Consultation libre : messagerie inline (pas de FAB).

**Mise à jour 2026-06-01 — refonte UX Glovo-like abandonnée** :
- Branche **`design/ux-refonte-2026`** (commits **`3b189a7`**, **`89b35d1`**, jamais mergés) : **abandonnée** ; branche distante **supprimée**. Ne pas recréer ce lot « big bang ».
- **UI/UX** : affinages **écran par écran** sur **`fix/validated-supply-ecart-ui-modal`**. Phrase ouverture sans tâche : **§13.35**.

**Mise à jour 2026-05-29 — pharmacien compte, charte officine, post-validé (migrations pilote à jour)** :
- **Mes paramètres** : `/dashboard/pharmacien/parametres`, `pharmacist-settings-page.tsx` ; menu **Mes paramètres**.
- **En-tête charte** : `PharmacistAccountPageHeader` + `platform-dashboard-chrome.ts` sur écrans compte/officine (hors détail dossier sky/amber/violet).
- **Hubs demandes** : `RequestKindHubDashboard` (8 statuts en tête) — `lib/pharmacist-product-hub-sections.ts` / `lib/patient-product-hub-sections.ts` pour raccourcis indicatifs.
- **Post-validé** : brouillon différé, clôture partielle `20260630_001`, `lib/pharmacist-counter-closure.ts` ; vue répondue alternatives en lecture seule.
- **Supabase** : toutes migrations appliquées jusqu’à **`20260630_001`**. Phrase reprise **§13.36**.

**Mise à jour 2026-05-25 — hub compte patient (demandes produits, pharmacies, paramètres)** :
- **Hub** `/dashboard/demandes` : **`RequestKindHubDashboard`** (8 statuts, reprise rapide, raccourcis) — `patient-demandes-hub.tsx`, `lib/patient-product-hub-sections.ts`.
- **Mes pharmacies** : `20260626_001`, `/dashboard/patient/pharmacies`, RPC annuaire enrichi — `lib/patient-pharmacy-crm.ts`.
- **Mes paramètres** : `/dashboard/patient/parametres`, suppression compte `app/api/patient/delete-account/route.ts` ; chrome compte `lib/platform-dashboard-chrome.ts`. Phrase reprise **§13.36**.

**Mise à jour 2026-05-14 — détail patient demande produits (parcours `submitted` → `treated`)** :
- **`app/dashboard/demandes/[id]/PatientProductRequestActions.tsx`**, **`app/dashboard/demandes/[id]/page.tsx`** : récap **`PatientSentEnvoyeeSummaryCard`** pour **envoyée / répondue / validée / traitée** ; en-tête page principal masqué aussi pour **`confirmed` / `treated`** ; section **Produits** + pieds fixes homogènes (resubmit, validation **répondue**, **validée/traitée** : total + **Mettre à jour ma date de passage** actif seulement si **passage modifié** — **`visitPassageDirty`** ; resync **`initialPlannedVisit*`** sans **`useEffect`+`setState`** pour ESLint **`react-hooks/set-state-in-effect`**). Validation **répondue** sans date : scroll bloc passage + hint inline (**`58909d6`**).
- Cartes validées / traitées **`PatientValidatedCompactLineCard`** : photo ~62px, historique, note, titre, qté, PU/Tot ; bandeau pastilles sous la carte (**`lib/patient-validated-line-labels-fr.ts`**) — plus de pastilles dispo ni suivi inline sur la carte (voir §10 **2026-05-25**).

**Mise à jour 2026-05-13 — expiration `responded`, notifs comptoir, supply alternative choisie** :
- **SQL** : **`20260515_001`** (pas de notif in-app pour **`counter_outcome:picked_up`**) ; **`expire_overdue_requests(interval)`** : défaut **24 h** après **`responded_at`** (**`20260523_001`**, remplace pilote 30 min **`20260516_001`**) + passe **`expires_at`** ; cron **`service_role`** ou **`/api/cron/expire-overdue-requests`**.
- **SMS hors-app (mai 2026)** : patient **`responded` / `treated`** ; ref dossier ; **`20260522_001`**–**`002`** ; garde inscription téléphone **`20260522_003`**.
- **Pharmacien** : **`app/dashboard/pharmacien/demandes/[id]/page.tsx`** — brouillon supply / date « à commander » / clamp **`post_confirm_fulfillment`** alignés sur la branche **alternative choisie** via les helpers draft (voir journal §10).
- **Patient — historique** : **`lib/patient-request-history-audit.ts`** — codes **`auto_expire_after_response_silence`**, **`expire_overdue_requests`**, **`auto_expire_24h_after_response`**.
- **Préférence dev** : accepter de **vider la base** de test si cela évite des migrations ou hacks uniquement pour conserver d’anciennes lignes.

**Mise à jour 2026-05-09 — patient après validation + pharmacien post-validé + migrations `20260509_*`** :
- **Patient** — **`lib/build-patient-line-timeline-fr.ts`**, **`PatientProductRequestActions.tsx`**, **`app/dashboard/demandes/[id]/page.tsx`** : cartes compactes retenues / non retenues, modal **Historique** par ligne, **`request_status_history`** en parallèle du détail ; badge **« Ajout officine »** pour toute ligne **`pharmacist_proposed`** (aligné suivi patient, **`lib/supply-line-post-confirm.ts`**) ; le journal par ligne peut encore cibler l’amendement **`line_added_after_confirm`** quand présent ; vignettes produit **carrées 11×11** sur les cartes validées.
- **Pharmacien** — **`app/dashboard/pharmacien/demandes/[id]/page.tsx`** + **`components/pharmacist/pharmacist-supply-compact-line.tsx`** : après **`confirmed` / `processing` / `treated`**, liste **compacte** (menu ⋮ : modifier, écarter, historique) ; **brouillon** global jusqu’à **Enregistrer les modifications** (dont **`post_confirm_fulfillment`**, **`withdrawn_after_confirm`**, **`counter_outcome`** par ligne) ; **écarter** sans modal dédié — bloc orange canal/description + annuler l’écart ; **comptoir** réduit à **En attente** / **Récupéré** (legacy « plus tard » / annulation ligne lus comme en attente jusqu’à prochain enregistrement) ; ligne **récupérée** en base **non modifiable** ; clôture comptoir si **au moins une** ligne retenue **récupérée**, avec **confirmation** si d’autres lignes sont encore en attente ; bannières **sans suite** (motif depuis historique statut) et **clôturé** (nombre de récupérés). Modales **`PharmacistSupplyAmendmentConfirmModal`**, historique ligne **`LineHistoryModalFr`** ; libs **`lib/patient-line-suivi-fr.ts`**, **`lib/patient-pharma-change-notice-fr.ts`** selon écrans.
- **SQL** — **`20260509_001_arrived_reserved_fulfillment.sql`** (flux fulfillment / RPC alignés avec la simplification « disponible » côté reçu) ; **`20260509_002_pharmacist_notifications_exclude_actor.sql`** : notifications in-app **pharmacien** sans **auto-notifier** l’auteur de la transition (**`request_status_history.changed_by`**).
- **Lots hubs / répondue** : **`demande-hub-ui.tsx`**, **`updated_at`** sur hubs ; **`responded`** → **Répondue - à valider** ; vue répondue figée sans **Réagir** hors **Modifier**.

**Mise à jour 2026-05-11 — catalogue + saisie « demande produits » pharmacie** :
- **SQL** : **`20260511_001`** … **`20260512_001`** (voir **`CAHIER_DES_CHARGES.md`** §10 session 2026-05-11 et §11) — photos **`products.photo_url`** alignées sur le catalogue MAROC (noms longs) + extension démo **`seed_ma_catalog_v2`**.
- **Recherche produits** : **`lib/product-catalog-search.ts`** (nom **ou** laboratoire, limite 48) sur **`demande-produits`**, **`PatientProductRequestActions`**, détail pharmacien.
- **UI saisie** : **`app/pharmacie/[id]/demande-produits/page.tsx`** — libellés sections, **Qté**, **`PriceDhInline`** (PU/Tot / total sans coupure), modale confirmation alignée.
- **Reset tests** : **`supabase/scripts/clear-all-requests.sql`** (voir commentaire fichier).

### Affinages workflow demandes (sessions 2026-05-07)
Migrations **`20260507_001` … `005`** :
- **`001`** — règles **abandon / annulation / expiré** (batch 24 h désormais → **`expired`** au lieu de `abandoned`) + RPC **`patient_create_followup_from_expired_product_request`** (resoumettre une demande expirée).
- **`002`** — motifs d’annulation au comptoir (`client_request` / `pharmacy_unable`) + détail libre, RPC `pharmacist_set_item_counter_outcome` étendue.
- **`003`** — RPC **`pharmacist_cancel_request`** (annulation totale par la pharmacie, motif obligatoire).
- **`004`** — raisonnement notifications in-app (mise à jour patient vs nouvelle demande, annulation pharmacien, **`expired`** côté officine).
- **`005`** — après **`confirmed`** : **`post_confirm_fulfillment`** par ligne (`unset` / `reserved` / `ordered`) + RPC **`patient_update_planned_visit_after_confirmation`** + **`pharmacist_set_post_confirm_fulfillment`** ; ajustements triggers notifs. Les **hubs** passent à **« En traitement »** (`in_progress_virtual`) **uniquement** quand au moins une ligne est réservée ou commandée ; sinon libellés **« Validée par vous »** / **« Validée par le client »** (`lib/demandes-hub-buckets.ts`).

UI :
- « **Disponible partiellement** » est dérivé automatiquement (jamais saisi) ; lignes **proposées par la pharmacie** restreintes à `Disponible` / `À commander`.
- Détail patient : « Ce que vous avez validé » et « Suivi officine » à **parité de champs** (qté / dispo / prix / état) ; **« En cours »** placeholder tant que `counter_outcome === 'unset'` ; pas de blocs pour les lignes décochées par le patient.
- Historique : **auteur** (Vous / La pharmacie / Système, helper `historyActorLabel`) + **date** (`formatDateTimeShort24hFr`) sur chaque entrée.
- Heure de passage : input **texte 24 h** (HH:MM) avec normaliseur `parseFreeTime24h`.
- Resubmit patient : quantités via **+/−** ; bouton « Modifier » ↔ « Annuler les modifications » (reset complet) ; « Mettre à jour et renvoyer » caché tant que pas en mode édition.

### Livraison & Q35 externe
Branche **`fix/rls-recursion`** ; dernier lot demandes-produits documenté en **journal §10** (sessions **2026-05-08** / **2026-05-09**, commit **`33c68ef`** et suivants — voir **`git log`**). File **`notification_external_queue`** (**`20260505_001`**) — envoi réel via **`/api/cron/send-external-emails`** et secrets Vercel (voir **`RUNBOOK.md`**).