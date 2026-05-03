# Cahier des Charges - ProxiPharma (Document vivant)

Ce document sert de reference produit et technique entre nous.
Il doit etre mis a jour a chaque fin de session pour garder un historique clair des decisions.

## 0.1) Routine de collaboration (profil projet sans outillage lourd — a garder tel quel)

**But**: avancer plusieurs semaines sans perdre la vision, sans divergence BDD/code, avec peu d explications repetitives et sans dependre d une « connexion Supabase » Cursor (impossible sans secrets non versionnes).

Au **demarrage** d une session (copier-coller tolere ou paraphrase courte):
> Reprends ProxiPharma depuis `CAHIER_DES_CHARGES.md` (**§ Etat actuel** + dernier bloc du **Journal**) et continue la **feuille de route**. Ne dedouble pas les migrations hors fichiers dans `supabase/migrations/` sans me demander.

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
- **Expose patient vers pharmacien**: RLS **`profiles`** = patient ne voit que soi-admin ; l UI pharmacien n affiche pas le nom complet patient seulement un **court identifiant** (`patient_id` tronque) — jusqu a politique RGPD produit definie nouvelle migration policy possible lecture minimale nominative reservee pharma sur demandes rattachees.

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

### Session 2026-05-05 — Hubs UX « Mes demandes » (patient + pharmacien)

**Objectif**: refléter le flux métier lisible (« standard marché ») : tableau de bord par **familles de statuts**, **liste complète** avec filtres/tri, **cartes** cliquables, détail avec **lecture seule** quand aucune action n’est prévue.

**Patient** (`/dashboard/demandes`):
- **Onglets**: *Tableau de bord* | *Toutes les demandes* (paramètre URL `?vue=dashboard` par défaut, `?vue=liste`).
- Tableau de bord : sections définies dans **`patientDashboardSections`** (`lib/request-display.ts`) ; cartes lien vers **`/dashboard/demandes/[id]`**.
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

Regles fonctionnelles retenues (alignement dernier atelier):
- A la **`responded` -> `confirmed`**, le patient indique une **date de passage** (bornes métier CAS : 4 jours sans « à commander » sélectionné, sinon jusqu à **ETA max + 3 j** pour les lignes « à commander » de sa sélection) et une **heure optionnelle** ; données stockées sur **`requests`**, effacées si le patient **renvoie** la demande (`submitted`).
- A la **`responded` -> `confirmed`**, le patient peut choisir pour chaque ligne le **produit principal** ou **une alternative** proposee (`patient_chosen_alternative_id`), ou **rien** pour la ligne.
- **Référentiel catalogue** : affichage **PPH** (`products.price_pph`) partout où le catalogue est lu sur les parcours produits lorsque renseigné ; **prix de réponse** pharmacien distingué (« Prix pharmacie » / champ `request_items.unit_price`).
- Le client peut **modifier et renvoyer** une demande produit **meme apres une reponse** sans notion partiel/complet: RPC `patient_resubmit_product_request_after_response` (`responded`|`confirmed` -> `submitted`, reset prep pharma).
- Le **retrait reel** au comptoir est porte par le **pharmacien**: colonne par ligne `request_items.counter_outcome` (`unset`, `picked_up`, `cancelled_at_counter`, `deferred_next_visit`) + cloture dossier via `pharmacist_complete_request_after_counter` lorsque tout est bon (plus aucune ligne encore `unset` ou `deferred_next_visit` parmi les lignes **selectionnees** par le client).
- Les statuts enum `partially_collected` / `fully_collected` restent en base mais le flux officiel livre passe par **`completed`**; `patient_mark_collected` nest plus callable par le JWT patient (obsolete).

Implémentation frontend associée repo (voir journal §10 dont **Sessions 2026-05-03** et **2026-05-05**):
- **`/`** annuaire + lien carte vers fiche **`/pharmacie/[id]`**
- **`/pharmacie/[id]/demande-produits`**: création demande **`submitted`**
- **`/dashboard`** (résumé patient + lien hub), **`/dashboard/demandes`** (hub onglets + cartes + filtres), **`/dashboard/demandes/[id]`**
- **`/dashboard/pharmacien/demandes`** (hub onglets + cartes + filtres, tous statuts), **`/dashboard/pharmacien/demandes/[id]`**
- Auth **`/auth`** supporte redirection query **`?redirect=`** apres connexion
- Travail incremental versionne sous Git sur branche **`fix/rls-recursion`** (voir historique commits ; groupes récents : alternatives + passage + PPH **`ebf1d49`**, hubs UX demandes **`83cbf5f`**, ESLint/alternatives comptoir **Session 2026-05-04** §10).

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
3. **Lignes « proposées par le pharmacien » (Q20)** : distinguer les items (ex. colonne source / flag) pour libellés, et exiger motif côté saisie pharma.  
4. **Motifs d’annulation patient (Q16)** : liste contrôlée + texte si « autre » ; passer par RPC dédiée ou enrichir **`patient_abandon_request`** / annulation pré-`confirmed`.  
5. **Doublons & quantités** : contrainte ou garde‑fous **anti–double `product_id`** sur une même demande côté patient ; plafonnement **requested_qty ≤ 10** (**Q12**) en CHECK + validations front.  
6. **`client_comment` par ligne (Q11)** : saisie optionnelle à la création et à la résoumission pharma ; ligne directrice « une phrase minimale » = validation UX (longueur min. côté app si activée).  
7. **Vue pharmacien patient nominatif (Q39)** : ajuster **RLS / policy** sur `profiles` (lecture réservée au staff de la pharmacie concernée pour les patients liés à une demande), en restant RGPD‑aware.  
8. **Pilotage rupture marché & relances (Q21, §5 cahier, Q34–Q35)** : insertion **`market_shortages`** lors du choix pharma `market_shortage` ; périmètre pilote sans canaux email/SMS = **liste in‑app / file d’événements** à modéliser (table `notifications` ou réutilisation de `request_comments` système) pour les événements listés dans **Q34** — **après** le flux critique confirm → comptoir.  
9. **Admin pilote (Q40)** : accès lecture transverse demandes + filtres pharmacie/statut ; exports simples ou vues pour analytics (sans sur‑conception).

**Jalon 2 — UI dans l’ordre des dépendances**  
0. **Hubs liste/tableau de bord** patient + pharmacien (`/dashboard/demandes`, `/dashboard/pharmacien/demandes`) : ✓ (**Session 2026-05-05** §10).
1. Fiche **`/pharmacie/.../demande-produits`** : **PPH affichés** ✓ ; reste à faire : commentaire par ligne, qty max 10 (si non déjà généralisé côté insert).  
2. **`PatientProductRequestActions` + détail patient** : radios principal/alternative ✓ ; date passage ✓ ; reste récap dense **Q28**, totaux **Q23** si besoin au-delà de PPH + lignes réponse pharma.  
3. **Pharmacien** : motifs sur produits ajoutés, affichage/lisibilité ETA « à commander » (date obl., heure facult. **Q18**), mention **« Mis à jour le … par la pharmacie »** (**Q32**) via `updated_at` / champ dédié.  
4. **Post‑`confirmed`** : rappeler l’état « prêt / à commander avec date » (**Q31**), comptoir + saisie pharmacien récupéré vs annulé (**Q6 point 8** — affiner formulaire si champs métier manquants).  
5. **Tâches planifiées** : job **abandon 24 h** ; (optionnel) désactivation ou recalibrage **`expire_overdue_requests`** ; relances **Q34** une fois stockage notif disponible.  
6. **Espace Admin** minimal issu du jalon BDD §9.

**Écart principal avec le déjà livré** : flux **`responded` → `confirmed`** inclut désormais **alternative + passage + validation serveur associée**. Restent notamment **motifs d’annulation**, **anti-doublon / plafond qté**, **lignes proposées par la pharmacien**, **`market_shortages`** auto, **expiration vs abandon 24 h**, **notifications in‑app + canaux**, **admin pilote**, **identité nominative pharma (RLS)**.

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
| **Auto expiration** cron supabase **`expire_overdue_requests()`** | Pas branché infra — à coordonner avec règles pilote Q6 / Q38 |
| **Abandon automatique** 24 h après **`responded`** | Non implémenté — à faire si la règle Q6 est conservée malgré Q38 |
| **Ordonnance / consultation**: traitement pharmacien meme espace | Hors perimetre ecran actuel |
| **`market_shortages`** insert auto quand pharma choisit **market_shortage** dispo ligne | Hors scope UI actuelle — decider comportement métier puis migration trigger ou RPC |
| **Notifications Q34–Q35** | Après cœur métier : file in-app puis email/SMS/WhatsApp (**Q35** — post-pilote efficience) ; à planifier |
| **PPH catalogue** sur parcours produits (`price_pph`) | **Fait** (`lib/product-price.ts` + selects + seed `20260503_003`) |
| Consolidation UX post-retours utilisateur (libelles, ordre des etapes, messages d erreur) | Hub cartes / dashboard / filtres **livré** ; affiner microcopie, skeletons chargement, accessibilité onglets |

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

### 13.3) Prompt de reprise « continue le workflow demande produits » (mai 2026)

**À utiliser après le dernier commit** (alternative patient, passage officine RPC 4 params, PPH, seeds, hubs **`/dashboard/demandes`** + **`/dashboard/pharmacien/demandes`** : onglets tableau de bord / liste filtres ; §10 session **2026-05-05**).

**« Je reprends ProxiPharma. Lis `CAHIER_DES_CHARGES.md` §0.1, **dernier bloc §10 Journal**, §11 (**migrations liste** dont `20260503_001`, `003`, `004**) et §12 backlog. Confirme sur Supabase que les migrations **`20260503_*` non encore jouees sont appliquees** (SQL Editor ordre fichier). Parcours vite les **hubs demandes** (patient + pharma) pour valider affichage filtres / vue tableau de bord. Ensuite poursuis les **§12 jalons ouverts prioritaires** : au choix métier (**Q6/Q38**) arbitrage puis job abandon 24 h ou desactivation **`expires_at` +7 j**, puis motifs annulation (**Q16**), anti-doublon produit + plafond qté (**Q12–Q13**), **`market_shortages`** automatique (**rupture marché**), ou esquisse notifications in-app (**Q34**). Implémente avec migrations versionnées puis UI ; corrige ESLint **`react-hooks/set-state-in-effect`** si tu touches des effets. **Commit + push** en livraison groupée si OK, puis mets à jour le cahier (Journal + États + backlog). Références atelier : `docs/workflow-demande-produits-REPONSES.md` pour le métier hors ambiguïtés. »**

### Template pour prochaines sessions
- Date:
- Objectif session:
- Decisions prises:
- Changements techniques realises:
- Questions ouvertes:
- Prochaines etapes:
