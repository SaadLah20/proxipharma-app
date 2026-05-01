# Cahier des Charges - ProxiPharma (Document vivant)

Ce document sert de reference produit et technique entre nous.
Il doit etre mis a jour a chaque fin de session pour garder un historique clair des decisions.

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

Regles fonctionnelles retenues (alignement dernier atelier):
- Le client peut **modifier et renvoyer** une demande produit **meme apres une reponse** sans notion partiel/complet: RPC `patient_resubmit_product_request_after_response` (`responded`|`confirmed` -> `submitted`, reset prep pharma).
- Le **retrait reel** au comptoir est porte par le **pharmacien**: colonne par ligne `request_items.counter_outcome` (`unset`, `picked_up`, `cancelled_at_counter`, `deferred_next_visit`) + cloture dossier via `pharmacist_complete_request_after_counter` lorsque tout est bon (plus aucune ligne encore `unset` ou `deferred_next_visit` parmi les lignes **selectionnees** par le client).
- Les statuts enum `partially_collected` / `fully_collected` restent en base mais le flux officiel livre passe par **`completed`**; `patient_mark_collected` nest plus callable par le JWT patient (obsolete).

Etat fonctionnel teste / a valider sur Supabase:
- Les 3 types de demandes sont inserables (tel qu avant)
- Historisation des statuts fonctionne
- Alternatives: insertion reservee pharmacien/admin (corrige le cas ou un test patient ne voyait aucune ligne)
- Appliquer les nouvelles migrations puis verifier le seed demo (`patient_note` = `SEED_DEMO_WORKFLOW_v1`)

UI Sprint 2 (amorce livree dans le repo):
- Fiche pharmacie: `/pharmacie/[id]` (CTA services)
- Demande produits: `/pharmacie/[id]/demande-produits` (auth obligatoire, recherche `products`, insert `requests` + `product_requests` + `request_items`)
- Accueil: lien vers la fiche pharmacie; auth: parametre query `redirect` preserve apres connexion

Prochaines etapes suggerees:
1. Brancher pg_cron (ou Edge) sur `expire_overdue_requests()` (service_role uniquement)
2. UI espace pharmacien: ecran demande (`pharmacist_set_item_counter_outcome`, `pharmacist_complete_request_after_counter`) ; UI patient: revision / renvoi (`patient_resubmit_product_request_after_response`) + confirmation lignes (`patient_confirm_after_response`, `patient_abandon_request`)
3. Enrichissement fiche (infos, autres services ordonnance / consultation libre)

## 12) Prompt de reprise (copier/coller prochaine session)

Texte conseille pour reprendre exactement du meme point:

"On reprend ProxiPharma au point de reprise du `CAHIER_DES_CHARGES.md` (section Etat actuel). Continue avec la priorite: finaliser les alternatives pharmacien puis implementer le script reaction client (`responded -> confirmed -> partially_collected/fully_collected`, plus `abandoned`/`expired`). Ensuite on passe a l'UI Sprint 2 pour creer une demande produits depuis la fiche pharmacie."

### Template pour prochaines sessions
- Date:
- Objectif session:
- Decisions prises:
- Changements techniques realises:
- Questions ouvertes:
- Prochaines etapes:
