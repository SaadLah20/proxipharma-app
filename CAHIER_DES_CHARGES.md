# Cahier des Charges - ProxiPharma (Document vivant)

Ce document sert de reference produit et technique entre nous.
Il doit etre mis a jour a chaque fin de session pour garder un historique clair des decisions.

## 0.1) Routine de collaboration (profil projet sans outillage lourd — a garder tel quel)

**But**: avancer plusieurs semaines sans perdre la vision, sans divergence BDD/code, avec peu d explications repetitives et sans dependre d une « connexion Supabase » Cursor (impossible sans secrets non versionnes).

Au **demarrage** d une session (copier-coller tolere ou paraphrase courte):
> Reprends ProxiPharma depuis `CONTEXTE.md`, `CAHIER_DES_CHARGES.md` (**§0.1**, **§11**, dernier bloc **§10 Journal**, **§12**) et continue la **feuille de route**. Ne dedouble pas les migrations hors fichiers dans `supabase/migrations/` sans me demander. Si tu touches Supabase : ordre des fichiers `YYYYMMDD_*`. **Ne pas confondre** : migration **`20260503_007`** = policy `profiles` (dangereuse seule, à annuler avec **`20260503_009`**) ; migration **`20260505_007`** = **codes publics** PH / P / D (refs mémorisables).

A la **sortie**: demander ou accepter la mise a jour de ce cahier (Journal + Etat actuel + prompt de reprise du §12).

**Ton role coté infra (minimal)**:
1. Appliquer tout nouveau fichier sous `supabase/migrations/` sur Supabase (ordre chronologique des noms).
2. `git commit` + `git push` quand l assistant indique une livraison groupee.
3. En cas d'erreur : copier-coller integralement le message (navigateur ou console).

**Ou est la verite du backend (schema)** : les migrations Git + les RPC/policies decrites dedans ; le SQL Editor hors migrations est reserve aux tests ponctuels mais ne remplace pas le fichier migre versionne dans le depot.

## 1) Vision produit

La fiche digitale pharmacie est l'espace digital principal offert a chaque pharmacie.
Elle est un point d'entree central pour les clients/patients et un levier de conversion vers les services en ligne.

Canaux d'acces a la fiche pharmacie:
- Scan QR code (vitrine, flyers)
- Lien "site web" depuis Google Business Profile
- Recherche dans l'annuaire de la plateforme puis clic sur la carte pharmacie

Note:
- Le nom de domaine/marque finale n'est pas encore fige (exemple actuel: `proxipharma.ma`).

## 2) Roles et responsabilites

- Invite/visiteur:
  - Consulte la fiche pharmacie publique
  - Voit informations, services, promos/offres
- Client/Patient connecte:
  - Envoie une demande via la fiche pharmacie (ordonnance, produits, consultation libre)
  - Suit ensuite ses demandes depuis l'espace client (pas dans la fiche pharmacie)
- Pharmacien:
  - Gere sa fiche depuis son espace pharmacien
  - Traite les demandes recues (saisie disponibilites, alternatives, reponse)
- Admin:
  - Supervision globale de la plateforme et moderation

## 3) Fiche digitale pharmacie - structure fonctionnelle

La page pharmacie comprend 3 volets principaux.

### 3.1 Informations

Contenu cible:
- Titulaire (Dr), photo
- Reviews/rating
- Boutons favoris, signaler, partager
- Distance par rapport a l'utilisateur
- Statut (ouvert, ferme, garde)
- Services proposes (depuis liste/BDD de services)
- Reseaux sociaux
- Telephone, WhatsApp
- Delai moyen de reponse

### 3.2 Services en ligne (volet principal)

Services:
1. Scanner une ordonnance
2. Demander des produits (base produits normalisee)
3. Consultation libre

Point cle:
- Les 3 services convergent vers le meme objectif:
  - Le client veut des informations de disponibilite/prix/quantites
  - Le pharmacien repond sous forme de liste de produits structuree

### 3.3 Promos et offres

- Volet commercial de la pharmacie
- Affichage public sur la fiche
- Gestion depuis espace pharmacien (details de workflow a cadrer plus tard)

## 4) Workflow metier central (demande -> reponse)

## 4.1 Cote client (sur fiche pharmacie)

Le client peut creer une demande de 3 types:
- Ordonnance scannee
- Demande de produits (ajout intelligent depuis base produits)
- Consultation libre

Regles:
- Dans "demander des produits", chaque produit est une carte:
  - Nom produit
  - Quantite (defaut 1, modifiable)
  - Prix (logique a preciser plus tard)
- Avant reponse pharmacien, le client peut modifier/annuler sa demande
- Le suivi detaille des demandes se fait dans l'espace client, pas dans la fiche pharmacie

### 4.2 Cote pharmacien (espace pharmacien)

Traitement d'une demande:
- Visualiser la demande (ordonnance, liste produits ou texte libre)
- Construire/reviser la liste produits
- Renseigner disponibilite pour chaque produit
- Ajouter des alternatives (jusqu'a 3 par produit)
- Envoyer la reponse au client

Disponibilites a gerer:
- Disponible
- Disponible partiellement (avec precision sur le reliquat)
- Indisponible
- A commander (avec date previsionnelle)
- En rupture du marche

### 4.3 Cote client apres reponse

Le client recoit une liste structuree:
- Produits principaux + alternatives eventuelles
- Etat de disponibilite detaille

Le client peut:
- Cocher/decocher produits
- Ajuster quantites
- Valider (reservation/preparation/commande) ou cloturer/annuler

Cas de rendu attendus:
1. Produit indisponible "marche": grise + decoche
2. Produit disponible: coche et validable
3. Produit a commander: coche, engage commande pharmacie
4. Produit en rupture: grise + mention notification future

## 5) Rupture du marche - logique specifique

Quand le pharmacien marque "rupture du marche":
- Le produit est ajoute dans une liste "produits en rupture" liee a cette pharmacie
- Le pharmacien peut retirer l'article de la liste quand il redevient disponible
- Les clients concernes sont notifies a la disponibilite

Note:
- Le systeme de notifications complet sera detaille dans un chantier dedie.

## 6) Espaces applicatifs cibles (vision)

### Espace client (vision donnee)
- Dashboard
- Mes pharmacies
- Liste de souhait
- Mes ordonnances
- Mes demandes de produits
- Mes consultations libres
- Parametres
- Notifications

### Espace pharmacien (vision donnee)
- Dashboard
- Ordonnances
- Demandes de produits
- Produits declares en rupture du marche
- Parametrage horaires et garde
- Ma fiche
- Mes clients
- Notifications
- Produits commandes
- Reviews
- Signalements
- Parametres
- Promos et offres

## 7) Perimetre produit - Sprint 2 (proposition de travail)

Objectif Sprint 2:
- Construire le socle fonctionnel de la fiche digitale cote client (creation de demande)
- Connecter le demarrage du workflow de traitement cote pharmacien
- Garantir la coherence data/roles des le depart

Dans Sprint 2, on vise:
- Fiche pharmacie: informations + CTA services en ligne
- Creation demande (3 types) depuis fiche
- Base produits integree pour saisie guidee
- Statuts de base de demande
- Preparation du schema de reponse pharmacien (meme si UI complete suivra par iter)

Hors Sprint 2 immediat (a cadrer apres):
- Workflow detaille de suivi dans espace client (UI complete)
- Notification systeme complet
- Promos/offres avancees
- UX polissage avancee

## 8) Strategie technique validee pour la suite

Ordre de travail recommande (et valide par nos echanges):
1. Cadrage fonctionnel cible d'une tranche
2. Schema BDD + regles metier (tables, relations, enums, contraintes)
3. RLS et securite acces par role
4. Migrations versionnees (`supabase/migrations`)
5. Execution guidee Supabase/Vercel/GitHub
6. Tests de verification
7. Implementation front/back
8. Validation fonctionnelle

Pourquoi:
- Evite les refontes UI dues a un schema instable
- Reduit les regressions
- Permet d'avancer vite avec une base solide

## 9) Decisions actees a date

- La fiche digitale est priorite produit numero 1
- Les 3 services en ligne convergent vers un format de reponse produit structure
- Le suivi des demandes ne se fait pas dans la fiche pharmacie
- Les workflows complets de suivi/statuts fins seront raffines apres le socle
- On maintient une approche DB-first pour les chantiers lourds
- Base produits: lecture publique et ecriture admin uniquement
- Modele demandes retenu: architecture hybride (1 tronc commun + tables specialisees)

### Apprentissages methodologiques récents (utiles ensuite)

- **Pas d acces Supabase continu pour l assistant Cursor**: pas de MCP / pas de `DATABASE_URL` dans le depot — la coherence repose sur **migrations versionnees + ce cahier** ; le role minimal cote humain: appliquer les migrations puis push quand demande.
- **Revision client après reponse** (`responded`|`confirmed`): remplace contenu lignes via RPC `patient_resubmit_product_request_after_response` puis retour **`submitted`**: **meme ligne `requests`**, meme URL detail ; ce n'est pas disparition dossier mais **nouveau cycle de traitement** (anciennes prep pharma purgees hors historique granularise — accepte pour MVP comme discute).
- **Traçabilité fine des anciennes réponses pharma par tour**: pas versionnee automatiquement aujourd hui (`request_snapshots` possible plus tard si litiges/reglementation le demandent — volontairement reporte tant que MVP operationnel prime).
- **Retrait physique**: vérité fonctionnelle côté **pharmacien** + champ `counter_outcome` lignes puis `completed` RPC `pharmacist_complete_request_after_counter` ; ne plus s appuyer sur un clic patient obsolete `patient_mark_collected`.
- **`expires_at`** rempli côté app pharmacien lors de la mise en **`responded`** (+7 jours dans l UI actuelle) pour support futur cron `expire_overdue_requests()` (toujours a brancher infra service_role si souhaite).
- **Hub Mes demandes** (`/dashboard/demandes`, onglets + filtres) peut montrer **plus de lignes** que les derniers envois manuels (seed demo migration `20260501_002` avec tag `SEED_DEMO_WORKFLOW_v1`, ou anciens tests meme `patient_id`) — comportement attendu jusqu a nettoyage donnees ; le tableau de bord `/dashboard` ne fait plus office de liste exhaustive (CTA vers le hub).
- **Contact patient côté pharmacien** : lecture **nom, WhatsApp, e-mail** via RPC **`SECURITY DEFINER`** — **`pharmacist_patient_contact_for_request(uuid)`** (fiche demande) et **`pharmacist_patient_directory_for_my_pharmacy()`** (hub liste). Migration **`20260503_008`**. Un essai de policy **`profiles`** + sous-requête **`requests`** (**`20260503_007`**) provoquait une **récursion RLS** avec `requests_select_access` : corrigé par **`20260503_009`** (`DROP` policy). **Ne pas réactiver 007** sans refonte ; l’app ne s’appuie pas sur un `SELECT profiles` cross-rôle côté client pour les patients des demandes.
- **Renvoi liste patient avant réponse pharmacien** : RPC **`patient_resubmit_product_request_after_response`** accepte aussi **`submitted`** et **`in_review`** (**`20260503_006`**), pour permettre au patient d’ajuster la liste tant que la pharmacie n’a pas encore répondu.

## 9.1 Modele donnees demandes retenu (v1 evolutif)

Objectif:
- Avoir un socle robuste et maintenable des le Sprint 2
- Permettre l'evolution progressive sans casser les flux existants

Pattern retenu:
- `requests` (tronc commun workflow)
- `prescription_requests` (specificites ordonnances)
- `product_requests` (specificites demandes de produits)
- `free_consultation_requests` (specificites consultations libres)
- `request_items` (liste produits communs)
- `request_item_alternatives` (alternatives pharmacien, max 3)
- `request_comments` (commentaires traces client/pharmacien/admin)
- `request_status_history` (historique complet des transitions de statut)
- `market_shortages` (produits declares en rupture du marche par pharmacie)

Statuts retenus v1:
- `draft`
- `submitted`
- `in_review`
- `responded`
- `confirmed`
- `completed` (dossier clos apres traitement pharmacien au comptoir; voir aussi `counter_outcome` par ligne dans `request_items`)
- `cancelled`
- `abandoned`
- `expired`
- `partially_collected` / `fully_collected` (conserves en enum; hors flux officiel depuis migration 20260502 au profit de `completed` + suivi ligne a ligne au comptoir)

## 10) Journal d'avancement (a mettre a jour chaque fin de session)

### Session 2026-05-06 (suite) — Refonte UI « Mes demandes de produits / Toutes les demandes »

**Objectif** : rendre l’écran liste beaucoup plus lisible (public peu digitalisé), compact et orienté compréhension immédiate.

**Next.js** :
- **`/dashboard/demandes`** (vue **Toutes les demandes**) : bloc **Filtres et recherche** séparé visuellement (encart dédié, compact, labels plus explicites).
- **Cartes patient** (`components/requests/demande-hub-ui.tsx`) : design plus compact/structuré, sections nettes (entête, statut, compteurs, total, CTA détail), lisibilité renforcée.
- **Suppression** du bouton **Copier référence** sur les cartes patient de cette vue.
- Enrichissement des données lues sur la liste (`request_items` + alternatives) pour calculer les métriques métier demandées.
- **Statut intermédiaire UI** ajouté côté patient (virtuel, sans migration) : quand une demande est `confirmed` et que l’exécution comptoir a démarré, affichage **« En préparation »** au lieu de **« Validée »**.
- Compteurs carte selon statut :
  - **`responded`** : nb produits principaux, nb alternatives proposées, nb produits proposés officine ; total basé sur **quantités demandées initialement**.
  - **`confirmed` / `En préparation` / `completed`** : total basé sur **produits validés** ; compteurs validés (principaux / alternatives / proposés).
  - **`En préparation`** : compteurs opérationnels visibles (en attente, récupérés, annulés, commandés non reçus).

**Libs** :
- `lib/patient-request-list-summary.ts` : nouveau calculateur de synthèse (totaux + compteurs par origine/validation/comptoir).
- `lib/request-display.ts` : libellé + style badge pour le statut UI virtuel `in_progress_virtual` = **En préparation**.

**Contrôle** : `npm run lint` OK.

---

### Session 2026-05-06 (suite 2) — Dashboard patient : cohérence visuelle avec la liste

**Next.js** :
- `components/requests/demande-stat-dashboard.tsx` : bloc dashboard redesigné avec encart distinct, titre d’aide, cartes plus lisibles (contraste, surfaces blanches, CTA « ouvrir », meilleure séparation visuelle).
- Objectif : aligner la lisibilité du **Tableau de bord** sur la nouvelle vue **Toutes les demandes** pour un usage plus simple côté patient.

**Contrôle** : `npm run lint` OK.

---

### Session 2026-05-06 (suite 3) — Blocs dashboard : ajout « En préparation » (statut virtuel UI)

**Next.js** :
- `lib/demandes-hub-buckets.ts` : nouveau bucket **`en_preparation`** pour patient/pharmacien ; `bucketForStatusParam` généralisé par liste de buckets ; comptage basé sur un statut dashboard dérivé.
- `app/dashboard/demandes/patient-demandes-hub.tsx` : dérivation `status_for_dashboard` = **`in_progress_virtual`** quand `status='confirmed'` et progression comptoir détectée sur lignes validées.
- `app/dashboard/pharmacien/demandes/pharmacist-demandes-hub.tsx` : même logique dérivée, avec chargement `request_items(counter_outcome,is_selected_by_patient)` pour calculer le bucket.
- `components/requests/demande-stat-dashboard.tsx` : compatibilité `status_for_dashboard` pour compter les blocs sur le statut dérivé.

**Règle métier UI (sans migration)** :
- **Validée** : `confirmed` sans progression comptoir.
- **En préparation** : `confirmed` avec au moins une ligne validée sortie de `unset`.

**Contrôle** : `npm run lint` OK.

---

### Session 2026-05-06 (suite 4) — Vue pharmacien « Toutes les demandes » : filtres repliables + cartes modernisées

**Next.js** :
- `app/dashboard/pharmacien/demandes/pharmacist-demandes-hub.tsx` : bloc filtres/recherche rendu **repliable** (`Afficher/Masquer`) avec micro-aide quand fermé.
- `components/requests/demande-hub-ui.tsx` (`PharmacistDemandeCard`) : séparation visuelle renforcée (bordure plus épaisse, top bar couleur, dégradé léger, badges encadrés pour ref/code client) pour éviter l’effet « page blanche continue ».

**Contrôle** : `npm run lint` OK.

---

### Session 2026-05-06 (suite 5) — Détail demande patient recentré produit (header sticky + actions globales)

**Next.js** :
- `app/dashboard/demandes/[id]/page.tsx` : structure simplifiée
  - header **figé** (sticky) avec référence, statut, montant contextualisé par statut, nombre de lignes et passage prévu ;
  - corps centré sur les **blocs produits** (sans sections historiques/pharmacie secondaires) ;
  - zone basse réservée aux **actions globales** (validation, renvoi, abandon selon statut).
- `app/dashboard/demandes/[id]/PatientProductRequestActions.tsx` :
  - ajout d’une mise à jour de la **date/heure de passage** en statut `confirmed` (sans migration) ;
  - conservation du flux produit-first (`responded` : choix principal/alternative, puis confirmation).

**Contrôle** : `npm run lint` OK.

---

### Session 2026-05-06 — UI page par page : ordonnances & consultations libres (patient + pharmacien)

**Objectif** : démarrer le chantier UI incrémental sans migration, en remplaçant les placeholders des pages secondaires par des vues utiles.

**Next.js** :
- **`/dashboard/patient/ordonnances`** — liste réelle des demandes `request_type=prescription` du patient connecté (réf. publique, date, statut, lien détail).
- **`/dashboard/patient/consultations-libres`** — liste réelle des demandes `request_type=free_consultation` du patient (mêmes patterns UI que ci-dessus).
- **`/dashboard/pharmacien/ordonnances`** — liste des ordonnances reçues pour l’officine du pharmacien (`pharmacy_staff`), avec accès au détail demande.
- **`/dashboard/pharmacien/consultations-libres`** — liste des consultations libres reçues par l’officine, avec statuts et navigation vers détail.
- Harmonisation des états **chargement / erreur / vide** sur les quatre pages ; aucun changement BDD.

**Contrôle** : `npm run lint` OK.

---

### Session 2026-05-05 (lot groupé) — Plateforme header, notifs riches 003–006, codes publics 007, espaces patient/pharmacien

**Objectif** : une coque UI commune, des notifications lisibles, des **codes courts** PH / P / D pour annuaire, support et recherche.

**Migrations** (à appliquer dans l’ordre après `20260505_002` si pas déjà fait) :
- **`20260505_003_rich_notifications_pharmacy_engagement.sql`** — textes notifs patient/pharmacien via `_in_app_notification_patient` / `_in_app_notification_pharmacist` ; table **`pharmacy_engagement_events`** (tracking vues fiche / clics).
- **`20260505_004_patient_notif_title_pharmacy.sql`**, **`20260505_005_pharmacist_notifications_vouvoiement_client.sql`** — ajustements titres / vouvoiement.
- **`20260505_006_pharmacist_notif_patient_display_name.sql`** — nom patient côté notif pharmacien : `full_name` → `email` → `whatsapp` → `Client` dans `_emit_in_app_notifications_for_status_history`.
- **`20260505_007_public_reference_codes.sql`** — colonnes **`pharmacies.public_ref`**, **`profiles.patient_ref`**, **`requests.request_public_ref`** (+ `request_ref_year` / `request_ref_seq`) ; séquences, **`pharmacy_request_ref_counters`**, triggers (dont **SECURITY DEFINER** sur affectation ref demande) ; backfill ; **obligatoire** : **`DROP FUNCTION`** des RPC **`pharmacist_patient_contact_for_request(uuid)`** et **`pharmacist_patient_directory_for_my_pharmacy()`** avant recréation si extension de `RETURNS TABLE` (sinon erreur **`42P13`**).

**Next.js** :
- **`components/layout/platform-chrome.tsx`**, **`platform-header.tsx`** — header fixe, nav patient & pharmacien (demandes produits, ordonnances, consultations libres, etc.), cloche notifs **`InAppNotificationItem`**.
- **`/`** annuaire — affichage code officine, recherche par ref / nom / ville / contact.
- **`/dashboard/demandes`**, **`/dashboard/pharmacien/demandes`** — colonnes ref, filtres « réf. », copie mémorable ; hub pharmacien libellé **Demandes de produits**.
- **`/dashboard/pharmacien/page.tsx`** — dashboard analytics (Recharts) + liens ; gestion si table engagement absente.
- **Placeholders** : **`/dashboard/patient/ordonnances`**, **`consultations-libres`**, **`/dashboard/pharmacien/ordonnances`**, **`consultations-libres`**, autres volets pharmacien (clients avec recherche par **code client**, etc.).
- **`lib/public-ref.ts`**, **`lib/pharmacy-engagement.ts`**, **`lib/post-auth-redirect.ts`**, résumés cartes patient (**`lib/patient-request-list-summary.ts`**, **`lib/currency-ma.ts`**).

**Git** : commit **`a20c8c4`**, push **`fix/rls-recursion`**.

**Apprentissage infra** : `SELECT setval(...)` dans l’éditeur SQL retourne la valeur fixée (comportement normal) ; un **count** sur `request_public_ref` n’est pas l’année « /26 ».

---

### Session 2026-05-05 (suite MVP) — Admin pilote Q40 + ruptures marché pharmacien

**Next.js** :
- **`/admin`** — bloc « Pilotage MVP » : compteurs file e-mail (`pending` / `failed` / `sent` 24 h), tableau demandes filtres pharmacie/statut/type, lien **`/admin/demandes/[id]`** vue lecture seule.
- **`/dashboard/pharmacien/ruptures-marche`** — liste des **`market_shortages`** actifs de l’officine ; bouton **Retirer** (`is_active = false`, `resolved_at` renseigné).
- **`/dashboard`** pharmacien — CTA « Ruptures de marché » à côté des demandes.

**Contrôle** : `npm run lint` + `npm run build` OK.

---

### Session 2026-05-05 — Q35 notifications externes (file + préférences)

**Contexte (REPONSES Q35)** : intégration ultérieure e-mail / SMS / WhatsApp requise pour un pilote crédible au Maroc.

**Migrations** :
- `supabase/migrations/20260505_001_external_notification_channels_queue.sql` (**à appliquer après** `20260504_004`) :
- Enum **`notification_external_channel_enum`** (`email` \| `sms` \| `whatsapp`).
- Table **`notification_external_prefs`** (par `user_id`, opt-in par canal) + trigger **`set_updated_at`**.
- Table **`notification_external_queue`** (lignes `pending` … `sent` \| `failed`, snapshot destinataire, lien **`app_notification_id`**, index unique anti-doublon par notif + canal).
- Trigger **`trg_app_notifications_enqueue_external`** sur insert **`app_notifications`** : respecte les préférences et **`profiles.email` / `profiles.whatsapp`** (SMS et WhatsApp partagent le numéro profil tant qu’un champ SMS dédié n’existe pas).
- RLS : prefs lecture/écriture soi + admin ; file **admin** uniquement (worker **`service_role`** hors RLS).
- `supabase/migrations/20260505_002_filter_external_notification_statuses.sql` : limite la file externe aux statuts clés (`submitted`, `responded`, `confirmed`, `completed`, `cancelled`, `abandoned`, `expired`) pour éviter le doublon « en traitement » + « répondu » côté e‑mail/SMS/WhatsApp.

**Next.js** : **`/dashboard`** — bloc **« Alertes hors application (pilote) »** (`ExternalNotificationPrefs`) pour patient et pharmacien (enregistrement **`upsert`** sur `notification_external_prefs`).

**Suite infra** : cron ou Edge Function avec clé `service_role` pour consommer **`notification_external_queue`** et appeler fournisseurs (SendGrid, Twilio, Meta WA, etc.) — non livré dans cette session.

**Suite (email first)** : endpoint serveur **`POST /api/cron/send-external-emails`** (protégé par `CRON_SECRET`) pour envoyer les lignes `pending` `channel=email` via Resend (`RESEND_API_KEY`) en utilisant Supabase `service_role` (`SUPABASE_SERVICE_ROLE_KEY`). À brancher sur un cron Vercel/GitHub/serveur.

**Contrôle** : `npm run lint` + `npm run build` OK.

---

### Session 2026-05-07 (suite 2) — Fix notif pharmacien invisible (Q34) : chainage 003/004

**Problème constaté** : après `20260504_002`, certaines exécutions retournaient `42P10` sur `ON CONFLICT (source_status_history_id, recipient_id)` dans `_emit_in_app_notifications_for_status_history` (index partiel non inférable), et les premières demandes `submitted` sans historique initial ne déclenchaient pas de notif pharmacien.

**Migrations ajoutées** :
- `supabase/migrations/20260504_003_request_initial_status_history_notifications_fix.sql`
  - trigger `trg_requests_initial_status_history` sur insert `requests` pour journaliser le statut initial.
  - backfill des demandes `submitted` sans ligne `request_status_history`.
- `supabase/migrations/20260504_004_fix_notifications_conflict_index.sql`
  - remplace l’index partiel par un unique index compatible `ON CONFLICT (source_status_history_id, recipient_id)`.

**Ordre recommandé si incident déjà vu en SQL Editor** :
1) corriger index (`004` ou SQL équivalent), 2) relancer `003`, 3) tester création demande patient -> apparition notif pharmacien (`/dashboard` et `/dashboard/pharmacien/demandes`).

---

### Session 2026-05-07 (suite) — Q34 notifications in-app (MVP)

**Migration** `supabase/migrations/20260504_002_in_app_notifications_request_status.sql` (**à appliquer après** `20260504_001`) :
- Table **`app_notifications`** (recipient, request, event, title/body, read_at) + RLS (`select/update` sur ses notifications, admin full).
- Trigger sur `request_status_history` : génération automatique des notifications in-app selon transitions (`submitted`, `in_review`, `responded`, `confirmed`, `completed`, `cancelled`, `abandoned`, `expired`).
- Ciblage MVP : patient (étapes impactantes) + équipe pharmacien de l’officine (soumission / confirmation / annulation / abandon).

**Next.js** :
- **`/dashboard`** : bloc « Notifications » (patient/pharmacien), dernières entrées avec lien direct vers la demande.
- Hubs **`/dashboard/demandes`** et **`/dashboard/pharmacien/demandes`** : bloc notifications compact en tête.

**Contrôle** : `npm run lint` + `npm run build` OK.

---

### Session 2026-05-07 — §12 Q11 & Q20 : `client_comment` bout en bout, lignes « proposées pharmacien » + motif

**Migration** `supabase/migrations/20260504_001_request_item_line_source_client_comment_resubmit.sql` (**à appliquer après** `20260503_009`, ordre `YYYYMMDD_*`) :
- Type **`request_item_line_source_enum`** ; colonnes **`line_source`** (défaut `patient_request`), **`pharmacist_proposal_reason`** (obligatoire avec contrainte si **`pharmacist_proposed`**) ; **`client_comment`** limité à **500** car. en CHECK.
- Réécriture **`patient_resubmit_product_request_after_response`** : chaque élément JSON peut inclure **`client_comment`** (optionnel) ; lignes recréées en **`patient_request`**.

**Next.js** : fiche **`demande-produits`** — note optionnelle **par produit** ; détail patient — affichage note + bandeau **proposition pharmacie** ; **`PatientProductRequestActions`** — note par ligne au renvoi liste ; fiche pharmacien — panneau **« Proposer un produit »** (motif obligatoire + qty + catalogue), badges origine ligne, **« Mis à jour … »** sur **`updated_at`** (`lib/request-display` : **`requestItemLineSourceFr`**).

**Contrôle** : **`npm run lint`** OK. **Supabase** : appliquer la migration puis smoke test création / proposition / renvoi liste.

---

### Session 2026-05-06 — Hub statuts, demandes produits seules, contact patient pharmacien (RPC), fix RLS

**Hubs** (`/dashboard/demandes`, `/dashboard/pharmacien/demandes`) : tableau de bord en **blocs compteurs** par famille de statuts (`lib/demandes-hub-buckets.ts`, `components/requests/demande-stat-dashboard.tsx`) ; clic → liste avec filtre URL **`?statut=`** ; périmètre **`product_request`** ; filtres **pharmacie** (patient) / **patient** (pharmacien). Cartes : date, **référence copiable**, badge statut.

**Patient** : RPC **`20260503_006`** — renvoi de liste en **`submitted` / `in_review`** ; détail : **lignes en premier**, bloc repliable « Pharmacie, historique et message » ; libellé type **`Demande`** ; actions : **`confirmed`** → abandon seulement (plus de renvoi liste) ; **`responded`** → confirmation + renvoi + abandon.

**Pharmacien** : affichage **nom + WhatsApp + e-mail** via **`pharmacist_patient_contact_for_request`** / **`pharmacist_patient_directory_for_my_pharmacy`** (**`20260503_008`**). Fiche demande : **bandeau patient**, **grille compacte** des champs par ligne ; alternatives sans rechargement complet du brouillon. **`20260503_007`** retirée par **`20260503_009`** (récursion `profiles` ↔ `requests`).

**Git** : branche **`fix/rls-recursion`** (ex. commits `8af86f0`, `9bae9ea` — voir `git log`).

---

### Session 2026-05-03 (suite) — §12 : qté / doublons, motifs, rupture marché, abandon 24 h (alignement Q6 / Q38)

**Objectif** : enchaîner sur le backlog §12 sans attendre l’accès SQL Editor Supabase depuis Cursor.

**BDD** (`supabase/migrations/20260503_005_abandon_24h_qty_dupe_shortage_reasons.sql` — **à appliquer après** `20260503_004`) :
- `request_items.requested_qty` borné **1–10** ; **index unique** `(request_id, product_id)` (pas de doublon produit sur une même demande).
- **`patient_abandon_request(uuid, text, text)`** : motifs contrôlés + texte obligatoire si `other` ; journal `patient_abandon|code|…`.
- **`patient_cancel_product_request_before_response`** : annulation **submitted / in_review** avec les mêmes motifs.
- **`patient_resubmit_product_request_after_response`** : contrôle doublons + qté côté serveur ; remet **`expires_at`** à **null** au retour `submitted`.
- **`abandon_unconfirmed_responded_requests()`** (service_role) : `responded` sans action **> 24 h** → **`abandoned`** (Q6) — à planifier comme `expire_overdue_requests` (cron / Edge).
- Trigger **`_sync_market_shortage_from_request_item`** : si dispo ligne = **`market_shortage`**, upsert logique vers **`market_shortages`** (rupture active par officine + produit).

**Next.js** :
- Publication réponse pharmacien : **`expires_at` = null** (pilote Q38 : pas d’expiration +7 j pilotée par ce champ ; l’abandon 24 h porte sur l’absence de passage à `confirmed`).
- Fiche **`demande-produits`** : qté plafonnée à 10.
- Détail patient : **annulation avant réponse** (`PatientCancelBeforeResponse`) ; **abandon après réponse** avec sélecteur de motif (`PatientProductRequestActions`).

**Supabase (humain)** : appliquer la migration ; configurer un appel périodique **`abandon_unconfirmed_responded_requests`** (et traiter les demandes `responded` déjà en base avec `expires_at` renseigné si vous voulez les aligner sur le pilote — optionnel : `update requests set expires_at = null where status = 'responded'`).

**Git** : commit **`a9b1b38`** sur **`fix/rls-recursion`** (push effectué).

---

### Session 2026-05-05 — Hubs UX « Mes demandes » (patient + pharmacien)

**Objectif**: refléter le flux métier lisible (« standard marché ») : tableau de bord par **familles de statuts**, **liste complète** avec filtres/tri, **cartes** cliquables, détail avec **lecture seule** quand aucune action n’est prévue.

**Patient** (`/dashboard/demandes`):
- **Onglets**: *Tableau de bord* | *Toutes les demandes* (paramètre URL `?vue=dashboard` par défaut, `?vue=liste`).
- Tableau de bord : première itération sections (`patientDashboardSections` dans `lib/request-display.ts`) — **évolué** ensuite vers **blocs compteurs par bucket** + filtre URL `statut` (voir **session 2026-05-06**).
- Liste : filtres statut / type ; tri date création.
- **`/dashboard`**: encart résumé + CTA « Ouvrir Mes demandes » (plus liste longue inline).
- Détail : retour vers le hub ; encart « Lecture seule » si **`patientRequestHasNoActions`**.

**Pharmacien** (`/dashboard/pharmacien/demandes`):
- Même mécanique d’onglets + **`pharmacistDashboardSections`** ; **toutes** les demandes de l’officine liée sont chargées (pas seulement quatre statuts).
- Liste : filtres / tri comme côté patient.
- Détail : bannière **sans suite** / **terminée** lecture seule quand **`pharmacistRequestIsHardStopped`** / **`pharmacistRequestIsClosedSuccess`** (sur demandes produits).

**Fichiers**: `components/requests/demande-hub-ui.tsx`, `app/dashboard/demandes/page.tsx`, `patient-demandes-hub.tsx`, `pharmacist-demandes-hub.tsx`.

**Git**: groupe **`83cbf5f`** sur branche **`fix/rls-recursion`**.

---

### Session 2026-05-03 — livraison technique « workflow demande produits » (après atelier)

**Embeds Supabase**: correction erreur PostgREST *« more than one relationship »* entre `request_items` et `request_item_alternatives` — désormais embed explicite `request_item_alternatives!request_item_alternatives_request_item_id_fkey(...)` dans les `select` patient et pharmacien (la FK `patient_chosen_alternative_id` créait une ambiguïté).

**Migrations** (`supabase/migrations/`, à appliquer sur Supabase dans l ordre si pas encore fait) :
- `20260503_001_patient_chosen_alternative.sql` — **`patient_chosen_alternative_id`**, **`patient_confirm_after_response`** avec `chosen_alternative_id`.
- `20260503_003_seed_products_thirty_ma.sql` — ~31 produits démo MAD (`price_pph` / `price_ppv`, idempotent par nom).
- `20260503_004_patient_planned_visit.sql` — **`patient_planned_visit_date`** / **`patient_planned_visit_time`** ; **RPC `patient_confirm_after_response`** en **4 arguments** `(uuid, jsonb, date, text)` — **supprime** l ancienne surcharge 2 args ; borne passage : **CAS aujourd hui**, +**4 j** sans ligne « à commander » sélectionnée, sinon **max(ETA) + 3 j** avec ETA sur la **branche** choisie (principal ou alternative) ; reset des champs passage sur **`patient_resubmit_product_request_after_response`**.

**Next.js**: `lib/product-price.ts` (affichage **PPH**) ; `lib/planned-visit.ts` (bornes locales date passage). UI mise à jour : fiche **demande-produits**, détails patient/pharmacien, **`PatientProductRequestActions`** (date/heure passage, confirmation RPC 4 params), préremplissage / affichage PPH côté pharmacien (y compris insert alternative depuis catalogue).

**Documents**: mise à jour atelier **`docs/workflow-demande-produits-REPONSES.md`** (cohérence liste).

---

### Session 2026-05-03 (plan atelier workflow produits — suite)

**Livrable**: plan de développement A→Z aligné sur `docs/workflow-demande-produits-REPONSES.md` (pilote ~12 à 15 pharmacies, parcours bout en bout d’abord sans tableau de bord ni canal notif hors app ; UX rupture marché à griser avec promesse future de notification groupe ; annulation avec liste de motifs + « autre » ; date/heure prévision « à commander » : date obligatoire comme aujourd’hui).

**Décisions encore à préciser**: Q4 (tableau statuts métier ↔ slug), Q33 (statuts lignes/passages multiples au-delà du différé unique). À trancher côté produit : cohabitation **Q38** (« pas d’expiration pilote ») vs **Q6 §3** (abandon auto **24 h** après réponse sans validation patient) vs mécanisme actuel **`expires_at` +7 j** à la publication — le plan technique retient un seul jeu de règles évitable en doublon.

**Voir §12** pour la décomposition jalons / BDD puis UI et l’écart avec l’existant.

**Implémentation (suite session)** :
- Migration `20260503_001_patient_chosen_alternative.sql` : colonne **`request_items.patient_chosen_alternative_id`** + **`patient_confirm_after_response`** enrichi (`chosen_alternative_id` dans `p_selections`, validation quantités sur la branche alternative).
- UI patient : **`PatientProductRequestActions`** — groupe radio « rien / principal / alternative » par ligne lorsque des alternatives existent ; ruptures marché exclues des choix ; envoi **`chosen_alternative_id`** au RPC.
- Détail patient + détail pharmacien : mention explicite du **choix patient** (principal vs alternative).

**Infra humaine**: appliquer la migration Supabase après `git pull`.

---

### Session 2026-05-04 — ESLint CI + flux produits (alternatives pharma + comptoir RPC)

**CI / Qualité**: correction des erreurs ESLint **`react-hooks/set-state-in-effect`** (Next 16 / règle stricte) sur les écrans demande détail patient, pharmacien, fiche pharmacie et formulaires catalogue : pas de `setState` synchrone dans les effets là où évitable (`key`/initialiseurs lazy côté actions patient ; `visibleHits` pour recherche courte ; erreur **`id`** fiche résolue par rendu conditionnel sans effet).

**Alternatives pharmacien**: sur **`/dashboard/pharmacien/demandes/[id]`**, sous chaque ligne produit en phase éditable (`submitted`/`in_review`) — recherche catalogue, ajout (insert `request_item_alternatives`, dispo défaut disponible / qté = demandée), retrait jusqu’à 3 alternatives par ligne.

**Comptoir pharmacien**: même écran en statuts **`responded` | `confirmed` | `completed`** — section « Comptoir magasin » : liste par ligne (incl. lignes non gardées par le patient en lecture seule), menu pilotant **`pharmacist_set_item_counter_outcome`** ; bouton **Clôturer le dossier** quand aucune ligne encore sélectionnée par le patient n’est **`unset`** ni **`deferred_next_visit`** — appel **`pharmacist_complete_request_after_counter`** (message d’erreur SQL remonté en UI si règle non satisfaite).

**Patient**: détail demande (**`/dashboard/demandes/[id]`**) — bloc « Alternatives proposées » sous chaque produit lorsque présentes (`request_item_alternatives` enrichi dans la requête). Composant actions patient remonté avec **`key`** sur les lignes pour resynchroniser brouillon / confirmation sans effets parasites.

---

### Session 2026-05-03 — UI workflow « demande de produits » (client + pharmacien) + cloture méthodo

**Produit — espace patient (Next)**:
- Liste **Mes demandes** sur `/dashboard` (avec jointure pharmacies + libellés FR depuis `lib/request-display.ts`).
- Détail **`/dashboard/demandes/[id]`**: pharmacies message patient dates lignes `request_items` + produits + comptoir quand pertinent.
- **Actions RPC post-réponse** (composant `PatientProductRequestActions.tsx`): après `responded` ou `confirmed` — **`patient_confirm_after_response`** (formulaire lignes qty max cap stock), **`patient_resubmit_product_request_after_response`** (liste produits retravaillée + recherche catalogue + note), **`patient_abandon_request`** avec confirm navigateur.

**Produit — espace pharmacien (Next)**:
- Liste **`/dashboard/pharmacien/demandes`**: filtres demandes active `submitted` `in_review` `responded` `confirmed` pour la pharmacie liée `pharmacy_staff`.
- Détail **`/dashboard/pharmacien/demandes/[id]`**: produits uniquement (**`product_request`**); mise dispo lignes enums `availability_status`; publier provoque automatiquement **`submitted`→`in_review`** puis MAJ lignes puis **`responded`** + `responded_at` + **`expires_at` + 7 j** + lignes **`request_status_history`** insérées coté JS (motif pharmacien_ui / publication disponibilites). Statuts suivants vue lecture seule.
- Lien **Voir les demandes a traiter** depuis dashboard pharmacien bloc existant.

**Technique commun**:
- Nouveaux utilitaires **`lib/embed.ts`** (embed Supabase normalise tableau/singleton `one()` et **`lib/pharmacist-availability.ts`** (select dispo pharma).
- **`.gitignore`**: dossier **`supabase/.temp/`** (CLI locale).
- **Git**: commits sur branche **`fix/rls-recursion`** dont dernier groupe **e22c91a** dashboards patient + pharma helpers.

**Méthode / alignement équipe amateur** ajout §0.1 cadre repetee collaboration sans outillage Supabase automatique coté Cursor.

**Reste coherent avec la roadmap immediate** mais pas clos dans cette session ; **ultérieurement (session 2026-05-04)** — alternatives pharma + UI comptoir + RPC clôture sont livrées (voir ce bloc ci-dessus au journal).

Encore hors périmètre à l’instant de la rédaction historique :

- Flux **alternatives** + **comptoir** côté UI → réalisés en **session 2026-05-04** (voir journal).
- Chantiers **ordonnance** + **consultation libre** : écran pharma détail encore message « hors périmètre ».
- **Remarques qualitatives utilisateur** : poursuivre inventaire ligne §12 dont retours ESLint / CI.

---

### Session 2026-05-02
- Migration `20260502_001_*`: statut `completed`, enum/colonne `counter_outcome`, RPC client `patient_resubmit_product_request_after_response`, RPC pharma `pharmacist_set_item_counter_outcome`, `pharmacist_complete_request_after_counter`
- `patient_confirm_after_response`: lignes decochees -> `cancelled_at_counter`; lignes conservees pret comptoir en `unset` apres passage en `confirmed`
- `patient_mark_collected`: REVOKE coté JWT `authenticated` (deprecie)

### Session 2026-05-01
- RLS alternatives: SELECT pour les participants a la demande; INSERT/UPDATE/DELETE pharmacien rattache ou admin
- RPC client: `patient_confirm_after_response`, `patient_abandon_request`, `expire_overdue_requests()` (service_role); `patient_mark_collected` ensuite deprecie dans session 2026-05-02
- Migration seed conditionnelle demo (alternatives sur items)
- Next.js: pages fiche pharmacie + formulaire demande produits + redirect auth securise
- Point ouvert: `expire_overdue_requests` a planifier cote infra; UI reaction client (appels RPC) a faire dans l espace patient

### Session 2026-04-30
- Consolidation de la vision produit de la fiche digitale
- Definition des roles et des flux principaux client/pharmacien
- Alignement sur la methode de travail DB-first
- Creation du present cahier des charges vivant
- Validation du modele hybride des demandes (tables communes + tables par type)
- Ajout des besoins de tracabilite (commentaires et historique statuts)
- Validation des nouveaux statuts de cycle de vie (abandoned, expired, partially_collected, fully_collected)
- Creation migration `20260430_001_products_reference.sql` (table produits + index + RLS)
- Validation fonctionnelle de la table `products` et tests d'acces via page debug locale (`/debug/rls`)
- Creation migration `20260430_002_requests_workflow_v1.sql` (workflow demandes v1 complet)
- Seed de produits de test effectue
- Tests de creation de demandes effectues (ordonnance, demande produits, consultation libre)
- Test de traitement pharmacien execute:
  - transitions `submitted -> in_review -> responded` tracees dans `request_status_history`
  - disponibilites de produits renseignees dans `request_items`
  - commentaire pharmacien trace
  - point a finaliser: insertion alternatives (nb_alternatives = 0 sur le test capture)

## 11) Etat actuel (point de reprise)

Ce que vous faites hors repo (resume):
- **Supabase**: appliquer les migrations dans l ordre depuis le dossier `supabase/migrations` (`supabase db push` depuis la machine avec le projet lie, ou coller/export SQL depuis le tableau SQL dans l ordre des fichiers). Aucune config Vercel requise pour ces changements tant que les variables Supabase sont deja en place dans le projet Next.js.
- **GitHub**: `git push` votre branche comme d habitude une fois les fichiers commites (_le code frontend de ce repo est versionne ainsi_).
- **Vercel**: si le projet est connecte au repo, le deploy se relance automatiquement apres push; verifier le build comme pour tout commit.

Etat technique valide dans le depot:
- Migrations en place (dernier fichier en date a appliquer en dernier):
  - `supabase/migrations/20260430_001_products_reference.sql`
  - `supabase/migrations/20260430_002_requests_workflow_v1.sql`
  - `supabase/migrations/20260501_001_patient_reaction_and_alternative_rls.sql` (alternatives ecriture pharmacien/admin + RPC client confirmation / abandon / expire batch)
  - `supabase/migrations/20260501_002_seed_workflow_demo.sql`
  - `supabase/migrations/20260502_001_resubmit_after_response_and_counter_pickup.sql` (revision ligne produits apres responded/confirmed, comptoir par ligne, statut `completed`, desactivation RPC patient `patient_mark_collected`)
  - `supabase/migrations/20260503_001_patient_chosen_alternative.sql` (colonne `patient_chosen_alternative_id`, RPC `patient_confirm_after_response` avec `chosen_alternative_id`)
  - `supabase/migrations/20260503_003_seed_products_thirty_ma.sql` (≈31 produits démo MAD `price_pph` / `price_ppv`, idempotent par `name`)
  - `supabase/migrations/20260503_004_patient_planned_visit.sql` (`patient_planned_visit_date` / `_time`, RPC confirmation 4 params, reset sur resubmit)
  - `supabase/migrations/20260503_005_abandon_24h_qty_dupe_shortage_reasons.sql` (CHECK qté 1–10, unique produit/demande, motifs abandon/annulation, resubmit serveur, `abandon_unconfirmed_responded_requests`, trigger `market_shortages`, abandon RPC 3 args)
  - `supabase/migrations/20260503_006_patient_resubmit_submitted_in_review.sql` (`patient_resubmit_product_request_after_response` étendu à **`submitted`** / **`in_review`**)
  - `supabase/migrations/20260503_007_profiles_pharmacist_select_request_patients.sql` (**obsolète / dangereux seul** — provoque récursion RLS ; toujours appliquer **`009`** après si la chaîne migrations est rejouée depuis zéro)
  - `supabase/migrations/20260503_008_pharmacist_patient_contact_rpc.sql` (**RPC** `pharmacist_patient_contact_for_request`, `pharmacist_patient_directory_for_my_pharmacy`)
  - `supabase/migrations/20260503_009_drop_profiles_policy_007_recursion.sql` (**supprime** la policy `profiles_select_for_assigned_pharmacy_patients` de **007**)
  - `supabase/migrations/20260504_001_request_item_line_source_client_comment_resubmit.sql` (**Q20** `line_source` + **`pharmacist_proposal_reason`** ; **Q11** borne **`client_comment`** ; RPC resubmit avec **`client_comment` dans `p_items`**)
  - `supabase/migrations/20260504_002_in_app_notifications_request_status.sql` (**Q34 MVP** notifications in-app auto via `request_status_history`)
  - `supabase/migrations/20260504_003_request_initial_status_history_notifications_fix.sql` (historisation statut initial à l’insert `requests` + backfill `submitted` sans historique)
  - `supabase/migrations/20260504_004_fix_notifications_conflict_index.sql` (fix `ON CONFLICT` notifications : index unique non partiel)
  - `supabase/migrations/20260505_001_external_notification_channels_queue.sql` (**Q35** préférences canaux + file `notification_external_queue` + trigger depuis `app_notifications`)
  - `supabase/migrations/20260505_002_filter_external_notification_statuses.sql` (filtre statuts éligibles file externe)
  - `supabase/migrations/20260505_003_rich_notifications_pharmacy_engagement.sql` (notifs texte riche + **`pharmacy_engagement_events`**)
  - `supabase/migrations/20260505_004_patient_notif_title_pharmacy.sql`
  - `supabase/migrations/20260505_005_pharmacist_notifications_vouvoiement_client.sql`
  - `supabase/migrations/20260505_006_pharmacist_notif_patient_display_name.sql` (fallback nom patient dans notifs pharmacien)
  - `supabase/migrations/20260505_007_public_reference_codes.sql` (**codes** `public_ref` / `patient_ref` / `request_public_ref` + RPC directory/contact avec **`patient_ref`** — inclut **`DROP FUNCTION`** avant recréation RPC)

Regles fonctionnelles retenues (alignement dernier atelier):
- A la **`responded` -> `confirmed`**, le patient indique une **date de passage** (bornes métier CAS : 4 jours sans « à commander » sélectionné, sinon jusqu à **ETA max + 3 j** pour les lignes « à commander » de sa sélection) et une **heure optionnelle** ; données stockées sur **`requests`**, effacées si le patient **renvoie** la demande (`submitted`).
- A la **`responded` -> `confirmed`**, le patient peut choisir pour chaque ligne le **produit principal** ou **une alternative** proposee (`patient_chosen_alternative_id`), ou **rien** pour la ligne.
- **Référentiel catalogue** : affichage **PPH** (`products.price_pph`) partout où le catalogue est lu sur les parcours produits lorsque renseigné ; **prix de réponse** pharmacien distingué (« Prix pharmacie » / champ `request_items.unit_price`).
- Le client peut **modifier et renvoyer** une demande produit **avant réponse** (`submitted`|`in_review`) ou **après réponse** (`responded` uniquement pour ce flux ; en **`confirmed`** le renvoi liste est retiré côté UI — abandon possible) via RPC `patient_resubmit_product_request_after_response` → retour **`submitted`**, reset préparation pharma.
- Le **retrait reel** au comptoir est porte par le **pharmacien**: colonne par ligne `request_items.counter_outcome` (`unset`, `picked_up`, `cancelled_at_counter`, `deferred_next_visit`) + cloture dossier via `pharmacist_complete_request_after_counter` lorsque tout est bon (plus aucune ligne encore `unset` ou `deferred_next_visit` parmi les lignes **selectionnees** par le client).
- **Après réponse** : l’app ne renseigne plus **`expires_at` +7 j** sur publication (pilote) ; l’**abandon auto 24 h** sur statut **`responded`** non confirmé est porté par le batch SQL `abandon_unconfirmed_responded_requests()` (à cron). Les **`request_items`** sont limités à **qté 1–10** et **un seul `product_id` par demande**.
- Les statuts enum `partially_collected` / `fully_collected` restent en base mais le flux officiel livre passe par **`completed`**; `patient_mark_collected` nest plus callable par le JWT patient (obsolete).

Implémentation frontend associée repo (voir journal §10 dont **Sessions 2026-05-03**, **2026-05-05** et **lot plateforme / codes publics 2026-05-05**):
- **`/`** annuaire + recherche par code officine **`public_ref`** + lien carte vers fiche **`/pharmacie/[id]`** (affiche aussi le code)
- **`/pharmacie/[id]/demande-produits`**: création demande **`submitted`**
- **`/dashboard`** (résumé / routage rôle), **`/dashboard/demandes`** (hub + **filtre par réf.** + codes **`request_public_ref`** sur cartes), **`/dashboard/demandes/[id]`** (ref mémorable + code officine en détail)
- **`/dashboard/demandes`** (vue liste) : refonte UX des filtres/cartes ; suppression bouton copie ; compteurs et montants contextualisés (`responded` vs validé/en préparation/clôturé) ; statut intermédiaire UI **En préparation** (virtuel, sans migration)
- **`/dashboard/demandes`** et **`/dashboard/pharmacien/demandes`** (vue dashboard) : bloc supplémentaire **En préparation** alimenté par statut dérivé UI (`confirmed` + progression comptoir), cohérent avec les cartes
- **`/dashboard/demandes/[id]`** (détail patient) : refonte orientée produit avec header sticky montant+volume+passage prévu et actions globales en bas ; date de passage modifiable aussi en `confirmed` côté UI/app
- **`/dashboard/pharmacien`** (tableau de bord analytics + liens), **`/dashboard/pharmacien/demandes`** (idem refs + **code client** sur cartes), **`/dashboard/pharmacien/demandes/[id]`**, **`/dashboard/pharmacien/clients`** (recherche par **`patient_ref`**)
- **Chrome** : **`components/layout/platform-*.tsx`** — nav patient & pharmacien (ordonnances / consultations libres en menu, etc.), notifs in-app header
- **Patient** : **`/dashboard/patient/*`** (paramètres avec **code client**, pharmacies, liste souhaits, ordonnances/consultations libres désormais branchées en listes filtrées par type)
- **Pharmacien** : **`/dashboard/pharmacien/ordonnances`** et **`/dashboard/pharmacien/consultations-libres`** branchées sur les demandes existantes de l’officine (filtre `request_type`, cartes simples, lien détail)
- Auth **`/auth`** + **`lib/post-auth-redirect.ts`**
- Travail incrementale sur branche **`fix/rls-recursion`** (dernier groupe notoire : **`a20c8c4`** — plateforme + **007** + notifs **003–006**).

Etat fonctionnel teste / a valider sur Supabase:
- Les 3 types de demandes sont inserables (tel qu avant)
- Historisation des statuts fonctionne
- Alternatives: insertion reservee pharmacien/admin (corrige le cas ou un test patient ne voyait aucune ligne)
- Appliquer les nouvelles migrations puis verifier le seed demo (`patient_note` = `SEED_DEMO_WORKFLOW_v1`)

## 12) Backlog produit ouvert — tranche « workflow demande de produits » (priorité prochaine session)

_Objectif declaré_: **boucler fonctionnellement le flux « demande de produits »** de bout en bout (atelier REPONSES mai 2026), puis UX / notifications canaux.

### Plan de développement A→Z (jalons recommandés)

**Jalon 0 — Arbitrages & doc (court)**  
- Remplir **Q4** (grille envoyée / en traitement pharma / répondue / validée patient / traitée-comptoir / annulée / abandonnée / cloturée ↔ valeurs enum actuelles).  
- Arbitrer **expiration** : renoncer au **+7 j** piloté par `expires_at` **ou** le garder pour un usage interne uniquement ; implémenter l’**abandon 24 h** après `responded` si toujours d’actualité (**Q6** vs **Q38**).  
- **Q33** : confirmer si le modèle actuel (`deferred_next_visit` + clôture) suffit pour « plusieurs passages » ou si des statuts supplémentaires sont requis.

**Jalon 1 — BDD / migrations (avant UI dépendante)**  
1. **Choix alternative (Q19, Q22)** : **fait** — `patient_chosen_alternative_id` + RPC + UI radios ; embed PostgREST qualifié (voir journal).  
2. **Date de passage (Q26–Q27)** : **fait** — `patient_planned_visit_date` / `_time` sur `requests`, validation dans **`patient_confirm_after_response`** (timezone **Africa/Casablanca**, règle 4 j / ETA+3 j sur branche choisie) ; **`lib/planned-visit.ts`** + saisie patient.  
3. **Lignes « proposées par le pharmacien » (Q20)** : **fait** — enum **`line_source`**, **`pharmacist_proposal_reason`**, insertion depuis la fiche pharmacien avant réponse ; libellés `requestItemLineSourceFr` (voir **`20260504_001`**).  
4. **Motifs d’annulation patient (Q16)** : **fait** (migration `20260503_005`) — **`patient_abandon_request`** + **`patient_cancel_product_request_before_response`** + UI détail patient.  
5. **Doublons & quantités** : **fait** — CHECK **1–10**, unique `(request_id, product_id)`, validations resubmit + fiche demande.  
6. **`client_comment` par ligne (Q11)** : **fait** — **`demande-produits`** + composant **`PatientProductRequestActions`** (JSON vers RPC) ; borne **500** car. (**`20260504_001`**).  
7. **Vue pharmacien patient nominatif (Q39)** : **fait côté lecture** — RPC **`20260503_008`** (+ UI cartes / fiche) ; **ne pas** réintroduire la policy **`20260503_007`** seule (récursion ; **`009`** obligatoire si **007** a été jouée).  
8. **Pilotage rupture marché & relances (Q21, §5 cahier, Q34–Q35)** : insertion **`market_shortages`** lors du choix pharma `market_shortage` ; **Q34 in-app MVP fait** ; **Q35** : schéma **prefs + file** + trigger depuis **`app_notifications`** (**`20260505_001`**) + opt-in UI dashboard ; branchement fournisseurs d’envoi (**service_role** / cron) **à faire**.  
9. **Admin pilote (Q40)** : **partiel fait** — `/admin` + `/admin/demandes/[id]` (lecture) + filtres ; exports CSV / analytics **à cadrer** si besoin.

**Jalon 2 — UI dans l’ordre des dépendances**  
0. **Hubs liste/tableau de bord** patient + pharmacien (`/dashboard/demandes`, `/dashboard/pharmacien/demandes`) : ✓ (**Session 2026-05-05** §10) ; **rafraîchissement UX** : continuer **écran par écran** (micro-copies, états vides, accessibilité, alignement maquettes) — voir **§13.5** phrase de reprise UI.
0bis. **Codes publics PH / P / D** : ✓ BDD + annuaire + hubs + paramètres / clients (**`20260505_007`**, session journal lot 2026-05-05).
1. Fiche **`/pharmacie/.../demande-produits`** : **PPH affichés** ✓ ; **qté max 10** ✓ ; **commentaire par ligne** ✓ (**Q11**, session **2026-05-07**).  
2. **`PatientProductRequestActions` + détail patient** : radios principal/alternative ✓ ; date passage ✓ ; notes par ligne au renvoi ✓ (**Q11**) ; reste récap dense **Q28**, totaux **Q23** si besoin au-delà de PPH + lignes réponse pharma.  
3. **Pharmacien** : motif sur **lignes proposées par l’officine** ✓ (**Q20**), mention **« Mis à jour … »** sur ligne ✓ (**Q32**, `updated_at` affiché) ; reste affinages ETA « à commander » / **Q18**.  
4. **Post‑`confirmed`** : rappeler l’état « prêt / à commander avec date » (**Q31**), comptoir + saisie pharmacien récupéré vs annulé (**Q6 point 8** — affiner formulaire si champs métier manquants).  
5. **Tâches planifiées** : job **abandon 24 h** ✓ (**`abandon_unconfirmed_responded_requests`**, à brancher cron) ; **`expires_at` +7 j** désactivé côté app à la publication ✓ ; **Q34 in-app MVP** ✓ (dashboards + hubs).  
6. **Espace Admin** minimal issu du jalon BDD §9.

**Écart principal avec le déjà livré** : flux **`responded` → `confirmed`** inclut désormais **alternative + passage + validation serveur associée**. **Motifs annulation**, **anti-doublon / plafond qté**, **`market_shortages`** auto, **abandon 24 h** (RPC prêt), **commentaires ligne patient (Q11)**, **propositions pharmacien (Q20)** et **notifications in-app MVP (Q34)** sont en place (migrations **`20260504_001`** + **`20260504_002`**). **Q35** : file **`notification_external_queue`** + préférences + UI opt-in (**`20260505_001`**) ; **envoi réel** email/SMS/WA via worker + prestataires **reste à brancher**. Restent notamment **expiration vs abandon 24 h** (arbitrage ops), **admin pilote**, **micro-UX** (récap Q28/Q23, libellés « comptoir »).

**Questions sans réponse explicite (atelier)** : **Q4**, **Q33** uniquement. *(Q36 réponse implicite : « décide‑toi » → jalon 2 pour listes pharma « à commander / prêt / relance », aligné notifications **Q37**.)*

---

**Liste technique issue etat dernier depot (hors subjective)**:

| Sujet | Statut mémo prod |
|------|-------------------|
| Creation ligne demande depuis fiche + statut **`submitted`** | Fait (`/pharmacie/.../demande-produits`) |
| Liste detail patient + actions **responded/confirmed** (confirm/resubmit/abandon) | Fait — **choix alternative par le patient** (migration `20260503_001` + RPC + UI radios) |
| Liste + publication reponse pharma **availability** jusqu **`responded`** + **expires_at** | Fait (`/dashboard/pharmacien/...`) — arbitrage pilote **`expires_at` +7 j** vs abandon **24 h** (Q6 vs Q38) |
| **Alternatives** jusqu a 3 / ligne coté pharma UI saisie + affichage patient detail | Pharma + affichage patient **OK** — **choix patient (0 ou 1 / groupe)** **fait** (voir migration `20260503_001`) |
| **Comptoir** `counter_outcome` ligne + bouton cloture **`pharmacist_complete_request_after_counter`** côté UI pharma ou magasin préparation | **Fait** (`/dashboard/pharmacien/demandes/[id]` section dédiée) |
| **Date de passage** patient à la validation | **Fait** (`20260503_004`, RPC 4 params, UI **`PatientProductRequestActions`**) |
| **Auto expiration** cron supabase **`expire_overdue_requests()`** | Conservé pour jeux `expires_at` historiques ; **non alimenté** sur nouvelles publications (`expires_at` null, pilote Q38) |
| **Abandon automatique** 24 h après **`responded`** | **RPC prêt** : **`abandon_unconfirmed_responded_requests()`** — brancher cron service_role |
| **Ordonnance / consultation**: traitement pharmacien meme espace | Hors perimetre ecran actuel |
| **`market_shortages`** insert auto quand pharma choisit **market_shortage** dispo ligne | **Fait** (trigger `20260503_005`) + **UI liste / retrait pharmacien** (`/dashboard/pharmacien/ruptures-marche`) |
| **Notifications Q34–Q35** | **Q34 MVP fait** ; **Q35** schéma + enqueue + opt-in UI (**`20260505_001`**) ; **livraison messages** (API prestataires + worker) à brancher |
| **PPH catalogue** sur parcours produits (`price_pph`) | **Fait** (`lib/product-price.ts` + selects + seed `20260503_003`) |
| Consolidation UX post-retours utilisateur (libelles, ordre des etapes, messages d erreur) | Hub **blocs statuts** + cartes + filtres **livré** ; fiche pharmacien **compacte** + contact patient **RPC** ; affiner microcopie, skeletons, accessibilité |
| **Nom / téléphone patient côté pharmacien** | **Fait** — RPC **`20260503_008`** ; policy **`007` + `009`** (suppression récursion) |
| **Renvoi liste patient en `submitted` / `in_review`** | **Fait** — **`20260503_006`** + UI `PatientProductRequestActions` |

_Ligne reservee transcription des retours utilisateur (a remplir au demarrage prochain)_ :
- Merge / CI GitHub Actions : erreurs **`react-hooks/set-state-in-effect`** suite au durcissement ESLint — traitées localement (**Session 2026-05-04**).
- Essais fonctionnels utilisateur : poursuivre validation manuelle flux complet (alternatives puis passage comptoir apres **`confirmed`**), affinage libellés UX si besoin.

---

## 13) Prompt de reprise (copier/coller prochaine session)

### 13.1) Workflow « demande de produits » — plan apres atelier (prioritaire quand les reponses sont saisies)

**Fichiers fixes dans le depot**:

- `docs/workflow-demande-produits-QUESTIONS.md` — les 41 questions (reference, ne pas les recopier a chaque fois).
- `docs/workflow-demande-produits-REPONSES.md` — **tes reponses** (a completer au fil de l eau ; c est le seul document a tenir a jour de ton cote pour l atelier).

**Prompt conseille** (prochaine session, lorsque `REPONSES.md` est rempli ou partiellement rempli) :

**« Je reprends ProxiPharma. Lis `docs/workflow-demande-produits-REPONSES.md` (mes reponses), `docs/workflow-demande-produits-QUESTIONS.md` si besoin de rappel du libelle des Q1–Q41, puis `CAHIER_DES_CHARGES.md` §0.1, §11 et §12. A partir de mes reponses, propose un plan de developpement clair de A a Z pour finaliser le workflow demande de produits entre patient et pharmacien (jalons, ordre BDD/migrations puis UI, ecart avec l existant). Signale uniquement les questions encore sans reponse. Ensuite on enchaine sur l implementation selon ce plan. Mets le cahier a jour en fin de session si pertinent. »**

### 13.2) Prompt de reprise generique (hors plan atelier detaille)

Texte conseille a copier-coller tel quel puis completer au besoin:

**« Je reprends ProxiPharma. Lis le `CAHIER_DES_CHARGES.md` depuis le §0.1 (routine), puis le §11 Etat actuel, le §12 backlog, et le dernier bloc du §10 Journal. Priorite prod: [PRECISER]. Voici mes remarques: [OPTIONNEL]. Mets le cahier a jour en fin de session. »**

_Le detail des questions workflow produits vit dans §13.1 ; ne pas tout recoller dans ce prompt._

_Ancienne phrase de reprise (alternatives + patient_mark_collected + UI sprint 2) est depassee_: le flux partiel/full cote patient a ete remplace par statut **`completed`** + comptoir pharmacien (`counter_outcome`) ; une grande partie Sprint 2 demande produits est deja en place dans le depot (voir journal)._

### 13.3) Prompt de reprise « continue le workflow demande produits » (mai 2026) — *partiellement dépassé*

**À utiliser après le dernier commit** (alternative patient, passage officine RPC 4 params, PPH, seeds, hubs **`/dashboard/demandes`** + **`/dashboard/pharmacien/demandes`** : onglets tableau de bord / liste filtres ; §10 session **2026-05-05**).

**« Je reprends ProxiPharma. Lis `CAHIER_DES_CHARGES.md` §0.1, **dernier bloc §10 Journal**, §11 (**migrations liste** dont `20260503_001`, `003`, `004**) et §12 backlog. Confirme sur Supabase que les migrations **`20260503_*` non encore jouees sont appliquees** (SQL Editor ordre fichier). Parcours vite les **hubs demandes** (patient + pharma) pour valider affichage filtres / vue tableau de bord. Ensuite poursuis les **§12 jalons ouverts prioritaires** : au choix métier (**Q6/Q38**) arbitrage puis job abandon 24 h ou desactivation **`expires_at` +7 j**, puis motifs annulation (**Q16**), anti-doublon produit + plafond qté (**Q12–Q13**), **`market_shortages`** automatique (**rupture marché**), ou esquisse notifications in-app (**Q34**). Implémente avec migrations versionnées puis UI ; corrige ESLint **`react-hooks/set-state-in-effect`** si tu touches des effets. **Commit + push** en livraison groupée si OK, puis mets à jour le cahier (Journal + États + backlog). Références atelier : `docs/workflow-demande-produits-REPONSES.md` pour le métier hors ambiguïtés. »**

### 13.4) Phrase de reprise courte (recommandée après la session 2026-05-06)

**« Reprends ProxiPharma : `CAHIER_DES_CHARGES.md` §0.1, dernier §10, §11–§12 ; Supabase avec **`008`+`009`** (ne pas réappliquer la policy **`20260503_007`** seule ; ne pas confondre avec **`20260505_007`** codes publics) ; enchaîne le flux demande produits (§12) avec migrations Git ; mets le cahier à jour en fin de session. »**

### 13.5) Phrase de reprise « UI ensuite page par page » (recommandée après le lot plateforme + `20260505_007`)

À copier-coller pour la prochaine session **produit / interface** :

**« Je reprends ProxiPharma côté UI : lis `CONTEXTE.md` puis `CAHIER_DES_CHARGES.md` §11 et §12. On développe **page par page** et **fonctionnalité par fonctionnalité** (polish écrans existants, puis brancher progressivement ordonnances & consultations libres et le reste des placeholders pharmacien/patient). Pas de nouvelle migration sauf blocage technique explicite. Mets le §10 Journal et l’état §11 à jour en fin de session. »**

### Template pour prochaines sessions
- Date:
- Objectif session:
- Decisions prises:
- Changements techniques realises:
- Questions ouvertes:
- Prochaines etapes:
