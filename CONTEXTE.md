# CONTEXTE.md : ProxiPharma
## 1. Vision du Produit
ProxiPharma est une plateforme de transformation digitale visant à moderniser les pharmacies au Maroc. Le MVP (12 pharmacies pilotes) a pour objectif de valider un modèle de fidélisation patient et d'efficacité opérationnelle.
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
* **Bilinguisme natif :** Support complet Arabe/Français avec détection automatique ou basculement fluide.
* **Approche "Mobile-First" :** Design au pouce, typographie lisible, réactivité instantanée (Optimistic UI).
* **Moteur de Pricing :** Centralisé et automatisé (basé sur le PPH). Aucune saisie manuelle de prix pour le pharmacien lors de la vente.
* **Système d'Alertes :** Notifications agressives côté pharmacien pour garantir la réactivité (< 15 min), couplées à des rappels automatiques côté patient pour les commandes en attente.

## 5. Principes de Développement
* **Modulabilité :** Chaque fonctionnalité doit être développée de manière isolée pour permettre des itérations rapides basées sur les retours terrain du pilote.
* **Stabilité :** Priorité absolue sur la fluidité des données entre les espaces Patient et Pharmacien.
* **Stack Technique :** Cursor (IDE), Supabase (Base de données), React + Tailwind (Frontend).

---

## 6. État technique récent (aligné repo — mai 2026)

### Références publiques mémorisables (migration `20260505_007_public_reference_codes.sql`)
Réduire la dépendance aux UUID pour les humains ; annuaire, support téléphonique et filtres peuvent utiliser des codes courts.

| Champ | Table | Exemple | Note |
|--------|--------|---------|------|
| `public_ref` | `pharmacies` | `PH001R` | PH + rang + lettre ville (Latin, sinon X) |
| `patient_ref` | `profiles` (rôle patient) | `P0007-K` | Affiché paramètres patient ; clients pharmacien |
| `request_public_ref` | `requests` | `D042/26` | Compteur **par officine + année** (fuseau Africa/Casablanca) |

Implémentation : séquences PostgreSQL, table `pharmacy_request_ref_counters`, triggers (trigger demande en **SECURITY DEFINER**). Si la signature **`RETURNS TABLE`** des RPC `pharmacist_patient_contact_for_request` / `pharmacist_patient_directory_for_my_pharmacy` change → **`DROP FUNCTION` puis `CREATE`** (sinon erreur **`42P13`**). Front : **`lib/public-ref.ts`**, filtres hubs demandes patient/pharmacien, annuaire `/`.

### Chrome plateforme
`components/layout/platform-chrome.tsx` + `platform-header.tsx` : header fixe, menus patient/pharmacien (demandes produits, ordonnances, consultations libres, etc.), cloche notifications in-app. Redirection après auth : **`lib/post-auth-redirect.ts`**.

### Notifications & analytics pharmacie (migrations `20260505_003` … `006`)
Titres/corps contextuels (patient vs pharmacien) ; événements **`pharmacy_engagement_events`** pour vues/clics fiche ; dashboard pharmacien (Recharts) avec repli si table absente (`lib/pharmacy-engagement.ts`). Fallback nom patient dans le trigger d’émission si **`full_name` vide** (**`20260505_006`**, fichier SQL daté même jour).

### Prochain chantier UX (hors bloc demande-produits déjà mature)
Les routes **ordonnances** et **consultations libres** (patient et pharmacien) sont des **placeholders** : développement ciblé **page par page** puis branchement métier.

### Workflow « demande de produits » après validation patient (**`confirmed`** — mai 2026)
Sans migration dédiée pour l’historique structuré : le patient voit ce qu’il a **validé** vs la **préparation actuelle** ; l’historique peut inclure **`audit_v1:`** dans `reason` (voir **`lib/patient-request-history-audit.ts`**, **`CAHIER_DES_CHARGES.md`** §4.4 + §4.5 et journal §10 **2026-05-06** / **2026-05-07**). Côté officine : plafonds qté, alternatives retenues vs indicatif, lignes fermées lecture seule, brouillon conservé au rechargement. Compteur **Annulés** patient : lignes **`cancelled_at_counter`**. Réinitialiser les données de test : **`scripts/clear-all-requests.mjs`** ou **`supabase/scripts/clear-all-requests.sql`**. Canvas de scénarios E2E : **`canvases/product-requests-e2e-test-plan.canvas.tsx`**.

**Mise à jour 2026-05-17 — notes ligne pharmacien + auth OTP** :
- **Pharmacien** : **`components/pharmacist/pharmacist-line-conversation-chip.tsx`** — **Confirmer la note** (plus d’insertion `"OK"` dans **`pharmacist_comment`**) ; commit **`06a4413`**.
- **Auth** : renvoi OTP inscription **`shouldCreateUser: false`** ; OTP peut passer par **WhatsApp Verify** ; doublons **`auth.users`** → reset pilote (demandes + suppression Auth).

**Mise à jour 2026-05-14 — détail patient demande produits (parcours `submitted` → `treated`)** :
- **`app/dashboard/demandes/[id]/PatientProductRequestActions.tsx`**, **`app/dashboard/demandes/[id]/page.tsx`** : récap **`PatientSentEnvoyeeSummaryCard`** pour **envoyée / répondue / validée / traitée** ; en-tête page principal masqué aussi pour **`confirmed` / `treated`** ; section **Produits** + pieds fixes homogènes (resubmit, validation **répondue**, **validée/traitée** : total + **Mettre à jour ma date de passage** actif seulement si **passage modifié** — **`visitPassageDirty`** ; resync **`initialPlannedVisit*`** sans **`useEffect`+`setState`** pour ESLint **`react-hooks/set-state-in-effect`**).
- Cartes validées **`PatientValidatedCompactLineCard`** : même gabarit visuel que la liste **envoyée** (bordure `rounded-xl`, photo **20×20**, grille **PU / Qté / Total** **`formatPriceDh`**, pastille **`availabilityStatusUi`**, badge **Réception** si **à commander**).

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