# Cahier des Charges - ProxiPharma (Document vivant)

Ce document sert de reference produit et technique entre nous.
Il doit etre mis a jour a chaque fin de session pour garder un historique clair des decisions.

## 0.1) Routine de collaboration (profil projet sans outillage lourd — a garder tel quel)

**But**: avancer plusieurs semaines sans perdre la vision, sans divergence BDD/code, avec peu d explications repetitives et sans dependre d une « connexion Supabase » Cursor (impossible sans secrets non versionnes).

Au **demarrage** d une session :
- **Reprise courte** lorsque Supabase est **deja aligne avec les migrations Git** (cas courant apres synchro infra) → utiliser uniquement la **phrase d ouverture** du **§13.5** ; la **tache precise** est donnée dans le message suivant ou dans la meme conversation.
- **Contexte projet, onboarding nouvelle machine, ou fichier SQL nouveau sous `supabase/migrations/`** → lire `CONTEXTE.md`, `CAHIER_DES_CHARGES.md` (**§0.1**, **§11**, dernier bloc **§10 Journal**, **§12** ; **phrase detaillee migrations** sous **§13.5-suite** si besoin). Ne dedouble pas les migrations hors fichiers dans `supabase/migrations/` sans me demander. Si tu touches Supabase : ordre des fichiers `YYYYMMDD_*`. **Ne pas confondre** : migration **`20260503_007`** = policy `profiles` (dangereuse seule, à annuler avec **`20260503_009`**) ; migration **`20260505_007`** = **codes publics** PH / P / D (refs mémorisables).

**Outils utiles (hors migration)** : pour **vider toutes les demandes** en environnement de test → `scripts/clear-all-requests.mjs` (`.env.local` avec `SUPABASE_SERVICE_ROLE_KEY`) ou SQL `supabase/scripts/clear-all-requests.sql` dans l’éditeur Supabase. Plan de tests E2E demandes produits → fichier Canvas Cursor `canvases/product-requests-e2e-test-plan.canvas.tsx` (mention §13.5).

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

### 4.4 Apres validation patient (`confirmed` → préparation / comptoir)

Sans nouvelle validation patient obligatoire pour les ajustements officine courants :

- **Référence figée** : ce que le patient a validé reste lisible en base via **`selected_qty`**, **`patient_chosen_alternative_id`** (principal vs alternative). **UI (écran actions patient `PatientProductRequestActions`, statuts `confirmed` / `processing` / `treated`)** : **cartes compactes** (photo, titre retenu, qté, synthèse disponibilité) **groupées** (à réserver en officine · à commander · cas limites · écart après validation) ; **lignes non retenues** en **section repliable fermée par défaut** (trace) ; **Historique** par ligne → **modal** avec chronologie (**`lib/build-patient-line-timeline-fr.ts`** : origine, réponse officine, validation, audits `audit_v1` filtrés produit, amendements ciblés `request_item_id`, situation actuelle). Le **détail lecture seule** hors ce bloc (statuts sans actions, ex. **clôturé**) peut encore reprendre la **liste complète** dans **`page.tsx`**.
- **Suivi courant** : encart **« Suivi officine »** avec **mêmes champs** (qté, dispo, prix, état). Tant qu'**aucun `counter_outcome` n'est posé** sur la ligne (i.e. la pharmacie n'a pas commencé l'exécution comptoir), l'encart affiche un placeholder **« En cours · la pharmacie n'a pas encore commencé… »** (pas de données techniques exposées). Dès qu'un résultat comptoir est saisi, le bloc bascule en mode complet ; message si **quantité suivie ≠ quantité validée**.
- **Statuts dossier après validation (DB)** : en plus de **`confirmed`**, le workflow produit utilise **`processing`** (préparation officine enregistrée côté système) et **`treated`** (la pharmacie déclare la préparation terminée ; le suivi actif est le **comptoir** jusqu'à **`completed`**). Transitions typiques : premier lot d'ajustements structurés avec canal patient ou première saisie **`reserved`/`ordered`** depuis **`confirmed`** peut faire passer en **`processing`** ; RPC **`pharmacist_mark_request_treated`** passe en **`treated`** lorsque chaque ligne **retenue et non écartée** est cohérente (**`reserved`** sur voie officine disponible / partiel, **`ordered`** sur voie à commander).
- **Après validation — réservation / commande (sans comptoir)** : chaque ligne peut porter **`post_confirm_fulfillment`** (`unset` / `reserved` / `ordered`) — saisie pharmacien en **`confirmed`**, **`processing`** ou **`treated`**. Les **hubs** et les **cartes liste** affichent **`processing`** ou **`treated`** quand le statut DB l'est ; le statut virtuel **`in_progress_virtual`** (« **En préparation** ») subsiste tant que le dossier reste **`confirmed`** avec **au moins une ligne** **`reserved`** ou **`ordered`** mais sans encore **`processing`** en base (rétrocompatibilité avec l'ancre **`post_confirm_fulfillment`** seule).
- **Écart après validation (traçabilité)** : **`request_items.withdrawn_after_confirm`** — ligne encore **retenue** côté patient mais **écartée** du lot actif avec accord tracé ; bloc UI dédié côté patient et pharmacien ; pas de **`post_confirm_fulfillment`** sur ces lignes.
- **Journal des changements structurés** : table **`request_supply_amendments`** (JSON **`amendments`**, canal de confirmation obligatoire par entrée côté RPC) ; RPC **`pharmacist_record_supply_amendments`**. Les ajustements de **qté / dispo / prix / commentaire / date** ou **retrait / réintégration** après validation déclenchent ce journal lorsque l'enregistrement pharmacien détecte un diff ; le lot est associé au **canal + motif optionnel** saisis dans l'UI pharmacien pour ce save. Côté patient, les entrées liées à une ligne (**`request_item_id`**) sont intégrées au **modal Historique produit** ; la **liste violet multi-lots** n’est plus l’élément principal du corps de page sur cet écran.
- **Lignes décochées** (`is_selected_by_patient = false` après réponse patient) : **aucun bloc** Validé / Suivi (juste la mention « Vous n'avez pas retenu cette ligne »).
- **Historique patient** : lors d'un enregistrement d'ajustements après validation, `request_status_history.reason` peut porter un payload **`audit_v1:`** (JSON) expliquant **par produit** les changements (interprété en français dans l'UI) — voir `lib/patient-request-history-audit.ts`. Chaque entrée d'historique affiche désormais **auteur** (Vous / La pharmacie / Système, cf. `historyActorLabel`) **et date** (`formatDateTimeShort24hFr`).
- **Règles officine (UI post-validation)** : la quantité **préparation** est **plafonnée** par la quantité validée tant que la ligne n'est pas marquée **récupérée** (`picked_up`) ; en repassant de **récupéré** à un autre état comptoir, la quantité brouillon est **réalignée** sur la quantité validée avant nouvel enregistrement. Lignes **`cancelled_at_counter`** : **lecture seule** côté pharmacien (traçabilité), avec choix du **motif** (`client_request` / `pharmacy_unable`) et **détail libre** facultatif. Compteur **Annulés** sur les cartes patient : toutes les lignes **`cancelled_at_counter`**, y compris si **`is_selected_by_patient`** repasse à false après action officine. **Comptoir / clôture** : les lignes **`withdrawn_after_confirm`** ne bloquent pas la clôture dossier (hors périmètre retrait actif).

### 4.5 Réponse pharmacien — règles de saisie

- **Disponibilités proposées au pharmacien (lignes patient)** : `Disponible`, `Indisponible`, `À commander`, `Rupture du marché`. **« Partiellement disponible » n'est plus saisissable** : il est **dérivé automatiquement** à l'enregistrement quand `available_qty < requested_qty` (`inferAvailabilityStatusFromQty` dans `lib/pharmacist-availability.ts`). Si la base contient encore `partially_available`, le brouillon repart à `available` et sera réinféré.
- **Disponibilités sur lignes proposées par la pharmacie** (`line_source = 'pharmacist_proposed'`) : **uniquement** `Disponible` ou `À commander`.
- **Annulation totale par la pharmacie** : RPC **`pharmacist_cancel_request(p_request_id, p_reason_text)`** (motif obligatoire ≥ 5 car.) depuis `submitted` / `in_review` / `responded` / `confirmed` / **`processing`** / **`treated`** → `cancelled`. Le patient voit l'événement dans son historique avec auteur « La pharmacie ».
- **Heure de passage patient** : saisie **texte 24 h** (HH:MM, normalisée par `parseFreeTime24h` qui accepte `18`, `18h30`, `1830`, `18:30`). Plus de `<input type="time">`.
- **Le badge « Retenu après réponse patient »** sur la fiche pharmacien n'apparaît qu'à partir du statut `responded` (caché en `submitted` / `in_review`).

### 4.6 Roadmap écrans « demandes produits » MVP — par statut, patient + pharmacien

**Décision méthodo** : on **traite les familles de statuts séparément** (avec changements fonctionnels/UI possibles étape par étape), toujours en **gardant les deux rôles alignés** sur le même jalon quand l’écran existe des deux côtés.

**Ordre de travail validé** :

| Étape | Périmètre métier (libellé grand public) | Côté patient | Côté pharmacien |
|-------|----------------------------------------|--------------|-----------------|
| 1 | **Demande envoyée** (`submitted` / `in_review`) | Page détail + hub — **déjà affinée** | Page détail + hub — **à clôturer** pour ce jalon |
| 2 | **Demande répondue** (`responded`) | À affiner | À affiner |
| 3 | **Validée** (`confirmed` sans entrée en **`processing`** ni virtuel **`in_progress_virtual`** uniquement via lignes) | Affinée (**focus produits validés** : cartes courtes groupées + historique ligne + lignes non retenues repliable ; contact / passage / abandon) | Affinée (synthèse alignée patient, réservé/commandé) |
| 4 | **En préparation officine** (`processing` en DB, ou `confirmed` + `in_progress_virtual` si réservé/commandé sans migration statut) | Affinée (même logique compacte que validée ; pas de liste amendements « pleine page ») | Affinée (enregistrement traçabilité, déclaration traitée si règles OK) |
| 5 | **Traitée** (`treated`) — suivi retrait comptoir jusqu'à **`completed`** | Affinée (idem) | Affinée |

**Statuts « autres » — dossiers figés (règle transverse)**

S’applique aux demandes dont le statut de la ligne `requests` est notamment :

- **`cancelled`** — annulée (ex. par la pharmacie, selon flux existants) ;
- **`abandoned`** — abandonnée (ex. patient / délais métier sans confirmation) ;
- **`expired`** — expirée (si cron / règle applicable en production) ;
- **`completed`** — **clôturée** avec succès (après traitement pharmacien au comptoir / clôture officine selon §4.4 et RPC existantes).

Pour **tous** ces cas :

| Rôle | Modification données | Actions UI |
|------|---------------------|------------|
| Patient | **Interdites** — écran reflète fidèlement le **dernier état** exploitable du dossier (contenu lisible comme au dernier statut métier pertinent). | **Aucune** action de traitement (pas de renvoi, validation, abandon, réservation client, etc. — hors navigation : retour hub, fermer). |
| Pharmacien | **Interdites** — même principe de **lecture fidèle**. | **Aucune** action de traitement (pas envoi réponse, ajustements, comptoir, annulation dossier depuis cette fiche, etc. — hors navigation). |

*Remarque* : ces statuts peuvent avoir des libellés différents en UI (grand public vs interne). La règle produit ci-dessus est **lecture seule + zéro action**, pas une réécriture du libellé de statut dans la colonne technique.

Les étapes du premier tableau ci-dessus couvrent les **parcours encore évoluant** dans le MVP ; les statuts figés du second tableau ne reçoivent **pas** de nouvelles actions au fil des jalons — seulement cohérence d’affichage et stabilité.

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
- `processing` (préparation officine après validation patient ; migration **`20260508_002`**)
- `treated` (préparation déclarée terminée ; retrait comptoir actif ; migration **`20260508_002`**)
- `completed` (dossier clos apres traitement pharmacien au comptoir; voir aussi `counter_outcome` par ligne dans `request_items`)
- `cancelled`
- `abandoned`
- `expired`
- `partially_collected` / `fully_collected` (conserves en enum; hors flux officiel depuis migration 20260502 au profit de `completed` + suivi ligne a ligne au comptoir)

## 10) Journal d'avancement (a mettre a jour chaque fin de session)

### Session 2026-05-13 — supply post-validé (alt. choisie), notifs comptoir, expiration `responded`

**Contexte** : développement continu ; préférence équipe : **en dev, une solution simple + base vidée** vaut mieux qu’un long contournement SQL uniquement pour préserver des données de test obsolètes (demander **`scripts/clear-all-requests.mjs`** / **`supabase/scripts/clear-all-requests.sql`** ou reset Supabase si besoin).

**UI — pharmacien post-`confirmed` / `treated`** : **`app/dashboard/pharmacien/demandes/[id]/page.tsx`** — pour une ligne avec **alternative choisie**, la dispo / date « à commander » et le clamp **`post_confirm_fulfillment`** suivent le **brouillon** (`effectiveAvailSupplyDraft`, `effectiveEtaSupplyDraft`, `inferredAvailabilityForPostConfirmClamp`) comme le payload d’enregistrement, et **`virtualizeItemsForSupplyBuckets`** n’exclut plus ces lignes.

**SQL — migrations** :
- **`20260515_001_no_in_app_notif_counter_picked_up.sql`** — entrée d’historique `counter_outcome:picked_up` : **aucune** ligne dans **`app_notifications`** (trigger **`_emit_in_app_notifications_for_status_history`**).
- **`20260516_001_expire_overdue_responded_at_pilot_30m.sql`** — **`expire_overdue_requests(interval)`** : expiration des **`responded`** dont **`responded_at`** est hors délai (défaut **30 minutes** pour tests ; repasser à **`interval '24 hours'`** ou argument cron en prod stable) + passe **`expires_at`** héritée ; **`abandon_unconfirmed_responded_requests()`** = alias qui appelle **`expire_overdue_requests()`** (un seul batch à planifier côté cron **`service_role`**).

**Lib** : **`lib/patient-request-history-audit.ts`** — libellés FR pour **`auto_expire_after_response_silence`**, **`auto_expire_24h_after_response`**, **`expire_overdue_requests`**.

**Git** : branche **`fix/validated-supply-ecart-ui-modal`** (et alignements **`AGENTS.md`**) ; voir `git log` pour les commits du lot.

---

### Session 2026-05-11 — saisie demande produits (pharmacie), catalogue démo, reset SQL tests

**Objectif** : UX page **`/pharmacie/[id]/demande-produits`** (titres sections, **Qté**, prix **PU/Tot** sans retour à la ligne via composant **`PriceDhInline`**), recherche catalogue (**nom ou laboratoire**, limite 48) partagée **`lib/product-catalog-search.ts`** (patient saisie / édition demande / vue pharmacien alternatives-proposition) ; enrichissement BDD démo (**photos** sur libellés exacts seed MAROC **`20260503_003`**, **~55** produits **`seed_ma_catalog_v2`**) ; script reset demandes (**`supabase/scripts/clear-all-requests.sql`**) : null **`patient_chosen_alternative_id`** avant **`DELETE requests`**.

**SQL — migrations** (à appliquer dans l’ordre sur Supabase si pas encore jouées) :
- **`20260511_001_pharmacist_in_app_notif_trim_body.sql`**
- **`20260511_002_seed_products_unsplash_photo_urls.sql`** (insert noms courts + photo ; idempotent)
- **`20260511_003_products_photo_url_backfill_by_name.sql`** (update photo sur ces noms courts si `photo_url` vide)
- **`20260512_001_ma_catalog_photos_and_extended_products.sql`** (update photo **noms longs** catalogue MAROC + insert extension **`seed_ma_catalog_v2`**)

**Next.js / lib** : **`app/pharmacie/[id]/demande-produits/page.tsx`**, **`PatientProductRequestActions.tsx`**, **`app/dashboard/pharmacien/demandes/[id]/page.tsx`**, **`next.config.ts`** (`images.remotePatterns` Unsplash si besoin).

**Git** : branche **`fix/rls-recursion`** — voir `git log` pour les commits du lot.

---

### Session 2026-05-09 — patient compact après validation + pharmacien supply brouillon + comptoir simplifié + notifs + SQL `20260509_*`

**Objectif** : parité mobile ; après **`confirmed`**, vue patient **lignes retenues** en cartes courtes + historique par produit ; côté officine, **une seule vague d’enregistrement** (brouillon jusqu’à **Enregistrer les modifications**), **écarter** avec canal/description dans le panneau (sans modal dédié), **comptoir** réduit à **en attente / récupéré**, **clôture** possible dès **au moins une** ligne retenue **récupérée** (confirmation si d’autres lignes en attente) ; **notifs pharmacien** sans auto-notification de l’acteur.

**SQL — migrations** :
- **`supabase/migrations/20260509_001_arrived_reserved_fulfillment.sql`** — ajustements RPC / fulfillment alignés avec le flux « reçu → disponible » (voir fichier pour le détail).
- **`supabase/migrations/20260509_002_pharmacist_notifications_exclude_actor.sql`** — **`_emit_in_app_notifications_for_status_history`** : insert pharmacien **exclut** `recipient_id = changed_by` (jobs avec `changed_by` null → tous les pharmaciens notifiés).

**Next.js / lib (extrait)** :
- **Patient** : **`lib/build-patient-line-timeline-fr.ts`**, **`PatientProductRequestActions.tsx`**, **`app/dashboard/demandes/[id]/page.tsx`** ; **`lib/supply-line-post-confirm.ts`** + badge **Ajout officine** conditionnel ; vignettes **11×11** sur cartes validées.
- **Pharmacien** : **`app/dashboard/pharmacien/demandes/[id]/page.tsx`**, **`components/pharmacist/pharmacist-supply-compact-line.tsx`**, **`pharmacist-supply-amendment-confirm-modal.tsx`**, **`components/requests/line-history-modal-fr.tsx`**, **`lib/patient-line-suivi-fr.ts`**, **`lib/patient-pharma-change-notice-fr.ts`**, **`lib/pharmacist-availability.ts`** (post-confirm), etc.
- **Hubs / répondue** : **`demande-hub-ui.tsx`**, refs antérieures (`updated_at`, **Répondue - à valider**, répondue figée).

**Contrôle** : `npx tsc --noEmit` OK.

**À appliquer côté Supabase** : **`20260509_001`** puis **`20260509_002`** (après **`20260508_002`** déjà requis pour `processing` / `treated`).

**Git (branche `fix/rls-recursion`)** : commit groupé **`33c68ef`** (et commits antérieurs du 2026-05-09 pour hubs/timeline si besoin — voir `git log`).

---

### Session 2026-05-08 (workflow traitement) — `processing` / `treated`, amendements, hubs

**Objectif** : statuts DB explicites après validation patient, journal des changements avec canal de confirmation, alignement patient/pharmacien (regroupement lignes + bloc « écart après validation »), déclaration « demande traitée » et poursuite comptoir.

**SQL — migration** :
- **`supabase/migrations/20260508_002_processing_treated_supply_workflow.sql`** — enum **`processing`**, **`treated`** ; **`request_items.withdrawn_after_confirm`** ; **`request_supply_amendments`** + RLS ; RPC **`pharmacist_record_supply_amendments`**, **`pharmacist_mark_request_treated`** ; extension **`pharmacist_set_post_confirm_fulfillment`**, **`patient_update_planned_visit_after_confirmation`**, **`pharmacist_cancel_request`**, **`patient_abandon_request`**, comptoir / clôture ; notifications **`processing`** / **`treated`**.

**Next.js / lib** :
- **`lib/patient-confirmed-line-buckets.ts`**, **`lib/supply-amendment-channels.ts`**, **`lib/request-display.ts`**, **`lib/demandes-hub-buckets.ts`**, **`components/requests/demande-stat-dashboard.tsx`**, **`demande-hub-ui.tsx`**, hubs patient/pharmacien.
- **`PatientProductRequestActions.tsx`**, **`app/dashboard/demandes/[id]/page.tsx`** : statuts **`processing`** / **`treated`**, chargement amendements.
- **`app/dashboard/pharmacien/demandes/[id]/page.tsx`** : synthèse type patient, case retrait après validation, enregistrement + RPC amendements, bouton déclarer traitée.

**Contrôle** : `npx tsc --noEmit` OK sur l’atelier.

**À appliquer côté Supabase** : **`20260508_002_processing_treated_supply_workflow.sql`** (après les migrations déjà présentes sur le projet).

---

### Session 2026-05-08 (suite) — Cahier §4.6 roadmap statuts MVP + dossiers figés

**Décision doc** — formalisation dans **`§4.6`** :
- Ordre des jalons UI « demandes produits » : **envoyée** (patient ✅, pharmacien à clôturer pour le jalon) → **répondue** patient+pharmacien → **validée** patient+pharmacien → **en traitement** patient+pharmacien.
- Règle transverse **`cancelled` / `abandoned` / `expired` / `completed`** : affichage fidèle au dernier état, **aucune modification**, **aucune action** hormis navigation retour liste / fermeture ; patient et pharmacien.
- Pas de nouveau code applicatif ni migration sur ce bloc (documentation seule).

**Git** — commit + push par l’assistant après mise à jour du cahier.

### Session 2026-05-08 — UI demandes produits (patient + pharmacien), reprise historique patient, stabilisation CI lint/build

**Objectif** : finaliser la boucle UX entre **création patient** → **demande envoyée** → **traitement pharmacien**, avec continuité visuelle mobile, règles métier de saisie plus robustes, puis corriger le blocage CI.

**SQL / Infra** :
- **Aucune nouvelle migration** sur ce lot (infra Supabase inchangée).
- Réutilisation des structures existantes (`request_items`, `request_item_alternatives`, `request_comments`, RPC déjà en place).

**Next.js / lib — patient** :
- **`app/pharmacie/[id]/demande-produits/page.tsx`** : refonte mobile des cartes (recherche + produits ajoutés) ; redirection post-envoi vers le détail **`/dashboard/demandes/[id]`**.
- **`app/dashboard/demandes/[id]/PatientProductRequestActions.tsx`** : mode resubmit aligné visuellement sur la page de saisie (cartes homogènes), recherche activée uniquement en mode **Modifier**, footer sticky synthèse.
- **`app/dashboard/demandes/[id]/page.tsx`** : simplification en-tête (réf + date + statut), suppression du bloc montant/produits, retrait historique intermédiaire puis **historique replacé en bas de page**.

**Next.js / lib — pharmacien** :
- **`app/dashboard/pharmacien/demandes/[id]/page.tsx`** :
  - en-tête enrichi (réf, statut, date, nb lignes) + contact client direct (**appeler / WhatsApp / SMS / email**) ;
  - règles de saisie durcies : auto-ajustement dispo selon quantité (`available` / `partially_available` / `unavailable`), `market_shortage` non modifiable, `to_order` force la quantité demandée ;
  - prix rendu en lecture seule côté pharmacien ;
  - réaction du pharmacien aux commentaires produit patient **facultative** ; tout moment : modifier ou effacer (« Retirer ma réaction »), y compris en vue « Réponse publiée » sans repasser par « Modifier la réponse » ;
  - alternatives : ligne pliable/dépliable, compteur, ajout/suppression, cartes compactes (photo + prix + qté figée).
  - ajout d’un **commentaire global pharmacien** persistant via `request_comments`.

**CI / Qualité** :
- Erreur GH Actions `react-hooks/set-state-in-effect` corrigée sur **`app/dashboard/demandes/[id]/page.tsx`** (suppression de l’effet déclenchant `loadHistory`).
- Vérifications locales : **`npm run lint`** ✅ (warnings `no-img-element` non bloquants), **`npm run build`** ✅.

**Remarque ouverte (non implémentée)** :
- Heure optionnelle dédiée pour les lignes **`À commander`** côté pharmacien : demanderait un micro-lot schéma (colonne horaire) si validation métier.

**Suite chantier « demandes envoyées » (reprise même lot, aucune migration)** :
- Détail patient **`submitted` / `in_review`** : encart **« Demande envoyée »** (rôle des notifications, liens hub filtré `envoyées` + toutes les demandes).
- Détail pharmacien **`submitted` / `in_review`** : encart **« Demande envoyée par le patient »** (prochaines étapes, lien liste filtrée `envoyées`).
- Liste hubs : messages **liste vide** contextualisés quand le filtre **Envoyées** est actif.
- Cartes liste pharmacien : panneau pliable renommé **« Contenu envoyé par le patient »** tant que le dossier est en **`submitted` / `in_review`** (sans mention comptoir prématurée).

---

### Session 2026-05-07 (suite 5) — Post-`confirmed` : `post_confirm_fulfillment`, passage en `confirmed`, libellés hub

**Objectif** : séparer nettement **validée par le patient** (aucune réservation/commande pharmacien sur les lignes) de **en traitement** (au moins une ligne **`reserved`** ou **`ordered`**). Permettre au patient de **modifier date/heure de passage** une fois **`confirmed`** (RPC dédiée). Harmoniser badges et buckets avec ce vocabulaire.

**SQL — migration ajoutée** :
- **`supabase/migrations/20260507_005_post_confirm_fulfillment_visit_rpc.sql`** — type/colonne **`request_items.post_confirm_fulfillment`** (`unset` | `reserved` | `ordered`), index, RPC **`pharmacist_set_post_confirm_fulfillment`**, **`patient_update_planned_visit_after_confirmation`** (mêmes fenêtres que la validation initiale), ajustements notifications (ex. pas de notif patient « gratuite » sur seul passage en **`in_review`** ; libellé « mise à jour » côté pharmacien selon contexte).

**Next.js / lib** :
- **`app/dashboard/demandes/patient-demandes-hub.tsx`**, **`app/dashboard/pharmacien/demandes/pharmacist-demandes-hub.tsx`** : `status_for_dashboard` = **`in_progress_virtual`** si **`confirmed`** et **`post_confirm_fulfillment`** réservé ou commandé sur au moins une ligne (pas seulement l’ancre comptoir).
- **`lib/demandes-hub-buckets.ts`** : titres **« Validée par vous »** / **« Validée par le client »** pour le bucket **`confirmed`** ; **« En traitement »** pour le bucket virtuel.
- **`lib/request-display.ts`** : court pharmacien **`confirmed`** → **« Validée client »**.
- **`lib/patient-request-list-summary.ts`**, **`lib/patient-confirmed-line-buckets.ts`**, **`components/requests/demande-hub-ui.tsx`**, **`app/dashboard/demandes/[id]/page.tsx`**, **`PatientProductRequestActions.tsx`**, **`app/dashboard/pharmacien/demandes/[id]/page.tsx`**, **`app/pharmacie/[id]/demande-produits/page.tsx`** : sélection `post_confirm_fulfillment`, synthèse / groupement lignes, UI pharmacien (réservé vs commandé).
- **`lib/pharmacist-availability.ts`** : lignes **`pharmacist_proposed`** — pas d’inférence automatique **`partially_available`** lorsque `available_qty < requested_qty` (reste **`available`**).

**Contrôle** : `npm run lint` ✅, `npm run build` ✅.

**À appliquer côté Supabase** : **`20260507_005_post_confirm_fulfillment_visit_rpc.sql`** (après **`004`**), avec **`supabase db push`** ou copie depuis le fichier versionné. **Si déjà appliquée sur votre projet** (cas courant après synchro infra) : aucune action ; en cas de doute, vérifier en base la présence de **`request_items.post_confirm_fulfillment`** et des RPC **`patient_update_planned_visit_after_confirmation`** / **`pharmacist_set_post_confirm_fulfillment`**.

---

### Session 2026-05-07 (suite 4) — Hubs demandes, passage prévu `confirmed`, notifications, dropdown mobile

**Objectif** : retours UX liste + détail patient/pharmacien + cohérence des notifications (mise à jour vs nouvelle demande, motif annulation pharmacien) sans régression workflow.

**SQL — migrations ajoutées** :
- **`supabase/migrations/20260507_004_in_app_notifications_reasoning.sql`** — réécrit **`_in_app_notification_patient`** / **`_in_app_notification_pharmacist`** / **`_emit_in_app_notifications_for_status_history`** : distinction **`submitted`** nouvelle vs mise à jour patient (`old_status`), **motif** dans notif patient si **`pharmacist_cancel|<motif>`**, notifs pharmacien **`expired`**, annulation avec contexte.

**Next.js** :
- **`components/requests/demande-hub-ui.tsx`** : cartes liste patient (`submitted`/`in_review`) sans compteurs alternatives / ajouts pharmacie ; libellés grand public ; cartes pharmacien « envoyées » : **Lignes** seulement ; suppression bouton **Copier**.
- **`app/dashboard/demandes/[id]/PatientProductRequestActions.tsx`** : fenêtre de passage calculée aussi en **`confirmed`** (`patient_chosen_alternative_id`) ; champs date/heure affichés pour **« Mettre à jour ma date de passage »** ; bandeau **produit proposé par la pharmacie** en `confirmed` ; libellés **Suivi officine** simplifiés.
- **`app/dashboard/demandes/[id]/page.tsx`** : même bandeau / titres pour lignes **`pharmacist_proposed`** ; historique **`pharmacist_cancel|<motif>`** ; **key** inclut passage prévu pour resync état.
- **`app/dashboard/pharmacien/demandes/[id]/page.tsx`** : badge **« Non distribué au patient »** (remplace ancienne formulation comptoir).
- **`components/layout/platform-header.tsx`** : liste notifs filtrée **`recipient_id`** ; panneau mobile léger **`translate-x-1`**.

**Contrôle** : `npm run lint` ✅, `npm run build` ✅.

**À appliquer côté Supabase** : **`20260507_004_in_app_notifications_reasoning.sql`**.

---

### Session 2026-05-07 (suite 3) — Workflow demandes : terminologie, UX mobile, parité validé/officine, annulation pharmacie

**Objectif** : traiter une liste de 14 retours utilisateur sur le détail demande (patient + pharmacien) suite aux deux premiers lots du 2026-05-07.

**SQL — migrations ajoutées** :
- **`supabase/migrations/20260507_003_pharmacist_cancel_request.sql`** — RPC **`pharmacist_cancel_request(p_request_id, p_reason_text)`** : annulation totale par la pharmacie depuis `submitted/in_review/responded/confirmed` → **`cancelled`**, motif obligatoire (≥ 5 caractères), trace history `pharmacist_cancel|<motif>`.

**Next.js / lib** :
- `lib/pharmacist-availability.ts` :
  - `PHARMACIST_AVAILABILITY_OPTIONS` : suppression de **« Disponible partiellement »** (statut désormais dérivé).
  - Nouveau **`PHARMACIST_PROPOSED_AVAILABILITY_OPTIONS`** (`Disponible` / `À commander`) pour les lignes `pharmacist_proposed`.
  - **`inferAvailabilityStatusFromQty(...)`** : passe `available` à `partially_available` si `available_qty < requested_qty`.
- `lib/request-display.ts` : ajout **`historyActorLabel(role, reason)`** (Vous / La pharmacie / Système — convention de préfixes `patient_*` / `pharmacist_*` / `auto_*` / `audit_v1:*`).
- `app/dashboard/pharmacien/demandes/[id]/page.tsx` :
  - Menu Dispo bascule sur les options proposées-only quand la ligne est `pharmacist_proposed`.
  - `partially_available` n'est plus saisi : `buildItemUpdatePayload` + `publishResponse` réinfèrent automatiquement le statut. Brouillon : si la base contient `partially_available`, le draft repart à `available`.
  - Badge **« Retenu après réponse patient » / « Non retenu »** caché sur `submitted` / `in_review`.
  - Nouveau bloc **« Annuler cette demande »** (textarea motif → RPC ci-dessus).
  - Nouveau bouton **« Voir l'historique »** : timeline + auteur + date (`historyActorLabel("pharmacien", reason)` + `formatDateTimeShort24hFr`).
- `app/dashboard/demandes/[id]/PatientProductRequestActions.tsx` :
  - Resubmit mobile : quantités via boutons **+/−** + input texte tabular ; bouton « Modifier » ↔ **« Annuler les modifications »** (reset complet : lignes, note, recherche) ; **« Mettre à jour et renvoyer »** **caché** tant que pas en mode édition.
  - Heure de passage : **`<input type="text">`** 24 h avec normaliseur `parseFreeTime24h` (accepte `18`, `18h30`, `1830`, `18:30`).
  - Cartes `confirmed` : `is_selected_by_patient = false` → message « Vous n'avez pas retenu cette ligne… » (plus de blocs Validé / Suivi).
  - **Parité de champs** : « Ce que vous avez validé » et « Suivi officine » présentent qté / dispo / prix / état.
  - **« En cours »** : tant qu'aucun `counter_outcome` n'est posé sur la ligne, le bloc « Suivi officine » affiche le placeholder « En cours · la pharmacie n'a pas encore commencé… ».
- `app/dashboard/demandes/[id]/page.tsx` :
  - Mêmes blocs symétriques pour `completed` / `partially_collected` / `fully_collected`.
  - Historique patient : auteur + date sur chaque entrée.
- Notifications mobile (`components/notifications/in-app-notification-item.tsx` + `app/dashboard/notifications/page.tsx`) : `min-w-0` / `max-w-full` / `overflow-hidden` / `break-words` pour empêcher le débordement à gauche.

**Contrôle** : `npm run build` ✅ (29/29 pages, TypeScript OK), `npm run lint` ✅.

**À appliquer côté Supabase** : `20260507_003_pharmacist_cancel_request.sql`.

---

### Session 2026-05-06 (suite) — Refonte UI « Mes demandes de produits / Toutes les demandes »

**Objectif** : rendre l’écran liste beaucoup plus lisible (public peu digitalisé), compact et orienté compréhension immédiate.

**Next.js** :
- **`/dashboard/demandes`** (vue **Toutes les demandes**) : bloc **Filtres et recherche** séparé visuellement (encart dédié, compact, labels plus explicites).
- **Cartes patient** (`components/requests/demande-hub-ui.tsx`) : design plus compact/structuré, sections nettes (entête, statut, compteurs, total, CTA détail), lisibilité renforcée.
- **Suppression** du bouton **Copier référence** sur les cartes patient de cette vue.
- Enrichissement des données lues sur la liste (`request_items` + alternatives) pour calculer les métriques métier demandées.
- **Statut intermédiaire UI** ajouté côté patient (virtuel, sans migration à l’époque) : quand une demande est `confirmed` et que l’exécution post-validation a démarré, affichage **« En traitement »** au lieu de **« Validée »** (depuis **`20260507_005`** : voir `post_confirm_fulfillment` ; avant ce lot : proxy via comptoir, voir journal suite 5).
- Compteurs carte selon statut :
  - **`responded`** : nb produits principaux, nb alternatives proposées, nb produits proposés officine ; total basé sur **quantités demandées initialement**.
  - **`confirmed` / `En traitement` / `completed`** : total basé sur **produits validés** ; compteurs validés (principaux / alternatives / proposés).
  - **`En traitement`** : compteurs opérationnels visibles (en attente, récupérés, annulés, réservés, commandés non reçus selon maquette).

**Libs** :
- `lib/patient-request-list-summary.ts` : nouveau calculateur de synthèse (totaux + compteurs par origine/validation/comptoir).
- `lib/request-display.ts` : libellé + style badge pour le statut UI virtuel `in_progress_virtual` = **En traitement**.

**Contrôle** : `npm run lint` OK.

---

### Session 2026-05-06 (suite 2) — Dashboard patient : cohérence visuelle avec la liste

**Next.js** :
- `components/requests/demande-stat-dashboard.tsx` : bloc dashboard redesigné avec encart distinct, titre d’aide, cartes plus lisibles (contraste, surfaces blanches, CTA « ouvrir », meilleure séparation visuelle).
- Objectif : aligner la lisibilité du **Tableau de bord** sur la nouvelle vue **Toutes les demandes** pour un usage plus simple côté patient.

**Contrôle** : `npm run lint` OK.

---

### Session 2026-05-06 (suite 3) — Blocs dashboard : ajout statut virtuel « en traitement préparation » (statut virtuel UI)

**Next.js** :
- `lib/demandes-hub-buckets.ts` : nouveau bucket **`en_preparation`** pour patient/pharmacien ; `bucketForStatusParam` généralisé par liste de buckets ; comptage basé sur un statut dashboard dérivé.
- `app/dashboard/demandes/patient-demandes-hub.tsx` : dérivation `status_for_dashboard` = **`in_progress_virtual`** quand `status='confirmed'` et progression détectée sur lignes validées (initialement via comptoir).
- `app/dashboard/pharmacien/demandes/pharmacist-demandes-hub.tsx` : même logique dérivée, avec chargement `request_items(...)` pour calculer le bucket.
- `components/requests/demande-stat-dashboard.tsx` : compatibilité `status_for_dashboard` pour compter les blocs sur le statut dérivé.

**Règle métier UI (évoluée depuis suite 5 du 2026-05-07)** :
- **Validée** : `confirmed` sans **`post_confirm_fulfillment`** réservé/commandé sur une ligne (ni ancienne logique comptoir seule avant **`005`**).
- **En traitement** (`in_progress_virtual`) : **`20260507_005`** — `confirmed` avec au moins une ligne **`reserved`** ou **`ordered`** (libellés hub : **Validée par vous / le client** vs **En traitement**).

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

### Session 2026-05-06 — demandes produits : post-`confirmed`, historique audit, UX & reset tests

**Patient (détail + actions `confirmed`)** : double affichage **validation figée** vs **préparation actuelle** ; historique avec entrées **audit structuré** `audit_v1:` lors des enregistrements pharmacien après validation (`lib/patient-request-history-audit.ts`). En **`responded`** : encart **produit proposé par la pharmacie** + **motif** ; option **« Je ne prends aucune option »** toujours lisible si le principal est en rupture. Compteur **Annulés** sur cartes hub : compte **toutes** les lignes **`cancelled_at_counter`** (y compris après désélection officine) ; statut virtuel **En préparation** si toute ligne a un **`counter_outcome`** non `unset` (même hors « retenu patient »).

**Pharmacien (`/dashboard/pharmacien/demandes/[id]`)** : bandeau **choix patient** (principal / alternative + qté) en **`confirmed` / `completed`** ; alternatives **mises en avant** vs **indicatif** ; **plafond quantité préparation** = validation patient tant que pas **récupéré** ; **réinitialisation** de la qté brouillon si passage **récupéré → autre** ; lignes **sans distribution comptoir** en **lecture seule** ; libellés **sans confusion** client vs comptoir. **Brouillon** : fusion au `load()` — les saisies non encore persistées ne sont plus écrasées par un reload (ex. après **proposer un produit**).

**Maintenance** : `scripts/clear-all-requests.mjs` + `supabase/scripts/clear-all-requests.sql` — suppression **toutes** les `requests` + reset **`pharmacy_request_ref_counters`** pour repartir les tests (**`SERVICE_ROLE`** requis pour le script JS).

**Plan de tests** : canvas Cursor **`canvases/product-requests-e2e-test-plan.canvas.tsx`** (parcours patient / pharmacien / notifs / cas limites).

**Branche livrée** : **`fix/rls-recursion`** (voir `git log` pour références de commits — lot incluant audits UI, merges brouillon, scripts reset).

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
  - `supabase/migrations/20260507_001_patient_abandon_cancel_expire_clone.sql` (règles abandon/annulation/expiré ; batch 24 h → **`expired`** ; RPC **`patient_create_followup_from_expired_product_request`**)
  - `supabase/migrations/20260507_002_counter_cancel_reason.sql` (motifs annulation ligne au comptoir : `client_request` / `pharmacy_unable` + détail libre, RPC `pharmacist_set_item_counter_outcome` étendue)
  - `supabase/migrations/20260507_003_pharmacist_cancel_request.sql` (**RPC `pharmacist_cancel_request`** : annulation totale par la pharmacie avec motif obligatoire)
  - `supabase/migrations/20260507_004_in_app_notifications_reasoning.sql` (notifs : mise à jour vs nouvelle demande, motif annulation pharmacien, pharmacien notifié sur **`expired`**)
  - `supabase/migrations/20260507_005_post_confirm_fulfillment_visit_rpc.sql` (**`post_confirm_fulfillment`** par ligne après **`confirmed`**, RPC passage patient **`patient_update_planned_visit_after_confirmation`**, RPC **`pharmacist_set_post_confirm_fulfillment`**, ajustements notifs associés)
  - `supabase/migrations/20260508_002_processing_treated_supply_workflow.sql` (statuts **`processing`** / **`treated`**, **`withdrawn_after_confirm`**, **`request_supply_amendments`**, RPC amendements / traitée / comptoir / annulation, notifs étendues)
  - `supabase/migrations/20260509_001_arrived_reserved_fulfillment.sql` (fulfillment / RPC — alignement reçu-disponible, voir fichier)
  - `supabase/migrations/20260509_002_pharmacist_notifications_exclude_actor.sql` (notif pharmacien : pas de destinataire = **`changed_by`**)
  - `supabase/migrations/20260511_001_pharmacist_in_app_notif_trim_body.sql` (corps notif in-app pharmacien allégé)
  - `supabase/migrations/20260511_002_seed_products_unsplash_photo_urls.sql` + `20260511_003_products_photo_url_backfill_by_name.sql` (photos Unsplash noms **courts** ; le **003** ne couvre pas les libellés longs du seed MAROC — voir **`20260512_001`**)
  - `supabase/migrations/20260512_001_ma_catalog_photos_and_extended_products.sql` (photos sur noms **exact** `20260503_003` + catalogue démo **`seed_ma_catalog_v2`**)
  - `supabase/migrations/20260512_002_remove_request_processing_status.sql` (retrait statut **`processing`** au profit de **`confirmed`** + **`treated`** ; RPC / triggers / notifs alignés — détail dans le fichier)
  - `supabase/migrations/20260514_001_in_app_notification_copy_tuning.sql` (libellés in-app patient ; `DROP FUNCTION` des deux surcharges **`_in_app_notification_patient`** avant `CREATE` si besoin)
  - `supabase/migrations/20260515_001_no_in_app_notif_counter_picked_up.sql` (pas de notif in-app pour **`counter_outcome:picked_up`**)
  - `supabase/migrations/20260516_001_expire_overdue_responded_at_pilot_30m.sql` (**`expire_overdue_requests(interval)`** : silence depuis **`responded_at`** + **`expires_at`** ; défaut **30 min** pilote ; **`abandon_unconfirmed_responded_requests`** → alias)

Regles fonctionnelles retenues (alignement dernier atelier):
- A la **`responded` -> `confirmed`**, le patient indique une **date de passage** (bornes métier CAS : 4 jours sans « à commander » sélectionné, sinon jusqu à **ETA max + 3 j** pour les lignes « à commander » de sa sélection) et une **heure optionnelle** ; données stockées sur **`requests`**, effacées si le patient **renvoie** la demande (`submitted`).
- A la **`responded` -> `confirmed`**, le patient peut choisir pour chaque ligne le **produit principal** ou **une alternative** proposee (`patient_chosen_alternative_id`), ou **rien** pour la ligne.
- **Référentiel catalogue** : affichage **PPH** (`products.price_pph`) partout où le catalogue est lu sur les parcours produits lorsque renseigné ; **prix de réponse** pharmacien distingué (« Prix pharmacie » / champ `request_items.unit_price`).
- Le client peut **modifier et renvoyer** une demande produit **avant réponse** (`submitted`|`in_review`) ou **après réponse** (`responded` uniquement pour ce flux ; en **`confirmed`** le renvoi liste est retiré côté UI — abandon possible) via RPC `patient_resubmit_product_request_after_response` → retour **`submitted`**, reset préparation pharma.
- Le **retrait reel** au comptoir est porte par le **pharmacien**: colonne par ligne `request_items.counter_outcome` (en UI post-validé **saisie brouillon** limitée à **`unset`** / **`picked_up`** pour les lignes non figées ; valeurs legacy **`deferred_next_visit`** / **`cancelled_at_counter`** restent en base et sont affichées en lecture seule ou normalisées à l’enregistrement). **Clôture** dossier : **`pharmacist_complete_request_after_counter`** accessible dès qu’**au moins une** ligne retenue (non écartée) est **`picked_up`**, avec **confirmation** si d’autres lignes retenues ne le sont pas encore.
- **Après réponse** : l’app ne renseigne plus **`expires_at` +7 j** sur publication (pilote). L’expiration **`responded`** sans validation patient repose sur **`expire_overdue_requests()`** ( **`service_role`** , cron ) : comparaison **`responded_at`** vs **`now()`** ( **`timestamptz`** , OK Maroc ) ; délai pilote **30 min** par défaut dans **`20260516_001`** ( repasser à **24 h** ou passer l’intervalle en argument cron en prod ) ; **`expires_at`** non nul reste pris en charge en seconde passe. **`abandon_unconfirmed_responded_requests()`** appelle la même implémentation. Les **`request_items`** sont limités à **qté 1–10** et **un seul `product_id` par demande**.
- Les statuts enum `partially_collected` / `fully_collected` restent en base mais le flux officiel livre passe par **`completed`**; `patient_mark_collected` nest plus callable par le JWT patient (obsolete).

Implémentation frontend associée repo (voir journal §10 dont **Sessions 2026-05-03**, **2026-05-05**, **2026-05-06** et **lot plateforme / codes publics 2026-05-05**):
- **`/`** annuaire + recherche par code officine **`public_ref`** + lien carte vers fiche **`/pharmacie/[id]`** (affiche aussi le code)
- **`/pharmacie/[id]/demande-produits`**: création demande **`submitted`**
- **`/dashboard`** (résumé / routage rôle), **`/dashboard/demandes`** (hub + **filtre par réf.** + codes **`request_public_ref`** sur cartes), **`/dashboard/demandes/[id]`** (ref mémorable + code officine en détail)
- **`/dashboard/demandes`** (vue liste) : refonte UX des filtres/cartes ; suppression bouton copie ; compteurs et montants contextualisés (`responded` vs validé/en traitement/clôturé) ; statut intermédiaire UI **En traitement** (virtuel : `confirmed` + **`post_confirm_fulfillment`** `reserved`/`ordered`, migration **`20260507_005`**)
- **`/dashboard/demandes`** et **`/dashboard/pharmacien/demandes`** (vue dashboard) : bloc **En traitement** alimenté par le même statut dérivé ; bucket **Validée par vous / le client** pour **`confirmed`** sans réservation/commande
- **`/dashboard/demandes/[id]`** (détail patient) : refonte orientée produit avec header sticky montant+volume+passage prévu et actions globales en bas ; date de passage modifiable aussi en `confirmed` côté UI/app
- **`/dashboard/pharmacien`** (tableau de bord analytics + liens), **`/dashboard/pharmacien/demandes`** (idem refs + **code client** sur cartes), **`/dashboard/pharmacien/demandes/[id]`**, **`/dashboard/pharmacien/clients`** (recherche par **`patient_ref`**)
- **Chrome** : **`components/layout/platform-*.tsx`** — nav patient & pharmacien (ordonnances / consultations libres en menu, etc.), notifs in-app header
- **Patient** : **`/dashboard/patient/*`** (paramètres avec **code client**, pharmacies, liste souhaits, ordonnances/consultations libres désormais branchées en listes filtrées par type)
- **Pharmacien** : **`/dashboard/pharmacien/ordonnances`** et **`/dashboard/pharmacien/consultations-libres`** branchées sur les demandes existantes de l’officine (filtre `request_type`, cartes simples, lien détail)
- Auth **`/auth`** + **`lib/post-auth-redirect.ts`**
- **`lib/patient-request-history-audit.ts`** — sérialisation / lecture **`audit_v1:`** dans `request_status_history.reason` pour l’historique patient après ajustements **`confirmed`**.
- **`scripts/clear-all-requests.mjs`** — reset complet des demandes + compteurs ref publique (tests ; clé **`SUPABASE_SERVICE_ROLE_KEY`**).
- Travail incrémental sur branche **`fix/rls-recursion`** ou lots **`fix/validated-supply-ecart-ui-modal`** ; derniers lots : plateforme + codes **`20260505_007`**, puis post-**`confirmed`** + audit + resets + expiration/notifs (**voir dernier bloc §10** et `git log`).

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
- **Expiration après `responded`** : **implémenté** — **`expire_overdue_requests(interval)`** + cron **`service_role`** (**`20260516_001`** ; défaut **30 min** pilote, viser **24 h** en prod ou argument explicite au cron). **`expires_at` +7 j** reste optionnel côté legacy ; **`abandon_unconfirmed_responded_requests()`** = alias.  
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
4. **Post‑`confirmed`** : **livré** (§4.4 + §4.5, sessions **2026-05-06** et **2026-05-07**) — deux niveaux lecture patient (validé vs préparation) à **parité de champs** (qté / dispo / prix / état), placeholder **« En cours »** tant que la pharmacie n'a pas touché au comptoir, règles qté officine avant récupération, alternatives indicatif vs retenu, lignes fermées lecture seule, historique **`audit_v1`** + auteur/date, **annulation globale par la pharmacie avec motif** (RPC `pharmacist_cancel_request`), **annulation patient ↔ statuts** (cancelled / abandoned / expired), **« partiellement disponible » dérivé**, lignes **proposées** restreintes à `Disponible` / `À commander`, heure de passage en **saisie texte 24 h**, **resubmit mobile** avec +/− + bouton « Annuler les modifications ». Reste : raffinement **Q31** / **Q18** libellés et champs métier si besoin.  
5. **Tâches planifiées** : job **`expire_overdue_requests()`** ( et alias **`abandon_unconfirmed_responded_requests()`** ) ✓ — **`responded_at`** + option **`expires_at`** ; **cron `service_role`** obligatoire ; délai pilote **30 min** en **`20260516_001`** ; **`expires_at` +7 j** désactivé côté app à la publication ✓ ; **Q34 in-app MVP** ✓ (dashboards + hubs).  
6. **Espace Admin** minimal issu du jalon BDD §9.

**Écart principal avec le déjà livré** : flux **`responded` → `confirmed`** inclut désormais **alternative + passage + validation serveur associée**. **Motifs annulation**, **anti-doublon / plafond qté**, **`market_shortages`** auto, **expiration après silence sur `responded`** (**`expire_overdue_requests(interval)`** + cron **`service_role`** ; pilote **30 min** en **`20260516_001`**), **commentaires ligne patient (Q11)**, **propositions pharmacien (Q20)** et **notifications in-app MVP (Q34)** sont en place (migrations **`20260504_001`** + **`20260504_002`**). **Q35** : file **`notification_external_queue`** + préférences + UI opt-in (**`20260505_001`**) ; **envoi réel** email/SMS/WA via worker + prestataires **reste à brancher**. Restent notamment **réglage délai prod (24 h)** et **cron** sur Supabase, **admin pilote**, **micro-UX** (récap Q28/Q23, libellés « comptoir »).

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
| **Auto expiration** cron supabase **`expire_overdue_requests(interval)`** | **`responded`** + **`responded_at`** hors délai ( défaut **30 min** pilote dans **`20260516_001`** ; viser **24 h** en prod ) + passe **`expires_at`** ; **`abandon_unconfirmed_responded_requests()`** = alias ; **cron `service_role`** requis |
| **Abandon automatique** 24 h après **`responded`** | **Remplacé** par le même batch **`expire_overdue_requests()`** ( statut cible **`expired`** , pas **`abandoned`** ) |
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

### 13.5) Phrase d’ouverture de session (**recommandée** — environnement où **toutes les migrations sont déjà exécutées**)

Une ligne suffit pour reprendre : le **réel périmètre de travail** sera précisé **dans ton message suivant** (ou dans la suite du même).

**« On reprend ProxiPharma. Je te dis tout de suite quoi faire. »**

(Optionnel dans la même bulle si tu préfères cadrer le dépôt : *contexte projet dans `CONTEXTE.md` / `CAHIER_DES_CHARGES.md` au besoin, branche `fix/rls-recursion`* — mais **sans rouvrir les migrations** tant que l’infra est à jour.)

#### §13.5-suite — Référence contexte étendue (optionnel ou onboarding / nouveau déploiement)

Si tu dois **resemer le contexte** ou **rejouer l’historique BDD**, reprendre alors : **`CONTEXTE.md`**, **`CAHIER_DES_CHARGES.md`** (§0.1 complète, dernier §10, §11, §12, §4.4 pour le post-validation). Pour **nouvelles migrations uniquement** : respecter **`supabase/migrations/`**, ordre **`YYYYMMDD_*`**, ne pas réappliquer **`20260503_007`** hors **`009`**, **`20260505_007`** = codes PH/P/D. Réinitialiser données tests : **`scripts/clear-all-requests.mjs`** ou **`supabase/scripts/clear-all-requests.sql`**. Plan scénarios E2E demandes-produits : canvas **`canvases/product-requests-e2e-test-plan.canvas.tsx`**.

### 13.6) Phrase de reprise « UI ensuite page par page » (recommandée après le lot plateforme + `20260505_007`)

À copier-coller pour la prochaine session **produit / interface** :

**« Je reprends ProxiPharma côté UI : lis `CONTEXTE.md` puis `CAHIER_DES_CHARGES.md` §11 et §12. On développe **page par page** et **fonctionnalité par fonctionnalité** (polish écrans existants, puis brancher progressivement ordonnances & consultations libres et le reste des placeholders pharmacien/patient). Pas de nouvelle migration sauf blocage technique explicite. Mets le §10 Journal et l’état §11 à jour en fin de session. »**

### 13.7) Phrase de reprise courte (recommandée après la session 2026-05-07 — workflow demandes affiné + `post_confirm_fulfillment`)

**« On reprend ProxiPharma. Lis `CAHIER_DES_CHARGES.md` §0.1, dernier §10, §4.4 + §4.5, §11 (migrations dont `20260507_001` … `005`) et §12. Migrations Supabase à jour côté infra. Je te dis ensuite quoi faire (UI ou nouveau lot). »**

### 13.8) Phrase de reprise courte (recommandée après la session 2026-05-08 — pages envoyées patient/pharmacien)

**« On reprend ProxiPharma. Lis `CAHIER_DES_CHARGES.md` §0.1, dernier §10, §4.4 + §4.5, §11 et §12. Infra Supabase inchangée (pas de migration sur le lot 2026-05-08). Reprends le chantier UI demandes envoyées (patient + pharmacien), puis on décide si on ajoute l’heure dédiée pour les lignes “À commander”. »**

### 13.9) Phrase de reprise après **§4.6** roadmap (jalons répondue / validée / en traitement + dossiers figés)

**« On reprend ProxiPharma. Lis `CAHIER_DES_CHARGES.md` §0.1, **§4.6**, dernier §10, §11 et §12 — jalon en cours précisé dans le message suivant (répondue, validée, en traitement, ou fermeture page pharmacien demande envoyée). Pas de nouvelles actions UI sur dossiers figés §4.6 (cancelled/abandoned/expired/completed) sauf cohérence lecture seule. »**

### 13.10) Phrase de reprise (recommandée après **2026-05-09** — patient compact + pharmacien supply brouillon + `20260509_*`)

**« On reprend ProxiPharma. Lis **`CONTEXTE.md` §6**, **`CAHIER_DES_CHARGES.md` §0.1, §4.4, §4.6, **dernier §10 Journal**, §11 (migrations jusqu’à **`20260509_002`**), §12 ; branche **`fix/rls-recursion`**. Vérifie sur Supabase **`20260509_001`** et **`20260509_002`** si pas encore appliqués. Fichiers clés : **`app/dashboard/pharmacien/demandes/[id]/page.tsx`**, **`components/pharmacist/pharmacist-supply-compact-line.tsx`**, **`PatientProductRequestActions.tsx`**, **`lib/build-patient-line-timeline-fr.ts`**, **`lib/supply-line-post-confirm.ts`**. Je te dis ensuite quoi faire. »**

### 13.12) Phrase de reprise (recommandée après **2026-05-13** — supply alt. choisie, notifs comptoir, expiration `responded`)

**« On reprend ProxiPharma. Lis **`CONTEXTE.md` §6**, **`CAHIER_DES_CHARGES.md` §0.1, **§10 Journal (session 2026-05-13)**, §11 (migrations jusqu’à **`20260516_001`**), §4.4 + §4.6, §12. Sur Supabase : appliquer dans l’ordre **`20260512_002`**, **`20260514_001`**, **`20260515_001`**, **`20260516_001`** si pas déjà faits ; planifier le cron **`service_role`** sur **`expire_overdue_requests()`** (délai pilote **30 min** tant que la migration **`20260516_001`** est telle quelle). Fichiers clés post-validé : **`app/dashboard/pharmacien/demandes/[id]/page.tsx`**, **`lib/patient-request-history-audit.ts`**. En développement, si une évolution est plus simple avec une **base vidée**, le demander plutôt que d’accumuler des contournements. Je te dis ensuite quoi faire. »**

### 13.11) Phrase d’ouverture **sans consigne** (ne pas implémenter avant précision explicite)

À utiliser quand tu veux **recharger le contexte** dans une nouvelle conversation **sans** lancer de correctif, migration ou refacto : l’agent **lit** puis **attend** ta tâche.

**« ProxiPharma — reprise de contexte uniquement. Lis `CONTEXTE.md` §6 et `CAHIER_DES_CHARGES.md` §0.1, dernier §10 Journal, §11 (liste migrations) et §13.11. Ne modifie aucun fichier, n’applique aucune migration et ne propose aucun changement de code tant que je n’ai pas donné une consigne de travail explicite. Réponds par un bref récap de ce que tu as relu, puis attends ma précision. »**

### Template pour prochaines sessions
- Date:
- Objectif session:
- Decisions prises:
- Changements techniques realises:
- Questions ouvertes:
- Prochaines etapes:
