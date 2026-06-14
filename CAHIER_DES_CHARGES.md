# Cahier des Charges - Pharmeto (ex-ProxiPharma, document vivant)

Ce document sert de reference produit et technique entre nous.
Il doit etre mis a jour a chaque fin de session pour garder un historique clair des decisions.

## 0.1) Routine de collaboration (profil projet sans outillage lourd — a garder tel quel)

**But**: avancer plusieurs semaines sans perdre la vision, sans divergence BDD/code, avec peu d explications repetitives et sans dependre d une « connexion Supabase » Cursor (impossible sans secrets non versionnes).

Au **demarrage** d une session :
- **Reprise courte** lorsque Supabase est **deja aligne avec les migrations Git** (pilote : appliquer jusqu a **`20260822_001`** si pas fait — après abandon pharmacien **`20260821_001`**, recherche catalogue **`20260822_001`**) → phrase **§13.63** (photos catalogue) ou **§13.62** (général) ou **§13.61** (catalogue communautaire seul). La **tache precise** est donnee dans le message suivant.
- **Contexte projet, onboarding nouvelle machine, ou fichier SQL nouveau sous `supabase/migrations/`** → lire `CONTEXTE.md`, `CAHIER_DES_CHARGES.md` (**§0.1**, **§11**, dernier bloc **§10 Journal**, **§12** ; **phrase detaillee migrations** sous **§13.5-suite** si besoin). Ne dedouble pas les migrations hors fichiers dans `supabase/migrations/` sans me demander. Si tu touches Supabase : ordre des fichiers `YYYYMMDD_*`. **Ne pas confondre** : migration **`20260503_007`** = policy `profiles` (dangereuse seule, à annuler avec **`20260503_009`**) ; migration **`20260505_007`** = **codes publics** PH / P / D (refs mémorisables).

**Outils utiles (hors migration)** — **vider demandes + médias liés** (garde officines, catalogue, photos officines) :
1. SQL `supabase/scripts/clear-all-requests.sql` (SQL Editor, tout le fichier, « Run without RLS »).
2. `node --use-system-ca scripts/clear-request-private-media.mjs --confirm` (ordonnances, consultations, photos patient).
3. Optionnel : `node --use-system-ca scripts/reset-storage-keep-catalog-and-pharmacy-photos.mjs --confirm` (filet : public hors `products/` + `pharmacies/`, tout `private-media`).
Équivalent BDD seule : `scripts/clear-all-requests.mjs`. **Reset pilote complet** (sans officines/comptes) : `reset-pilot-keep-products-single-admin.sql`. **Doublons patient** : vider demandes puis supprimer comptes Auth. Plan E2E produits → `canvases/product-requests-e2e-test-plan.canvas.tsx` (§13.5).

**Catalogue BeautyMall (juin 2026)** — chaîne complète dans `scripts/README-beautymall-catalog.md` :
1. `node scripts/fetch-beautymall-sitemap-products.mjs` → `beautymall_sitemap_products.csv`.
2. `node scripts/merge-beautymall-products.mjs` (+ CSV WooCommerce `--main` si besoin) → `products_final.csv` + `products_unmatched.csv` (fuzzy ≥ 85 %).
3. SQL `supabase/scripts/wipe-catalog-beautymall-import.sql` (vider catalogue + lignes promo liées) puis `node scripts/import-beautymall-catalog.mjs` (`--dry-run` possible). **Pilote** : **13 651** parapharmacie BeautyMall, **12 171** avec photo URL, **1 480** sans photo. Pas de migration Git — colonne **`full_description`** déjà en schéma. Détail §10 session **2026-06-04 (suite 2)** · phrase **§13.39**.

**Indépendance photos BeautyMall (juin 2026)** — guide reprise **`docs/CATALOGUE-PHOTOS-INDEPENDANCE-BEAUTYMALL.md`** :
1. **Phase 1** — sauvegarde locale (sans Supabase Storage) : `node --use-system-ca scripts/download-beautymall-catalog-images.mjs` → `catalog/images/{slug}.*` + journal.
2. **Phase test** — rien en base (URLs BeautyMall inchangées).
3. **Phase prod** — upload Storage : `node --use-system-ca scripts/attach-catalog-images.mjs --category beautymall_catalog`. Détail §10 session **2026-06-14 (suite 2)** · phrase **§13.63**.

**Médicaments officine (juin 2026)** — Excel « Base de données médicaments » (colonne **TVA = 0**) · **`scripts/README-medicaments-officine.md`** :
1. `python scripts/convert-medicaments-xlsx.py "<chemin>.xlsx"` → `medicaments_officine.csv`.
2. `node --use-system-ca scripts/import-medicaments-officine.mjs` (additif, **ne vide pas** la parapharmacie). **Pilote** : **6 026** médicaments (`product_type = medicament`, `category = medicaments_officine`, PPH/PPV, sans photo). **Catalogue total** : **~19 677** lignes (13 651 para + 6 026 méd.). Pas de migration Git. Journal §10 session **2026-06-06 (suite 4)**.

**Marques catalogue (juin 2026)** — **`20260710_001`** + **`20260713_001`** (pricing marque) · extraction **`scripts/README-product-brands.md`** (**v2.1 ~93,65 %** appliquée Supabase) · UI **`ProductBrandLabel`**. Journal §10 sessions **2026-06-06 (suite)** et **(suite 4)**.

A la **sortie**: demander ou accepter la mise a jour de ce cahier (Journal + Etat actuel + prompt de reprise du §12).

**Répartition livraison (utilisateur non dev)** — détail agent : `.cursor/rules/delivery-workflow-user.mdc` ; `RUNBOOK.md` §3.

| Qui | Actions |
|-----|---------|
| **Utilisateur** | Migrations Supabase si nouvelles ; après livraison agent → attendre **preview Vercel**, tester ; GitHub **PR → Merge** ; coller les erreurs si besoin. |
| **Agent** | Branche feature, **PR ouverte vers `main`** (créer/rouvrir si la précédente est mergée), `commit` + `push`, indiquer lien PR + preview + migrations. |

**Ton role coté infra (minimal)**:
1. Appliquer tout nouveau fichier sous `supabase/migrations/` sur Supabase (ordre chronologique des noms).
2. Attendre la preview Vercel puis merger la PR quand c est bon (pas de git cote utilisateur).
3. En cas d'erreur : copier-coller integralement le message (navigateur ou console).

**Ou est la verite du backend (schema)** : les migrations Git + les RPC/policies decrites dedans ; le SQL Editor hors migrations est reserve aux tests ponctuels mais ne remplace pas le fichier migre versionne dans le depot.

## 14) Internationalisation ar / fr — décisions validées (2026-06-03, implémenté juin 2026)

**Statut** : **implémenté juin 2026** (`next-intl`, cookie `pp_locale`, switcher header, RTL). Décisions produit ci-dessous figées.

| # | Décision | Détail |
|---|----------|--------|
| 1 | **Périmètre** | **Patient uniquement** (annuaire public, auth patient, parcours demandes, hubs, paramètres patient). Espace **pharmacien**, **admin** et outils internes restent en **français**. |
| 2 | **Arabe** | **Arabe standard** (فصحى) pour tous les libellés UI traduits — pas de darija dans les fichiers de messages. |
| 3 | **Langue par défaut** | Selon la **langue du téléphone / navigateur** (`Accept-Language`, `navigator.languages`) : **ar** si préférence arabe détectée, sinon **fr**. Bascule manuelle **AR \| FR** à prévoir (header ou paramètres patient). Persistance optionnelle plus tard : `profiles.preferred_locale`. |
| 4 | **URLs (démarrage)** | **Le plus simple** : **mêmes URLs** + locale en **cookie** ou `localStorage` (pas de préfixe `/ar/` au pilote). Réévaluer `/ar/...` seulement si besoin SEO/partage WhatsApp. |
| 5 | **SMS / notifs externes** | **SMS** : restent **français** (ASCII, 1 segment). **In-app** : colonnes **`title_ar`** / **`body_ar`** sur **`app_notifications`** (**`20260709_001`**) ; affichage selon locale patient. |
| 6 | **RTL** | Locale `ar` → `dir="rtl"`, police arabe lisible, revue layout (footers sticky, grilles). **Implémenté** (`app/layout.tsx`, `globals.css`). |
| 7 | **Implémentation** | **`next-intl`** + **`messages/fr/*.ts`** / **`messages/ar/*.ts`** (namespaces : `common`, `auth`, `demandes`, `hub`, `workflow`, `annuaire`, `pharmacyPublic`, `header`, …) ; **`middleware.ts`**, **`i18n/request.ts`**, **`lib/i18n/`** ; **`locale-role-guard`** (pharmacien/admin toujours FR). **Couverture patient complète juin 2026 (vagues 1–6)** : conversation + modales sortie ; pages publiques demande produits / ordonnance / consultation ; hubs + cartes dossier ; détail dossier (actions, archives, timeline, panels ordonnance/consultation) ; paramètres (prefs notif, méthodes connexion, liste souhaits) ; dates **`lib/datetime-locale.ts`** + **`usePatientDatetimeFormatters`** ; RTL mobile ; CI **`npm run i18n:parity`** (**`scripts/i18n-key-parity.mjs`**). **Hors scope** : espace pharmacien/admin, SMS externes, descriptions catalogue BeautyMall. |

**Références** : `CONTEXTE.md` §4 (vision bilinguisme) ; `AGENTS.md` paragraphe **i18n patient** ; journal §10 session **2026-06-06 (suite 5)** ; phrase reprise **§13.46**.

---

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

### 3.3 Promos et offres (packs promo — workflow dédié)

- Workflow **séparé** des demandes produits / ordonnances / consultations (`requests`) — migration **`20260610_001`**
- **Pharmacien** : **`/dashboard/pharmacien/offres-promos`** (CRUD pack : max **5 produits** + **5 cadeaux**, remise %, validité, brouillon / publier) ; **`/dashboard/pharmacien/reservations-packs`** (hub **5 tuiles statut** + onglet liste filtrable, détail : confirmer, non disponible + motif, récupérée, annuler)
- **Public** : onglet **Offres** sur **`/pharmacie/[id]`** (`PublicPromoOffers`) — cartes + **Réserver** (connexion patient, date passage **J→J+3**, heure facultative)
- **Patient** : **`/dashboard/patient/packs-promo`** (+ détail `[id]`) — hub **tableau de bord = tuiles seules** (`PromoStatDashboard`, aligné **`RequestKindHubDashboard`**) + onglet **liste** filtrable ; annulation si `submitted` / `confirmed`
- Réf. réservation **`P042/26`** (compteur par officine + année) ; notifs in-app **`promo_in_app_notifications`** (fusionnées dans la cloche header avec **`app_notifications`**)
- Code : **`lib/promo/`** (`reservation-hub-buckets.ts`, `reservation-hub-sections.ts`, …), **`components/promo/`** (`PromoReservationsHubDashboard` → tuiles seules, `promo-reservation-hub-card.tsx`, …) — voir journal §10 **session 2026-05-19 (promo)**, **2026-06-06 (suite 9)** et **2026-06-09 (suite 2)**

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

- **Référence figée** : ce que le patient a validé reste lisible en base via **`selected_qty`**, **`patient_chosen_alternative_id`** (principal vs alternative). **UI (écran actions patient `PatientProductRequestActions`, statuts `confirmed` / `processing` / `treated`)** : **cartes compactes** (photo, historique, note, titre, qté, PU/Tot) ; **`confirmed`** : blocs **À réserver** (contour sky) / **À commander** (teal) + point d’attention + écarts + **`<details>`** non retenues ; bandeau amendements dans **`PatientProductRequestDossierHeader`** (**Modifiée** + **Résumé**) si amendements officine ; **`treated`** : blocs **« Produits réservés pour vous et en attente de votre passage »** / **« Produits commandés pour vous »** ; phrase passage **`patientPlannedVisitPassageLineFr`** sous l’en-tête dossier ; pastilles ligne sans « réservé / commandé » sur **traitée** ; **Réception prévue** (teal/cyan) et **Reçu en officine** (émeraude) — pas de « Réception prévue » si **`arrived_reserved`** ; **bandeau libellés** (**`lib/patient-validated-line-labels-fr.ts`**) ; **Historique** + **notes ligne** → **`lib/build-patient-line-timeline-fr.ts`**. Dossiers **terminés** : **`PatientRequestOutcomeBanner`** + vue lecture seule. Le **détail lecture seule** hors ce bloc peut encore reprendre la liste complète dans **`page.tsx`**.
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
- **Disponibilités sur lignes proposées par la pharmacie** (`line_source = 'pharmacist_proposed'`) : **uniquement** `Disponible` ou `À commander` — **consultation libre** et **ajout officine** (`product_request`). **Ordonnance** (saisie depuis le scan, `patient_request` ou motif « Saisie depuis ordonnance ») : **toutes** les dispos (`PHARMACIST_AVAILABILITY_OPTIONS` via **`pharmacistAvailabilityOptionsForLine`**). Compléments ordonnance hors scan = proposés → dispos restreintes.
- **Patient en `responded`** : qté affichée **« Proposé »** = `available_qty` (principal ou alternative) ; sélection initiale au plafond ; le patient peut **réduire** sa qté, pas l’augmenter au-delà de l’offre pharmacie (`maxQtyPrincipal` / **`maxQtyAlt`** dans **`patient-product-request-actions.tsx`**).
- **Annulation totale par la pharmacie** : RPC **`pharmacist_cancel_request(p_request_id, p_reason_text)`** (motif obligatoire ≥ 5 car.) depuis `submitted` / `in_review` / `responded` / `confirmed` / **`processing`** / **`treated`** → `cancelled`. Le patient voit l'événement dans son historique avec auteur « La pharmacie ».
- **Heure de passage patient** : saisie **texte 24 h** (HH:MM, normalisée par `parseFreeTime24h` qui accepte `18`, `18h30`, `1830`, `18:30`). Plus de `<input type="time">`.
- **Le badge « Retenu après réponse patient »** sur la fiche pharmacien n'apparaît qu'à partir du statut `responded` (caché en `submitted` / `in_review`).

### 4.6 Roadmap écrans « demandes produits » MVP — par statut, patient + pharmacien

**Décision méthodo** : on **traite les familles de statuts séparément** (avec changements fonctionnels/UI possibles étape par étape), toujours en **gardant les deux rôles alignés** sur le même jalon quand l’écran existe des deux côtés.

**Ordre de travail validé** :

| Étape | Périmètre métier (libellé grand public) | Côté patient | Côté pharmacien |
|-------|----------------------------------------|--------------|-----------------|
| 1 | **Demande envoyée** (`submitted` / `in_review`) | Page détail + hub — **affinée** (header dossier sky, lignes compactes, mobile) | Page détail + hub — **à clôturer** pour ce jalon |
| 2 | **Demande répondue** (`responded`) | **Affinée** (header sky, blocs compacts, alternatives groupées, qty conservée au recochage, indispo sans case, modale confirmation) — QA terrain | À affiner |
| 3 | **Validée** (`confirmed` sans entrée en **`processing`** ni virtuel **`in_progress_virtual`** uniquement via lignes) | **Affinée** (cartes **`PatientValidatedCompactLineCard`**, blocs sky/teal, header **Modifiée** + **Résumé** si amendements, **Modifier ma validation** + footer ambre en édition, RPC **`patient_update_confirmation`** + migration **`20260625_001`** si optimistic lock) | Affinée (synthèse alignée patient, réservé/commandé) |
| 4 | **En préparation officine** (`processing` en DB, ou `confirmed` + `in_progress_virtual` si réservé/commandé sans migration statut) | Affinée (même logique compacte que validée ; pas de liste amendements « pleine page ») | Affinée (enregistrement traçabilité, déclaration traitée si règles OK) |
| 5 | **Traitée** (`treated`) — suivi retrait comptoir jusqu'à **`completed`** | **Affinée** (deux blocs réservés/commandés, passage visible sous en-tête, pastilles réception/reçu, amendements comme validée, total + date passage en pied) | Affinée |

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
- **Notes par ligne vs conversation dossier** (produits, ordonnance, consultation) : **`client_comment`** / **`pharmacist_comment`** (et note ordonnance / texte consultation) **figées après `confirmed`** (et statuts terminaux). Patient : saisie à l’envoi ou modification **avant réponse** (`submitted`|`in_review`, RPC resubmit). Pharmacien : saisie à la **publication** ou **modification de réponse** (`responded` + mode Modifier). **`request_comments`** (conversation) reste ouverte. Migration **`20260607_001`** + **`lib/request-line-notes-policy.ts`**.

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

### 10.1) Versions stables de référence (pour retour arrière Git)

| Label | Commit | Branche | Date | Contenu synthétique |
|-------|--------|---------|------|---------------------|
| **`pilote-stable-2026-05-24`** | **`0c4f0e7`** | `fix/validated-supply-ecart-ui-modal` | 2026-05-24 | Onboarding admin + ma-fiche (coordonnées, titulaire public), MDP oublié SMS, migrations **`20260619_001`**–**`20260622_001`**, reset pilote SQL + script Storage (hors `products/`), horaires fiche publique (7 jours glissants, noms complets). Lot pricing / promo / supply post-validé déjà sur la branche. |

**Revenir à cette version (code)** :

```bash
git fetch origin
git checkout 0c4f0e7
# ou, si le tag a été poussé :
git checkout pilote-stable-2026-05-24
```

**Branche de travail après retour** : `git switch -c reprise-depuis-stable-2026-05-24`

**Supabase** : aligner le schéma sur les migrations jusqu’à **`20260622_001`** (pas automatique avec le seul `git checkout`).

---

### Session 2026-06-14 (suite 2) — Recherche catalogue + sauvegarde photos BeautyMall

**Branche** : `feature/product-search-relevance-rank` — commits **`b3650df`**, **`ab8aca0`**, lot photos local (cette session).

**Migration** (ordre, si pas déjà fait) :
- **`20260822_001_product_search_relevance_rank.sql`** — score **`_product_search_match_rank`** (préfixe nom avant sous-chaîne) ; RPC **`products_catalog_search`** paginée ; explorateur patient + recherche promo + pricing pharmacien.

**Recherche catalogue** :
- Ex. « doliprane » : **Doliprane** avant **Codoliprane** (tri alphabétique seul remplacé par score pertinence).
- **`lib/products-catalog-search.ts`**, **`lib/use-product-catalog-explorer.ts`**, **`lib/use-promo-product-search.ts`**.

**Patient (bandeau officine répondue)** — commit **`ab8aca0`** :
- **`PatientPharmacyDossierBand`** sur dossier **répondu** ; date de passage reprise depuis la sélection.

**Indépendance photos BeautyMall (sauvegarde locale, pas Storage)** :
- **`scripts/download-beautymall-catalog-images.mjs`** — télécharge ~**12 171** URLs → **`catalog/images/{slug}.*`** ; reprise auto ; `--dry-run` / `--limit`.
- **`scripts/attach-catalog-images.mjs`** — option **`--category beautymall_catalog`** pour phase prod Storage.
- Guide reprise étapes + phrases agent : **`docs/CATALOGUE-PHOTOS-INDEPENDANCE-BEAUTYMALL.md`**.
- **État** : script validé (3 images test) ; **téléchargement complet non lancé** ; **`photo_url` en base inchangées** (URLs BeautyMall).

**i18n** : libellé hint WhatsApp prefs — « échec d'envoi » (`messages/fr/demandes.ts`).

**Phrase de reprise** : **§13.63**.

---

### Session 2026-06-14 — Pricing patient, abandon pharmacien, admin pilote, WhatsApp M2 lot 1

**Branches / PR** :
- **`feature/pricing-visibility-pu-adjust`** — PR **#352** mergée **`main`** — commits **`6065889`**, **`c8e2fb8`**, **`e8bff83`**.
- **`feature/admin-dashboard-refonte`** — commits **`70784b8`**, **`4862464`** (fix lint `AdminPilotBlock`).
- **`feature/whatsapp-c-suite-m2-lot1`** — commit **`a0c69ae`**.

**Migrations** (ordre, si pas déjà fait) :
- **`20260820_001_pharmacy_pricing_catalog_visibility.sql`** — **`show_catalog_prices_before_response`** + RPC **`pharmacist_pricing_product_override_upsert`**.
- **`20260821_001_pharmacist_abandon_request.sql`** — RPC **`pharmacist_abandon_request(p_request_id, p_reason_text)`** : **`confirmed`/`treated` → `abandoned`**, écarte les lignes retenues actives, motif obligatoire ; refuse si retrait comptoir **`picked_up`**.

**Pricing patient (PR #352)** :
- Modal **Valider ma demande** : même résolution PU que le dossier répondu — **`lib/patient-responded-line-pricing.ts`**, **`resolvedRespondedUnitPrice`** dans **`buildPatientConfirmSelection`**.
- **Médicaments** : affichage **PPV** toujours (**`resolveLineUnitPrice`**, brouillon pharmacien **`catalogEmbedUnitPriceFallback`**) — catalogue national ou PPV privé officine.
- Visibilité PU catalogue avant réponse officine : **`show_catalog_prices_before_response`** (onglet **Général** pricing pharmacien).

**Abandon pharmacien direct** :
- Bouton **Abandonner le dossier** sur dossier **validé** / **traité** (sans retrait comptoir) — modale motif **`RequestExitConfirmModalFr`** mode **`pharmacist_abandon`**.
- Ancien parcours conservé : écarter toutes les lignes + **Enregistrer** → **`pharmacist_abandon_request_no_pickup`**.
- **Annuler la demande** retiré sur **traité** (RPC **`pharmacist_cancel_request`** ne couvrait pas ce statut).

**Admin pilote (refonte espace)** :
- Layout **`app/admin/layout.tsx`** + nav sections **`lib/admin-nav.ts`**.
- **`/admin`** dashboard fondateur (**`admin-dashboard.tsx`**) ; **`/admin/demandes`** liste + tuiles statuts ; **`/admin/officines`** ; détail demande allégé.
- **`AdminPilotBlock`** : filtres bucket + compteurs e-mail ; sync URL via **`key`** (plus de `setState` dans effet — CI lint).

**WhatsApp M2 lot 1 patient (code livré, vars Vercel à basculer)** :
- **`lib/twilio-whatsapp.ts`** : **`request_status:expired`**, **`request_event:responded_expiry_reminder`** + lien **`/r/`** ; traité passe en **v2 link** si **`TWILIO_WHATSAPP_CONTENT_SID_TREATED=HX7bb5…`**.
- Variables : **`TWILIO_WHATSAPP_CONTENT_SID_EXPIRED`**, **`TWILIO_WHATSAPP_CONTENT_SID_REMINDER`** — voir **`docs/WHATSAPP-NOTIFS-REPRISE.md`**, **`RUNBOOK.md` §10**.

**Phrase de reprise** : **§13.62**.

---

### Session 2026-06-11 — Passage vs horaires officine + CRM sans KPI

**Branche** : `fix/validated-supply-ecart-ui-modal` — commits **`77bccb7`** · **`5c651ad`** · **`57dc498`**.

**Migrations** (ordre) :
- **`20260811_001_disable_external_sms_notifications.sql`** — SMS alertes métier off ; enqueue e-mail + WhatsApp patient P0.
- **`20260812_001_planned_visit_pharmacy_hours_validation.sql`** — **`_assert_pharmacy_open_for_visit`** : ≥ **30 min** si passage aujourd’hui avec heure (Casablanca), jour fermé / férié, hors créneaux ; hooks **`patient_confirm_after_response`** et **`patient_update_planned_visit_after_confirmation`**.

**Passage patient (UI + lib)** :
- **`lib/planned-visit-pharmacy-validation.ts`**, **`lib/pharmacy-schedule-fr.ts`** (`openSlotsForDay`, `isPharmacyOpenAt`, …), **`lib/annuaire/schedule-bundle.ts`**.
- **`PatientProductRequestActions`** : chargement horaires officine, messages live, blocage validation / mise à jour passage.

**Mes pharmacies / Clients (UI)** :
- Retrait grille **3 KPI** (Total / actifs / promo) — **`patient-pharmacies-directory.tsx`**, **`pharmacist-clients-directory.tsx`**.
- Conservé : en-tête page, barre recherche + tri + filtre, cartes.

**Phrase de reprise** : **§13.60**.

---

### Session 2026-06-10 (suite 3) — Annuaire : déconnexion mobile + filtre filet

**Branche** : `fix/validated-supply-ecart-ui-modal` — commits **`5e70cb7`** · **`1b4eb47`** · **`bdbfcc2`** (fix typage CI).

**Pas de nouvelle migration.**

**Contexte** : après merge pilote (**suite 2**), compte **`pilot_access`** encore actif sur mobile (session Supabase) → annuaire affichait **3** officines même après F5 ; RLS seul suffit si vraiment déconnecté.

**Correctifs annuaire** (`components/annuaire/annuaire-page.tsx`, **`lib/annuaire/pilot-directory-access.ts`**) :
- Rechargement liste sur **`onAuthStateChange`** (connexion / déconnexion).
- Filtre explicite **`public_listed = true`** + filet client pour non-pilotes.
- **`getUser()`** (pas **`getSession()`**) pour détecter le mode pilote.

**Déconnexion** (`platform-header.tsx`) : **`signOut({ scope: 'local' })`** + **`window.location.assign('/')`** (rechargement complet mobile Chrome).

**Phrase de reprise** : **§13.59**.

---

### Session 2026-06-10 (suite 2) — Visibilité annuaire pilote (Al Jazira seule en public)

**Branche** : `fix/validated-supply-ecart-ui-modal` — commits **`b76bdec`** (pilote `public_listed` / `pilot_access`) · **`d06520e`** (fix seed SQL Editor + **`20260718_002`**).

**Migrations** (ordre obligatoire) :
- **`20260718_001_pilot_pharmacy_public_listed.sql`** — colonnes **`pharmacies.public_listed`** (défaut `false`) et **`profiles.pilot_access`** (défaut `false`) ; fonctions **`is_pilot_access_user()`**, **`can_patient_use_pharmacy()`** ; RLS annuaire / création demandes / promos publiées ; gardes RPC **`patient_submit_prescription_request`**, **`patient_submit_free_consultation_request`**, **`patient_submit_promo_reservation`** ; triggers anti-élévation ; seed pilote (Al Jazira + comptes test).
- **`20260718_002_pilot_visibility_seed_fix.sql`** — **obligatoire après 001** : triggers autorisent **`postgres`** / **`supabase_admin`** (SQL Editor) ; **réapplique** le seed si **`pilot_access`** est resté à `false` partout.

**Règles produit (prod juin 2026)** :
- **Public + nouveaux patients** : annuaire et fiches = pharmacies **`public_listed = true`** uniquement → **AL JAZIRA** (`d536a446-…`).
- **Officines test** (Saad, Yassine BJ) : **`public_listed = false`** — masquées sauf comptes **`pilot_access = true`** (admin MIASMO + 4 patients test).
- **Noureddine SALAMI** (titulaire Al Jazira) : **`pilot_access = false`** — dashboard officine inchangé.
- **Nouvelle officine admin** : case **« Visible dans l'annuaire public »** (décochée par défaut) — **`AdminOnboardPharmacyForm`**, création pharmacie seule **`app/admin/page.tsx`**.

**Code** : **`lib/use-pharmacy-public-gate.ts`** ; **`lib/annuaire/pilot-directory-access.ts`** (suite 3) ; pages **`/pharmacie/[id]/demande-*`** (message indisponible si RLS bloque).

**Fin de pilote** : supprimer comptes/officines fake ; une seule officine réelle **`public_listed`** — pas de retrait de colonnes requis.

**Phrase de reprise** : **§13.59**.

---

### Session 2026-06-09 — Retours UI patient/pharmacien (drift, archives, ordonnances, promos, amendements)

**Branche** : `fix/validated-supply-ecart-ui-modal` — commit **`1330407`**.

**Pas de nouvelle migration.**

**Drift dossier** :
- **`RequestDetailStaleBanner`** + i18n **`demandes.drift.*`** (FR/AR) ; bouton **Actualiser le dossier** (plus « Actualiser la page »).
- Polling **5 s** sur statuts **`confirmed`** / **`treated`** ; auto-refresh patient **`confirmed → treated`** *(remplacé par bandeau visible — voir suite 2)*.
- Blocage **`detailStale`** corrigé consultation tabbed (onglet Produits).

**Archives clôturées patient** :
- Clés **`demandes.archive.footer.*`** (totaux « produit(s) récupéré(s) / retenu(s) ») — plus de clé brute **`common.productsPickedUp`**.

**Ordonnances patient** :
- Espacements alignés pharmacien via **`lib/patient-prescription-dossier-shell.ts`**.

**Pharmacien répondue** :
- Couleurs champs dispo adoucies (**`lib/pharmacist-availability-ui.ts`**, palette cyan/amber conservée).

**Validée modifiée (amendements officine)** :
- Badge **Modifiée** + texte + bouton **Résumé** intégrés dans **`PatientProductRequestDossierHeader`** (**`PatientAmendmentResumeModal`**) ; plus de bandeau violet standalone.

**Phrase de reprise** : **§13.54** (affinages preview — voir suite 2 ci-dessous).

---

### Session 2026-06-09 (suite 3) — Typo FR, i18n dossiers, nom/adresse arabe officine, doc ville reportée

**Branche** : `fix/validated-supply-ecart-ui-modal` — commits **`6ddcbb6`** · **`d7f719c`** · **`e6eb40e`** · **`f79ad89`** · **`2eed65a`** · **`d092794`** · **`8e8b47a`** · **`04929df`** (doc).

**Migration** : **`20260716_001_pharmacy_nom_adresse_ar.sql`** — colonnes **`pharmacies.nom_ar`**, **`adresse_ar`** ; RPC **`patient_pharmacy_detail`** enrichie. **À appliquer** Supabase SQL Editor si pas fait.

**Typographie & header** :
- Locale **FR** : **Plus Jakarta Sans** (`--font-plus-jakarta-sans` sur `<body>`).
- Header : espacement logo / wordmark **`gap-1.5`**.

**i18n patient (lot 1 dossiers)** :
- **`patient-product-request-actions.tsx`**, **`patient-pharmacy-quick-contact.tsx`**, **`patient-responded-line-chooser.tsx`**, **`patient-product-request-compact-line.tsx`**, fallbacks hub ; clés FR/AR **`demandes`** + **`common`**.

**Nom / adresse arabe officine** :
- **Admin** : **`AdminOnboardPharmacyForm`** — champs arabe facultatifs RTL ; **`lib/admin-onboard-pharmacy.ts`**.
- **Pharmacien** : **Ma fiche → Coordonnées** — section « Version arabe (facultatif) » ; **`pharmacy-ma-fiche-page.tsx`**.
- **Helpers** : **`lib/pharmacy-localized-field.ts`**, **`pharmacyPublicLabel(..., { locale, nomAr })`**.
- **Affichage patient locale ar** : fiche publique, annuaire, Mes pharmacies ; **bandeau dossier** (`PatientPharmacyDossierBand`), hubs demandes/promo, contact rapide — repli FR si champs vides.

**Lot ville (liste + libellé AR)** :
- Spec **`§13.55`** ; doc **`04929df`** — **livré** session **2026-06-10** (**`cff4fa4`**).

**Fix build** : tri filtre pharmacie hub — **`collatorForLocale(locale).compare(a, b)`** (pas `localeCompare` + Collator).

**Phrase de reprise** : **§13.57** (voir **§13.56**).

---

### Session 2026-06-09 (suite 4) — Date passage : scroll + hint inline (validation patient)

**Branche** : `fix/validated-supply-ecart-ui-modal` — commit **`58909d6`**.

**Pas de nouvelle migration.**

**Patient — validation `responded`** (`components/requests/product/patient-product-request-actions.tsx`) :
- Si date de passage **vide** ou **hors plage** au clic **Valider ma demande** : **scroll** automatique vers le bloc date (**`scrollIntoView`**, `block: center`) + message **inline** sous le champ (**`visitPassageError`**, `role="alert"`) — plus de bandeau rouge seul en haut du dossier (le patient ne voyait pas l’erreur depuis le pied de page).
- **`validatePatientConfirmBeforeReview`** : retour structuré `{ ok, message, focus }` — `focus: visit_passage` (date) vs `top` (lignes, qté, ETA) ; les erreurs non-passage conservent le bandeau haut **`actionError`**.
- **Mettre à jour ma date de passage** (`runUpdateVisit`, `confirmed` / `treated`) : même scroll + hint si date hors plage.
- i18n **`common.visitDateRequiredToValidate`** (FR/AR) ; **`PlannedVisitDateInput`** prop **`invalid`** (bordure + `aria-invalid`).

**Phrase de reprise** : **§13.57** (voir **§13.58**).

---

### Session 2026-06-10 — Ville AR, affinage i18n étape 1, fix bandeau nom_ar

**Branche** : `fix/validated-supply-ecart-ui-modal` — commits **`cff4fa4`** (ville) · **`2d94ffc`** (bandeau `nom_ar` select) · **`059d712`** (i18n étape 1 + doc **§13.58**).

**Migrations** (ordre) :
- **`20260716_001`** — `pharmacies.nom_ar`, `adresse_ar` (si pas fait).
- **`20260717_001`** — RPC **`patient_pharmacy_directory_enriched`** + colonne **`nom_ar`** (Mes pharmacies).

**Ville officine (§13.55 — livré)** :
- Catalogue **`lib/pharmacy-cities-morocco.ts`** (~35 villes `{ fr, ar }`) ; **`pharmacyCityLabel`**, **`pharmacyCitySearchTerms`**, **`PharmacyCitySelect`**.
- Admin + **Ma fiche** : liste déroulante ; affichage patient AR (annuaire, bandeau, hubs, fiche publique).

**Fix bandeau dossier** :
- Détail demande : select Supabase inclut **`nom_ar`** / **`adresse_ar`** (oubli post-**`d092794`**).

**i18n AR affinage — étape 1 (§13.58 — livré)** :
- **`i18n:parity --strict-strings`** : **0** chaîne FR patient (auth code sync, consultation panel, historique vide).
- **Itinéraire** + modale navigation → **`pharmacyPublic.*`**.
- **Mes pharmacies** : dates locale, types dossiers **`workflow.*`**, note avis ; **`lib/i18n/patient-pharmacy-kind-labels.ts`**.

**i18n AR affinage — étape 2 (§13.58 — livré)** :
- **`demandes.archive.terminal.*`** (FR/AR) : bandeaux annulée / abandonnée / expirée / clôture comptoir.
- Hook **`usePatientArchiveOutcomeCopy`** — remplace appels **`*Fr`** dans **`patient-product-request-actions`**, **`PatientRequestOutcomeBanner`**, détail dossier (**ordonnance / consultation / produits**).
- **`i18n:parity`** **1263** clés · **`build`** OK.

**i18n AR affinage — étape 3 (§13.58 — livré)** :
- **`demandes.amendmentResume.*`** + **`demandes.supplyAmendment.*`** ; hook **`usePatientPharmaAmendmentCopy`** (modale Résumé, badge **Modifiée**).
- Pastilles validé : **`useValidatedOriginLabel`**, chip par **`key`**, **`postConfirmAdded`** ; **`usePatientValidatedLineLabels`** déjà branché.
- **`i18n:parity`** **1296** clés · **`build`** OK.

**i18n AR affinage — étape 4 (§13.58 — livré)** :
- Port **`TimelineCopyPort`** + hook **`usePatientTimelineCopy`** (`timeline.events`, `demandes.supplyAmendment`, `demandes.statusBadges`).
- Corps des événements i18n : **`build-dossier-timeline-fr`**, **`collect-line-events`** (historique ligne), clés **`timeline.events.lineBody.*`** / **`dossierMeta.*`** (FR/AR).
- Branché patient : **`DossierHistoryListFr`**, **`usePatientDossierTimeline`** / **`usePatientLineTimeline`**, modale horloge ligne (**`patient-product-request-actions`**).
- **`i18n:parity`** **1296** clés · **`build`** OK.

**i18n AR affinage — étape 5 (§13.58 — livré)** :
- Relecture **فصحى** parcours critiques : auth OTP (fuites EN), annuaire, Mes pharmacies, dossier répondu→validé→traité (timelines, archives, amendements).
- Harmonisation terminologie (**تأكيد**, **صيدليتك**, épilogue expiré/clôturé distinct).
- RTL mobile dense : auth retour, recherche hubs demandes / pharmacies, onglets choix répondu (`ps`/`pe`/`start`).
- **`i18n:parity`** **1296** clés · **`build`** OK.

**Annuaire / fiche — overlay photo RTL (post-§13.58)** :
- **`PharmacyCoverOverlayActions`** : boutons contact (`end-*`) — **droite** FR, **gauche** AR.
- **`PharmacyRatingOverlayChip`** : i18n **`pharmacyPublic.ratingOverlay*`** (plus de FR hardcodé) ; pastille avis **`start-*`** (coin opposé aux boutons).
- **`globals.css`** : variantes Tailwind **`rtl` / `ltr`** (`@custom-variant`).
- **`i18n:parity`** **1299** clés · **`build`** OK.

**Prochaine étape doc** : **§13.58 étape 6** (hors pilote — épiques séparées). **Reprise courante** : **§13.59** (visibilité annuaire pilote).

**Phrase de reprise** : **§13.59** (remplace **§13.58** pour reprise courte).

---

### Session 2026-06-09 (suite 2) — Affinages preview (hub packs, ordonnances, drift, libellé amendement)

**Branche** : `fix/validated-supply-ecart-ui-modal` — commits **`55336d2`** · **`9768bda`** · **`f38c90b`** · **`f45728e`**.

**Pas de nouvelle migration.**

**Hub packs promo (patient + pharmacien)** :
- **`PromoReservationsHubDashboard`** aligné **`RequestKindHubDashboard`** : **`PromoStatDashboard` uniquement** (5 tuiles) — suppression barre « X dossiers · Y en cours », section **Reprendre rapidement** et blocs sections sous le tableau de bord.
- Groupes statut **sans sous-titre** sous le libellé de groupe (`lib/promo/reservation-hub-buckets.ts`).
- Cartes **`PatientPromoReservationHubCard`** / **`PharmacistPromoReservationHubCard`** (onglet liste) : badge + ref, titre, sous-ligne, vignettes pack, dernière activité — **sans bloc texte sous statut** (plus de hint / passage encadré).

**Ordonnances patient** :
- **`lib/patient-prescription-dossier-shell.ts`** : stack **`patientPrescriptionProductsStackClass`** ; marge **`mt-4 sm:mt-5`** entre **`PatientProductRequestDossierHeader`** et scan ; titre **Produits ordonnance** et bandeaux = enfants flex séparés (`gap-4 sm:gap-5`).

**Drift dossier patient** :
- Scénario **`confirmed → treated`** : bandeau **`RequestDetailStaleBanner`** **affiché** (bouton **Actualiser le dossier**) — fin de l’auto-refresh silencieux seul ; consultation incluse.

**Amendement validée** :
- Statut dossier **conservé** ligne 1 ; ligne 2 **Modifiée** + **Résumé** (**`55336d2`**).
- Hint i18n **`demandes.header.amendedHint`** raccourci : « Modifiée par l'officine après votre validation » (FR) / équivalent AR.

**Phrase de reprise** : **§13.54**.

---

### Session 2026-06-08 — Rebrand Pharmeto (marque, logo, infra prod, OG, annuaire interactif)

**Branche** : `fix/validated-supply-ecart-ui-modal` — commits **`18163bd`** (rebrand code/i18n/SMS/metadata) · **`23287be`** (logo + `dev:clean`) · **`a330fef`** (PNG transparent 500×500) · **`2671f5a`** (OG logo réel) · **`478dec1`** (header logo + titre annuaire) · merges PR **#306**–**#307**.

**Marque & domaine** :
- Nom affiché **Pharmeto** (FR/AR patient/public) ; prod **`https://pharmeto.ma`** (avec et sans `www` validés).
- Tokens **`lib/brand-theme.ts`** ; metadata/PWA **`app/layout.tsx`**, **`app/manifest.ts`**, **`app/robots.ts`**, **`app/sitemap.ts`**.

**Logo & assets** :
- Composant **`components/brand/pharmeto-logo.tsx`** — variantes `icon` / `lockup` / `wordmark` ; source **`public/brand/pharmeto-icon.png`** (500×500 RGBA transparent, P + pointe).
- Favicons statiques **`app/icon.png`**, **`app/apple-icon.png`** (plus de `app/icon.tsx` / `app/apple-icon.tsx` dynamiques).
- Header **`platform-header.tsx`** : mobile icône + wordmark **34 px** (gap 8 px) ; desktop lockup **40 px** (gap icône/texte **10 px** via `gap-2.5`).

**Image OG (partage lien)** :
- **`app/opengraph-image.tsx`** — 1200×630, logo PNG embarqué, slogan **`PHARMETO_BRAND.taglineFr`**, domaine **`pharmeto.ma`**.

**Annuaire public** :
- Titre hero **« Annuaire interactif des pharmacies »** (`messages/fr/annuaire.ts` · AR **« دليل الصيدليات التفاعلي »**) ; liens **`directoryLink`** alignés.

**Communications** :
- SMS préfixe **`Pharmeto:`** (`lib/external-notification-queue-worker.ts`).
- Migration **`20260715_001_rebrand_pharmeto_notification_copy.sql`** (ancre rebrand ; copy in-app patient déjà sans « ProxiPharma » depuis **`20260701_001`**).
- **E-mail notif patient** : expéditeur **Pharmeto** validé en prod (test terrain réponse pharmacie) ; Resend domaine **`pharmeto.ma`** Verified ; **`EMAIL_FROM`** prod aligné (`Pharmeto <noreply@pharmeto.ma>` ou équivalent).
- **SMS réception Twilio** : reporté (messages partent côté Twilio, non reçus sur téléphone test — à traiter plus tard).

**Infra prod (utilisateur)** : Supabase Auth URLs + template OTP **Pharmeto** ; Vercel `APP_BASE_URL` / `NEXT_PUBLIC_APP_BASE_URL` ; webhook SMS `pharmeto.ma` ; GitHub secret `APP_BASE_URL` ; DNS Resend Cap Connect.

**Dev local** : **`npm run dev:clean`** (`scripts/dev-clean.mjs` — purge `.next`) ; `next.config.ts` ignore `.cursor/debug-*.log` ; Turbopack Windows peut afficher « Compiling… » / `Failed to fetch RSC` pendant recompile — normal en dev, pas en prod.

**Migrations à appliquer en pilote (ordre)** : **`20260714_001`** (notifs in-app ar enrichissement) → **`20260715_001`** (ancre rebrand).

**Phrase de reprise** : **§13.52**.

---

### Session 2026-06-07 — Charte pharmacien par type (sky / amber / violet / emerald) + barre basse

**Branche** : `fix/validated-supply-ecart-ui-modal` — commits **`6ee6630`** · **`e910c29`** · **`8e718f6`** · **`64b8d13`** · **`d19a00f`** · **`8304eee`** · **`0af127a`** · **`4a484b6`** · **`f2875c0`**.

**Principe** : même parcours hub + dossier + cartes que le patient, avec une **couleur par type** côté pharmacien — **sky** demandes produits, **amber** ordonnances, **violet** consultations libres, **emerald** réservations packs promo. Charte **compte/officine** (slate / primary) inchangée pour paramètres, clients, pricing, etc.

**Demandes produits (sky)** :
- Hubs **`/dashboard/pharmacien/demandes`** : tuiles + sections **`lib/pharmacist-product-hub-dashboard-ui.ts`** ; cartes **`PharmacistProductDemandeHubCard`** (contour sky).
- Détail : **`PharmacistPatientDossierBand`** (Contacter / Voir le client) ; coquille **`PharmacistProductRequestDossierShell`** ; cartes lignes plates **`pharmacistProductRequestLineCardClass`** ; supply **`PharmacistSupplyCompactLine`** ton sky.

**Ordonnances (amber)** :
- Miroir produits : **`lib/pharmacist-prescription-hub-dashboard-ui.ts`**, **`lib/pharmacist-prescription-request-line-ui.ts`**.
- Détail : scan **au-dessus** des lignes en saisie ; espacements dossier (`pharmacistDossierProductsStackClass`, buckets aérés) ; badges archives sans doublon « Ajout officine » / « Ajouté après validation » ; **Envoyée le** visible en archive ; **`hideSentAt={false}`**.

**Consultations libres (violet)** :
- **`lib/pharmacist-consultation-hub-dashboard-ui.ts`**, **`lib/pharmacist-consultation-request-line-ui.ts`**.
- Hub : cartes riches + tuiles violettes (`patientHubDashboardAccent` inclut pharmacien pour **`free_consultation`**).
- Détail : onglets **Conversation / Produits** inchangés (`ConsultationRequestDetailChrome`) ; validée/traitée = coquille violet + lignes plates ; bandeau « Consultation en cours » teinté violet.

**Réservations packs promo (emerald)** :
- Pharmacien : thème emerald sur hub/détail (commits **`8e718f6`**) — **`lib/pharmacist-promo-reservation-line-ui.ts`**, **`lib/promo/load-pharmacist-promo-patient-contacts.ts`**.
- **Noms patient** : plus de join `profiles` côté client (RLS) — annuaire RPC **`pharmacist_patient_directory_enriched_for_my_pharmacy`** (hub) et **`pharmacist_patient_detail`** (fiche) ; bandeau **`PharmacistPatientDossierBand`**.

**Barre navigation basse (patient + pharmacien)** :
- **`components/layout/platform-bottom-nav.tsx`**, **`lib/platform-bottom-nav.ts`** — 4 onglets dossiers (produits, ordonnances, consultations, packs/réservations) ; masquée hors session / admin / auth.
- Menu profil header : section **Mes dossiers** retirée (dossiers = barre basse) ; pharmacien idem pour **Dossiers & réservations**.
- Détail partagé : onglet actif déduit du **`request_type`** (`lib/platform-bottom-nav-dossier-tab.tsx`, footer **`8304eee`**).

**Patient — autres** :
- Bandeau officine : réf. pharmacie **`ville · P042/26`** (`patient-pharmacy-dossier-band.tsx`).
- Menu profil : **Annuaire** et **Notifications** retirés (cloche header conservée).

**Annuaire public** : hero/header clarifiés sous header clair (**`0af127a`**).

**SQL** : aucune migration.

**Phrase de reprise** : **§13.51**.

---

### Session 2026-06-06 (suite 4) — Médicaments officine (Excel TVA=0) + consolidation marques en prod données

**Branche** : `fix/validated-supply-ecart-ui-modal` — commits **`fae90d9`** (extraction marques v2.1) · **`7f6f675`** (scripts import médicaments).

**Médicaments — import additif Supabase** (sans migration Git) :
- Source : fichier Excel officine (**Article**, **Ppv**, **Pph**, **TVA**) — **TVA = 0** = médicament.
- Scripts : **`scripts/convert-medicaments-xlsx.py`** · **`scripts/import-medicaments-officine.mjs`** · doc **`scripts/README-medicaments-officine.md`**.
- **6 026** médicaments uniques importés (`product_type = medicament`, `category = medicaments_officine`, PPH/PPV, pas de photo).
- Parapharmacie BeautyMall **inchangée** (**13 651**). **Total catalogue pilote : ~19 677**.

**Marques parapharmacie** (rappel session **suite**) :
- Extraction **`extract-product-brands.py`** v2.1 appliquée : **~93,65 %** couverture sur les 13 651 para (**~867** sans marque).
- Colonnes **`brand`** / **`brand_confidence`** (**`20260710_001`**) · pricing par marque (**`20260713_001`**) — appliquer **`20260713_001`** en SQL Editor si l’onglet **Marques** pricing ne répond pas encore.

**Pricing app** : médicament = **PPV** fixe ; parapharmacie = PPH + marge (marque / produit / global).

**Phrase de reprise** : **§13.45**.

---

### Session 2026-06-06 (suite 3) — Archive ordonnance annulée sans lignes produit

**Branche** : `fix/validated-supply-ecart-ui-modal` — commit **`56bc5bc`**.

**Problème** : ordonnance **envoyée** puis **annulée** / **abandonnée** avant réponse pharma (0 ligne `request_items`) → fiche patient quasi vide (pas de bandeau dossier ni scan).

**Correctif patient** (`app/dashboard/demandes/[id]/page.tsx`, **`PatientProductRequestActions`**) :
- Archive affichée **même sans lignes** (`showArchivedReadonly` sans garde `items.length > 0`).
- Bandeau **`PatientProductRequestDossierHeader`** + statut terminal ; libellés dédiés sans produit (**`patientCancelledPrescriptionEmptyArchiveDetailFr`**, **`patientAbandonedPrescriptionEmptyArchiveDetailFr`** dans **`lib/patient-archive-outcome-fr.ts`**).
- **`PrescriptionScanCollapsible`** + message patient en lecture seule ; scan **ouvert par défaut** si archive vide.
- Lien **Annuaire — envoyer une nouvelle ordonnance** pour **`cancelled`** / **`abandoned`** / **`expired`** (aligné expirée).
- Pas de bouton « Ajuster et renvoyer une nouvelle **demande produits** » sur ordonnance archive.

**SQL** : aucune migration.

**Phrase de reprise** : **§13.44**.

---

### Session 2026-06-06 (suite) — Marques catalogue BeautyMall (extraction v2 + v2.1 appliquée)

**Branche** : `fix/validated-supply-ecart-ui-modal` · script **`scripts/extract-product-brands.py`**.

**Migration** : **`20260710_001_products_brand_columns.sql`** — colonnes **`products.brand`**, **`products.brand_confidence`**.

**Résultats pilote Supabase** (session reprise **2026-06-06**) :

| Passe | Couverture | Supabase |
|-------|------------|----------|
| v1 | **83,62 %** | remplacée |
| v2 | **92,37 %** (~12 609 / 13 651) | **13 651** lignes mises à jour |
| v2.1 (+ seeds audit) | **93,65 %** (~12 784 / 13 651) | **13 651** lignes mises à jour |

**v2.1 seeds** : Elancyl, I Love My Hair, MGD Nature, P'anticell, BioMin, Vitae, Pharco, Jumiso, etc. (~30 entrées **`KNOWN_BRAND_DISPLAY`**).

**Reste ~867 non identifiés** : surtout sans slug Beautymall, marques 1–2 SKU, accessoires génériques. Audit : **`scripts/brand-unidentified-patterns.json`**.

**Commande** : `python scripts/extract-product-brands.py --yes` (~35 min REST ; bulk plus rapide si **`DATABASE_URL`**).

**Phrase de reprise marques** : **`scripts/README-product-brands.md`** § « État au 2026-06-06 ».

---

### Session 2026-06-06 (suite 2) — Marques en app : pricing par marque + libellé catalogue

**Branche** : `fix/validated-supply-ecart-ui-modal`.

**Migration** : **`20260713_001_pharmacy_pricing_brand_rules.sql`** — table **`pharmacy_pricing_brand_rules`** ; RPC **`pharmacist_pricing_distinct_brands`** ; résolution prix sur **`products.brand`** (remplace **`products.laboratory`**). Priorité inchangée : produit > marque > global. Anciennes règles laboratoire **non migrées** — reconfigurer l’onglet **Marques** dans **`/dashboard/pharmacien/pricing`**.

**UI pricing** : **`PharmacistPricingManager`** — onglet **Marques** (ex-Laboratoires) · **`lib/pharmacy-pricing/*`**.

**Affichage marque produit** : **`components/products/product-brand-label.tsx`** · sous le nom quand **`products.brand`** renseigné — explorateur catalogue patient, recherche inline, panier, lignes compactes dossier (patient + pharmacien), modale **`PatientProductPhotoPreviewModal`**. Selects Supabase : **`brand`** ajouté aux embeds **`request_items`** et requêtes catalogue (**`PRODUCT_CATALOG_SELECT`** dans **`lib/product-catalog-search.ts`**). Recherche catalogue : nom + marque (+ laboratoire conservé).

**Migrations à appliquer en pilote (ordre)** : **`20260710_001`** (si pas déjà fait) → **`20260713_001`**.

---

### Session 2026-06-06 — Consultation libre lot 3 (scroll, édition post-réponse, photos patient)

**Branche** : `fix/validated-supply-ecart-ui-modal` — commits **`428d662`** (scroll + édition + lightbox) · **`718913f`** (double notif + brief replié) · **`10ddc65`** (lint ESLint brief) · **`bf9b94f`** (photos compress-before-check).

**Consultation libre — patient** :
- Fil conversation : **hauteur minimale confortable** (`consultationConversationMinHeightClass`), **scroll chaining** vers la page (plus de layout `overflow-hidden` plein écran).
- **`ConsultationBriefPanel`** : panneau **replié** « Modifier mon message » ; **un seul** bouton **Enregistrer les modifications** (texte + ajout/suppression photos en brouillon).
- Édition autorisée en **`submitted`**, **`in_review`**, **`responded`** ; onglets Conversation / Produits conservés en **`responded`**.
- Bulle message initial : **Modifié le…** + **Envoyé initialement le…** (`free_consultation_requests.patient_content_updated_at`).
- Lightbox photos : **`ConsultationPhotoLightbox`** — bouton Fermer, retour navigateur/téléphone ferme l’image seulement.

**Consultation libre — backend** :
- **`20260711_001_patient_consultation_edit_after_response.sql`** — colonne **`patient_content_updated_at`**, édition **`responded`**, notif **`patient_consultation_updated`**.
- **`20260712_001_consultation_first_attach_and_save_brief.sql`** — RPC **`patient_save_consultation_brief`** ; **`p_initial_submit`** sur **`patient_attach_consultation_images`** (pas de notif « mise à jour » au 1er envoi avec photos).

**Photos ordonnance + consultation (saisie publique et modification)** :
- **`lib/patient-request-photo-upload.ts`** — compression WebP **avant** contrôle de taille (limite **30 Mo** brut, **4 Mo** après compression).
- Remplace l’ancien rejet systématique **8 Mo** sur fichier téléphone brut (photos 10–15 Mo courantes).

**Migrations à appliquer en pilote (ordre, après lot précédent)** : **`20260711_001`** → **`20260712_001`**.

**Phrase de reprise** : **§13.43**.

---

### Session 2026-06-05 (suite 3) — i18n patient ar/fr + fix date réception ordonnance validée

**Branche** : `fix/validated-supply-ecart-ui-modal`.

**Internationalisation patient (ar / fr)** :
- **`next-intl`** + **`middleware.ts`** ; locales **`fr`** | **`ar`** ; cookie **`pp_locale`** ; détection **`Accept-Language`**.
- **Périmètre** : annuaire public, auth patient, fiche pharmacie, parcours demandes (produits / ordonnance / consultation), hubs, paramètres, promos — **pas** l’espace pharmacien ni admin (**`locale-role-guard`**, **`isFrenchOnlyPath`**).
- **UI** : switcher **AR | FR** header (**`locale-switcher.tsx`**) ; **`dir="rtl"`** locale ar ; messages **`messages/fr/*.ts`** + **`messages/ar/*.ts`**.
- **Hooks copy** : **`use-prescription-ui-copy`**, **`use-consultation-ui-copy`**, **`use-patient-validated-line-labels`** (wrappers sur libs FR existantes).
- Migration **`20260709_001_i18n_patient_notification_ar.sql`** — colonnes **`title_ar`** / **`body_ar`** sur **`app_notifications`** + surcharge patient selon locale.

**Fix ordonnance validée — date réception « à commander »** :
- Dossier **`confirmed`** / **`treated`**, ligne ordonnance : passage **Disponible → À commander** en édition supply → champ **Réception prévue** obligatoire visible dans le bloc produit (aligné demandes produits).
- **`lib/pharmacist-availability.ts`** : **`pharmacistSupplyDraftNeedsReceptionDate`** ; **`effectiveAvailSupplyDraft`** ne resynchronise plus une alternative quand le brouillon est explicitement **`to_order`**.

**Migrations à appliquer en pilote (ordre)** : **`20260709_001`** (après **`20260708_001`**).

**Phrase de reprise** : **§13.42** (dépassée → **§13.43**).

---

### Session 2026-06-06 (suite 5) — couverture i18n patient vagues 1–6

**Branche** : `fix/validated-supply-ecart-ui-modal`.

**Objectif** : traduire l’UI **patient / public** restée en français après le lot initial (**§13.42**), sans toucher pharmacien ni admin.

**Infrastructure** :
- **`scripts/i18n-key-parity.mjs`** + **`npm run i18n:parity`** — parité clés FR/AR + détection chaînes FR dans chemins patient ; étape CI **`.github/workflows/ci.yml`**.
- Helpers **`lib/i18n/`** : **`build-patient-timeline`**, **`use-patient-datetime-formatters`**, **`patient-archive-closure-label`**, **`patient-hub-card-copy`**, **`patient-product-hub-card-context`**, **`patient-last-dossier-status-hint`**, **`use-patient-line-count-label`**, **`use-patient-login-methods-copy`**.

**Vagues (composants / pages)** :
1. Conversation dossier, modales sortie, badges hub, aperçu photo produit.
2. Pages publiques **`demande-produits`**, **`demande-ordonnance`**, **`consultation-libre`** ; metadata **`app/layout.tsx`**.
3. **`patient-demandes-hub`**, **`demande-hub-ui`**, cartes hub produits.
4. Actions validation / archives, timeline, panels ordonnance & consultation, historique ligne.
5. **`external-notification-prefs`**, méthodes connexion auth, **`liste-souhaits`**, fallback notifs AR enrichi.
6. Revue RTL (footers, FAB, modales) ; dates locale partout patient.

**Messages** : namespaces **`demandes`**, **`hub`**, **`workflow`** (`prescriptionPublic`, `consultationPublic`), **`common`**, **`auth`**, etc.

**Hors scope volontaire** : pharmacien/admin FR ; SMS externes FR ; ~28 chaînes FR résiduelles (historique narratif `*-fr.ts`, libellés internes) ; descriptions catalogue BeautyMall.

**Migration** : aucune nouvelle — rappel **`20260709_001`** (notifs in-app **`title_ar`** / **`body_ar`**) si pas appliquée.

**Phrase de reprise** : **§13.46**.

---

### Session 2026-06-06 (suite 6) — explorateur catalogue patient (filtres type / marque + UI)

**Branche** : `fix/validated-supply-ecart-ui-modal` — commits **`fe3921f`** (filtres + pricing marque) · **`c3f394e`** · **`4989304`** (alignement lignes RTL).

**Explorateur patient** (`/pharmacie/[id]/demande-produits/catalogue`) :
- Filtres **type** : Tout · **Parapharmacie** · **Médicament** (`product_type`, requête Supabase paginée).
- Filtre **marque** (parapharmacie) : liste searchable via RPC **`pharmacist_pricing_distinct_brands`** ; **`ProductCatalogExplorerFilters`** · **`useCatalogDistinctBrands`** · **`lib/product-catalog-filters.ts`**.
- Recherche texte inchangée (nom, marque, laboratoire) — combinable avec filtres ; scroll infini **`useProductCatalogExplorer`**.
- UI : bandeau titre, cartes produit arrondies, vignettes **`ProductCatalogExplorerListRow`** ; i18n **`demandePublic`** FR/AR.

**Pricing pharmacien** (même commit) : recherche marques dans l’onglet **Marques** (`pharmacist-pricing-manager.tsx`).

**Migration** : aucune.

**Phrase de reprise** : **§13.47**.

---

### Session 2026-06-06 (suite 7) — lignes produit RTL + modale photo catalogue

**Branche** : `fix/validated-supply-ecart-ui-modal` — commits **`4989304`** (lignes RTL) · **`aea9fd4`** (modale photo).

**Lignes produit patient (AR / FR)** — **`ProductRequestLinePanel`** (`patient-demande-produits-ui.tsx`) :
- Remplacement positionnement absolu `left` par **flex `justify-between`** (prix vs qté + icône message) ; bouton supprimer en **`-end`**.
- Parcours concernés : panier saisie, dossier (envoyée / répondue / …), recherche catalogue inline.

**Modale aperçu photo** — **`PatientProductPhotoPreviewModal`** :
- Affiche la **vraie photo** quand **`photo_url`** est résolu (**`resolvePublicMediaUrl`**) — le flag **`catalogExplorerPreview`** ne force plus le placeholder « disponible prochainement » si une URL existe.
- **Cadrage** : image **`max-h-full max-w-full object-contain`** dans un cadre **`overflow-hidden`** ; hauteur photo plafonnée quand description présente (mobile / desktop) pour éviter débordement sur le panneau description.
- Placeholder **`ProductPhotoComingSoonFrame`** : produits sans photo (explorateur, médicaments).

**Migration** : aucune.

**Phrase de reprise** : **§13.48**.

---

### Session 2026-06-06 (suite 9) — hub réservations packs promo (patient + pharmacien) + préfixe Pharmacie

**Branche** : `fix/validated-supply-ecart-ui-modal` — commits **`fbe2445`** (hub promo) · **`91c6edc`** (lint `set-state-in-effect`).

**Hub patient** (`/dashboard/patient/packs-promo`) et **pharmacien** (`/dashboard/pharmacien/reservations-packs`) alignés sur parcours demandes produits :
- Onglets **Tableau de bord** / **Liste** (`DemandeHubTabBar`, `?vue=dashboard|liste`).
- **`PromoStatDashboard`** — 5 tuiles statut (soumise, confirmée, récupérée, indisponible, annulée) regroupées En cours / Historique (patient) ou À suivre / Terminées (pharmacien).
- **`PromoReservationsHubDashboard`** — stats, reprise rapide, sections activité, cartes **`PatientPromoReservationHubCard`** / **`PharmacistPromoReservationHubCard`**. *(Tableau de bord épuré — tuiles seules — voir §10 **2026-06-09 (suite 2)**.)*
- Liste filtrable : statut URL, pharmacie (patient) / patient (pharmacien), recherche réf., tri.
- Libs : **`lib/promo/reservation-hub-buckets.ts`**, **`reservation-hub-sections.ts`**, **`reservation-hub-dashboard.ts`**, **`reservation-hub-list-filters.ts`** ; i18n patient **`promo.dashboard.*`** (FR/AR).

**Préfixe « Pharmacie »** côté patient : **`pharmacyPublicLabel`** sur cartes/détail pack ; **`formatPatientNotificationPharmacyText`** dans **`pick-notification-text.ts`** (titres/corps notifs) ; filtre hub demandes produits ; e-mails externes worker.

**ESLint** : pas de **`setFiltersExpandedUser` dans `useEffect`** pour `filtres=0` — repli géré par **`hubListFiltersPanelExpanded`** (hubs promo + hubs demandes).

**Migration** : aucune.

**Phrase de reprise** : **§13.50**.

---

### Session 2026-06-06 (suite 8) — explorateur catalogue UX compact + scroll infini

**Branche** : `fix/validated-supply-ecart-ui-modal` — commits **`bd9b310`** (toolbar + modale marque) · **`d7622d6`** (scroll + garde pagination).

**Explorateur patient** (`/pharmacie/[id]/demande-produits/catalogue`) :
- **`ProductCatalogExplorerToolbar`** : une seule barre (recherche + puces type + bouton **Marque**) — plus de bandeau titre ni liste marque inline qui masquait les produits.
- **Marque** : sélection en **modale** (sheet mobile) avec recherche dédiée ; puce amovible sur la barre.
- **Liste produits** : occupe l’espace restant sous les filtres (`h-[100dvh]`, flex `min-h-0`, **`overflow-y-auto`** sur la liste).
- **Scroll infini** : sentinel dans le conteneur scrollable ; verrou anti-rafale (**`fetchInFlightRef`** hook + page) ; reset scroll haut au changement filtres/recherche ; pages **`PRODUCT_CATALOG_EXPLORER_PAGE_SIZE`** (60).

**Fix build** (`bd9b310`) : typage **`descriptionHtmlContent`** modale photo (`dangerouslySetInnerHTML`).

**Migration** : aucune.

**Phrase de reprise** : **§13.49**.

---

### Session 2026-06-05 (suite) — Vocaux envoi initial, MIME Storage, consultation UX lot 2, ordonnance pharma

**Branche** : `fix/validated-supply-ecart-ui-modal` — commits **`fa897de`** (MIME audio bucket) · **`cb90da3`** (vocal envoi initial) · **`6cb3160`** (retours ordonnance pharmacien) · **`081fc02`** (consultation UX lot 2).

**Messages vocaux — envoi initial patient** (`cb90da3`) :
- **`ConversationMessageDraftField`** + **`ConversationAudioDraftPreview`** — composant partagé avec le fil conversation (même enregistrement **30 s**).
- Intégré sur **`/pharmacie/[id]/demande-produits`**, **`demande-ordonnance`**, **`consultation-libre`** et **`patient-demande-produits-ui.tsx`**.
- Au submit : premier commentaire dossier via **`sendRequestConversationMessage`** (texte facultatif + vocal).

**Fix MIME bucket `private-media`** (`fa897de`) :
- Migration **`20260707_001_private_media_conversation_audio_mime.sql`** — autorise **`audio/webm`**, **`audio/mp4`**, **`audio/m4a`**, etc. (avant : images seules → échec upload vocal).
- **`lib/conversation-audio-media.ts`** — normalisation **`contentType`** à l’upload (sans suffixe `codecs=opus`).

**Consultation libre UX lot 2** (`081fc02`) :
- **`RequestConversationInline`** : auto-scroll bas (stick-to-bottom si l’utilisateur n’a pas remonté le fil).
- Patient onglet Conversation : wrapper hauteur **`consultationConversationViewportHeightClass`** ; brief « Modifier mon message » **sous** le fil (ne compresse plus la zone messages).
- Transition **`responded`** : onglet **Produits** + fermeture modal conversation (patient + pharmacien après publish).
- Retrait badges / onglets **« Produit »** redondants sur lignes consultation.
- Notif « validée mise à jour » : reload + **`acknowledgeRequestDrift`** sans F5.
- Archive consultation clôturée : **`free_consultation`** exclu du **`RequestKindHeader`** doublon (aligné ordonnance).

**Ordonnance — retours UX pharmacien** (`6cb3160`) :
- Lightbox zoom scan, FAB au-dessus footers, suppression lignes en édition répondue, dispo frozen lisible, save répondue bump **`requests.updated_at`** + **`dispatchRequestDetailRefresh`**.
- Migration **`20260707_002_patient_prescription_update_sync.sql`** — note patient ordonnance sync conversation + drift UI.
- Migration **`20260708_001_prescription_first_attach_no_update_notif.sql`** — pas de notif « Demande validée mise à jour » au premier attach des pages scan.

**Migrations à appliquer en pilote (ordre, après lot précédent)** : **`20260707_001`** → **`20260707_002`** → **`20260708_001`**.

**Phrase de reprise** : **§13.41**.

---

### Session 2026-06-05 — Consultation libre UX, messages vocaux conversation, ordonnance archive

**Branche** : `fix/validated-supply-ecart-ui-modal` — commits **`c507609`** (consultation) · **`ea54827`** (vocaux) · fix archive ordonnance patient.

**Consultation libre (patient + pharmacien)** :
- En-têtes **`PatientProductRequestDossierHeader`** / **`PharmacistProductRequestDossierHeader`** + onglets ; scroll conversation tactile ; annulation patient footer page entière ; bandeau drift global ; refresh notif (`focus: conversation`) + realtime `request_comments`.
- Pharmacien : ajout produit sans motif ; cartes lignes alignées demandes produits ; libellés neutres (`lib/consultation-ui-copy.ts`, `consultation.config.ts`).
- Migration **`20260705_001_consultation_conversation_notif_skip_fix.sql`** — notif pharmacien dès le 1er message chat (skip soumission réservé produits/ordonnance).

**Messages vocaux conversation (fil dossier FAB + inline consultation)** :
- **`ConversationComposer`**, **`ConversationMessageBubble`**, **`ConversationAudioPlayer`**, **`useConversationAudioRecorder`**, **`lib/send-request-conversation-message.ts`**.
- Max **30 s** ; chemins Storage `private-media/conversation-audio/` ; texte facultatif avec vocal.
- Migration **`20260706_001_conversation_audio_messages.sql`** — colonnes `audio_path` / `audio_duration_seconds`, policies Storage, trigger notif adapté.
- **Envoi initial** (voir session **2026-06-05 (suite)**) : **`ConversationMessageDraftField`** sur saisie publique produits / ordonnance / consultation libre.
- **MIME bucket** : **`20260707_001`** requis pour upload (voir suite).
- Script vidage : **`clear-request-private-media.mjs`** inclut les vocaux.

**Ordonnance archive clôturée (patient)** :
- **`app/dashboard/demandes/[id]/page.tsx`** : `hideMainRequestHeader` inclut **`prescription`** en archive — plus de **`RequestKindHeader`** au-dessus du bandeau dossier.

**Migrations à appliquer en pilote (ordre)** : **`20260705_001`** puis **`20260706_001`**.

**Phrase de reprise** : **§13.40** (dépassée → **§13.41**).

---

### Session 2026-06-04 (suite 2) — Catalogue BeautyMall : import Supabase + aperçu photo/description

**Branche** : `fix/validated-supply-ecart-ui-modal` — commits **`8999b9d`** (scripts export CSV) · **`736100f`** (import + UI aperçu).

**Import catalogue (pilote terrain, appliqué sur Supabase)** :
- **`scripts/import-beautymall-catalog.mjs`** — lit `scripts/products_final.csv` ; batch 200 ; `--dry-run`.
- **`supabase/scripts/wipe-catalog-beautymall-import.sql`** — vide promos (`pharmacy_promo_offer_lines`, réservations, notifs promo) puis **`products`** (évite erreur **`23514`** sur CHECK promo).
- Mapping : tout **`parapharmacie`** ; **`price_pph`** = `sale_price`, **`price_ppv`** = `regular_price` ; **`photo_url`** = `url_image_valide` (URL BeautyMall externe, pas Storage) ; **`full_description`** = HTML `description` ; **`laboratory`** vide ; **`category`** = `beautymall_catalog` ; **`subcategory`** = slug `url_produit`.
- Résultat confirmé : **13 651** produits · **12 171** avec photo · **1 480** sans photo.

**Audit fusion CSV (avant import)** :
- **13 651** lignes source · **12 173** matchs sitemap (**89,17 %**) · **1 478** sans URL BeautyMall.
- 2e passe fuzzy manuelle : ~**105–125** récupérables fiables ; ~**264** avec relecture.

**UI — vignette produit cliquable + description** (patient **et** pharmacien, même modale) :
- **`PatientProductPhotoPreviewModal`** — photo agrandie + panneau **Description** scrollable (`lg:flex-row` desktop).
- **`lib/product-description-html.ts`** — nettoie pied de page BoatScrape dans le HTML importé.
- **`PharmacistProductPhotoThumb`** · **`lib/fetch-product-descriptions-map.ts`** (hubs commandés / ruptures : fetch `full_description` sans migration RPC).
- Parcours couverts : dossiers patient/pharmacien (tous statuts), demande publique + catalogue, hubs officine, promos, ordonnance quick-add, archives figées.

**SQL** : aucune nouvelle migration — réutilise **`products.full_description`** + photos URL externes.

**Prochain jalon** : preview terrain (clic vignette) ; migration progressive photos vers Storage si besoin (`import-products-catalog.mjs` comme modèle) ; merge PR **`fix/validated-supply-ecart-ui-modal`**.

**Phrase de reprise** : **§13.39**.

---

### Session 2026-06-04 — Catalogue BeautyMall : sitemap + fusion CSV WooCommerce (hors BDD)

**Branche** : `fix/validated-supply-ecart-ui-modal` — scripts locaux (pas de migration Supabase).

**Pipeline** (Node, sans Python requis) :
1. **`scripts/fetch-beautymall-sitemap-products.mjs`** — lit `https://beautymall.ma/sitemap_index.xml`, parcourt les `product-sitemap*.xml`, sortie **`scripts/beautymall_sitemap_products.csv`** (colonnes `slug`, `url_produit`, `url_image`). Pilote terrain : **13 510** produits.
2. **`scripts/merge-beautymall-products.mjs`** — CSV principal WooCommerce (ex. export BoatScrape `wp-https___PRODUCTS PARA (1).csv`) + sitemap ; normalisation nom → slug ; fuzzy **≥ 85 %** ; sorties **`products_final.csv`** (colonnes source + `url_produit`, `url_image_valide`) et **`products_unmatched.csv`**. Pilote terrain : **13 651** lignes, **12 173** matchs (**89,17 %**), **1 478** sans correspondance.
3. **`scripts/merge_beautymall_products.py`** — même logique avec **RapidFuzz** (si Python + `pip install -r scripts/requirements-beautymall-merge.txt`).

**Git** : CSV générés ignorés (`.gitignore`) — ne pas versionner les exports lourds.

**Prochain jalon** : import Supabase — **fait** (voir §10 session **2026-06-04 (suite 2)**).

**Phrase de reprise** : **§13.38** (dépassée → **§13.39**).

---

### Session 2026-06-03 (suite 4) — Ordonnances : parcours UI = demandes produits (ambre) + reset test

**Branche** : `fix/validated-supply-ecart-ui-modal` — commit **`721c991`** (UI ordonnance patient/pharmacien/hub/historique ; scan pharmacien au-dessus des lignes en saisie).

**Ordonnances** : thème **ambre** (`lib/request-kind-ui-theme.ts`, `lib/prescription-ui-copy.ts`) ; libellés **Ordonnance** / **Qté prescrite** ; historique « saisie officine » ; hubs cartes produits ; modale validation ambre ; UX pharma scan ↔ saisie (`PrescriptionScanCollapsible`, boutons **Voir l'ordonnance** / **Ajouter**).

**SQL** : **`20260703_001`** (priorités hub pharmacien) ; **`20260703_002`** (`pharmacist_mark_request_treated` + workflow lignes ordonnance/consultation).

**Outils test** : `supabase/scripts/clear-all-requests.sql` ; `scripts/clear-request-private-media.mjs` ; `scripts/reset-storage-keep-catalog-and-pharmacy-photos.mjs`.

**Phrase de reprise** : **§13.37**.

**Prochain jalon** : preview terrain ordonnances + demandes produits après vidage test si besoin.

---

### Session 2026-06-03 (suite 3) — Demande produits : pharmacien validée/traitée/archives + bandeau patient

**Branche** : `fix/validated-supply-ecart-ui-modal` — commits **`2f46ff7`** … **`2960d23`** (bandeau patient + hint portail + docs §13.36).

**Pharmacien — détail produits** (`app/dashboard/pharmacien/demandes/[id]/page.tsx`) :
- **Validée** : **`PharmacistValidatedBucketSection`** (bloc arrondi header+liste, titres agrandis) ; **`PharmacistSupplyCompactLine`** aligné **`PatientValidatedCompactLineCard`** (PU/Qté, libellés en bas, boutons message/⋮) ; **`sectionBucket`** + **`labelAudience: pharmacist`** (`lib/patient-validated-line-labels-fr.ts`).
- **Traitée** : titres groupes **pour le patient** ; suppression **`RequestLineSuiviStrip`** ; CTA **Marquer reçu / récupéré** sur une ligne ; footer **Déclarer traitée** compact + **`InfoHint`** en portail (`components/ui/info-hint.tsx`).
- **Archives clôturées** : **`PharmacistClosedProductBucketsView`** + **`pharmacist-closed-archive-line.tsx`** (cartes compactes, total récupérés, blocs unifiés).
- **Envoyée / répondue** : cartes compactes, onglet **Proposé**, footer sticky sans débordement mobile (`platform-sticky-footer.tsx`).

**Patient — bandeau officine** :
- **`PatientPharmacyDossierBand`** : icône **Store** à gauche du nom ; **Contacter** · **Itinéraire** (`PharmacyNavigationPicker` `compact-outline`) · **Voir la fiche** (bouton primary, sans icône localisation).
- **`PatientProductRequestDossierHeader`** + récap **`PatientSentEnvoyeeSummaryCard`** ; champs GPS/adresse sur `pharmacies(...)` dans `app/dashboard/demandes/[id]/page.tsx`.

**SQL** : aucune migration.

**Fichiers clés** : `patient-pharmacy-dossier-band.tsx`, `patient-product-request-dossier-header.tsx`, `pharmacist-supply-compact-line.tsx`, `pharmacist-validated-bucket-section.tsx`, `pharmacist-closed-product-buckets-view.tsx`, `pharmacist-closed-archive-line.tsx`, `pharmacy-navigation-picker.tsx`, `info-hint.tsx`.

**Phrase de reprise** : **§13.36**.

**Prochain jalon** : retours preview terrain ; ordonnances/consultations si besoin.

---

### Session 2026-06-02 (suite 2) — Demande produits : parcours patient abouti + pharmacien aligné

**Branche** : `fix/validated-supply-ecart-ui-modal` — commits **`978f862`** … **`773ad62`** (PR **#238** mergée en prod pour le lot patient intermédiaire).

**Patient — demande produits** (`§4.6`, **`PatientProductRequestActions.tsx`**) :
- **Répondue** : couleurs **indicatives** seulement (bordures/titres) ; groupes **`PatientRespondedBucketSection`** ; onglets Ta demande / Alt. ; **aucune alternative cochée par défaut** ; barre **« Retenir votre demande initiale »** / **« Retenir cette alternative »** (case agrandie) ; cases dans les onglets **indicatives** ; modales notes via **`AppModalOverlay`** (`z-index` 11000).
- **Validée / traitée** : **`PatientValidatedBucketSection`** + **`PatientValidatedCompactLineCard`** ; cartes produit séparées (`patient-bucket-product-row-ui.ts`) ; footer sticky inchangé fonctionnellement.
- **Archives** (expirée, annulée, abandonnée, clôturée) : **`PatientClosedArchiveBucketSection`** ; lignes non retenues harmonisées (historique + message, pas de bandeau bas).

**Pharmacien — demande produits** (`app/dashboard/pharmacien/demandes/[id]/page.tsx`) :
- **`PharmacistProductRequestDossierHeader`** : hint statut central ; compteurs discrets ; bandeaux legacy masqués sur le parcours actif (`hideMainRequestHeader`).
- **Saisie / répondue** : cartes éditeur neutres (`lib/ui-density.ts`) — accent **barre gauche** seulement ; moins de texte redondant.
- **Validée / traitée** : **`PharmacistValidatedBucketSection`** aligné patient (`lib/patient-validated-bucket-ui.ts`) ; **`PharmacistSupplyCompactLine`** compacte (cartes séparées, PU/Qté/Total épurés).
- **Archives clôturées** : **`PharmacistClosedProductBucketsView`** même découpage que patient.
- **Footers** : pas de doublon « Clôturer le dossier » inline si footer sticky ; modales inchangées (`AppModalOverlay`).

**Hub pharmacien liste** : **`PharmacistProductDemandeHubCard`** — contexte en texte simple.

**SQL** : aucune migration.

**Fichiers clés** : `patient-responded-line-chooser.tsx`, `patient-product-request-actions.tsx`, `pharmacist-supply-compact-line.tsx`, `pharmacist-validated-bucket-section.tsx`, `pharmacist-closed-product-buckets-view.tsx`, `pharmacist-product-demande-hub-card.tsx`.

**Phrase de reprise** : **§13.34**.

**Prochain jalon** : retours preview terrain ; affiner ordonnances/consultations pharmacien si besoin (hors lot produits).

---

### Session 2026-06-01 (suite 4) — Hubs 8 statuts + charte pages menu compte

**Branche** : `fix/validated-supply-ecart-ui-modal` — commits **`f822376`** (hub unifié 8 statuts), **`ff7ffe9`** (charte menus compte + docs).

**Hubs demandes** (patient + pharmacien, **produits / ordonnances / consultations**) :
- **`RequestKindHubDashboard`** — ordre : **8 statuts** (`DemandeStatDashboard`, compact, barres) → repères (total, en cours, non lus) → **Reprendre rapidement** (5) → raccourcis **`patient-product-hub-sections`** / **`pharmacist-product-hub-sections`** (3 cartes, archives repliées) → lien liste filtrée.
- Suppression bandeau 3 colonnes + KPI dupliqués sur hub produits ; hints par type via **`dashboardBucketsForKind`**.
- Liste : **`hub-list-filter-chrome.ts`** + en-têtes **`PatientAccountPageHeader`** / **`PharmacistAccountPageHeader`** (charte primary, pas sky/amber/emerald des dossiers).

**Pages menu / compte** (charte **`platform-dashboard-chrome.ts`**) :
- **`PatientAccountPageHeader`** : Mes pharmacies, paramètres, packs promo, notifications, liste de souhaits ; hubs avec lien Notifications.
- Menu header : **Notifications**, **Annuaire pharmacies** (patient) — `platform-header.tsx`.
- **Tableau de bord pharmacien** : **8 statuts** (agrégat tous types) après KPI ; accès rapides incl. consultations.
- **Packs promo** / **clients** : stats et bandeaux alignés charte (plus sky isolé sur écrans compte).

**Fichiers clés** : `components/requests/hub/request-kind-hub-dashboard.tsx`, `lib/request-kind-hub-dashboard.ts`, `components/patient/patient-account-page-header.tsx`, `lib/hub-list-filter-chrome.ts`, `app/dashboard/demandes/patient-demandes-hub.tsx`, `app/dashboard/pharmacien/demandes/pharmacist-demandes-hub.tsx`, `components/pharmacist/pharmacist-dashboard.tsx`.

**Phrase de reprise** : **§13.34**.

**Prochain jalon** : retours preview terrain sur hubs et menus ; finitions mineures si besoin.

---

### Session 2026-06-01 (suite 3) — Annuaire : chrome unifié, barre sticky, cartes allégées

**Livré** (branche **`fix/validated-supply-ecart-ui-modal`**, pas de migration SQL) :
- **Mobile** : plus de grand hero vert — titre court + **recherche/filtres sticky** sous `PlatformHeader` (`top-[3.25rem]` / `sm:top-14`) ; compteur **dans** la barre outils.
- **Desktop (`sm+`)** : bandeau **slate-900** aligné au header global, image hero en filigrine (~18 % opacité), texte d’accroche court.
- **Cartes** : actions Appeler / WhatsApp / Itinéraire / Partager en **grille sous l’adresse** (plus de rail sur la photo) ; garde = **badge** + filet ambre à gauche (plus d’anneau doré sur toute la carte).

**Fichiers** : `components/annuaire/annuaire-page.tsx`, `components/annuaire/annuaire-pharmacy-card.tsx`.

---

### Session 2026-06-02 — Annuaire : actions sur la photo (cercles compacts)

**Livré** (branche **`fix/validated-supply-ecart-ui-modal`**, pas de migration SQL) :
- **Cartes** : photo **pleine largeur** ; Appeler / WhatsApp / Itinéraire / Partager en **colonne verticale sur la photo** (plus de grille sous l’adresse) ; disques circulaires semi-opaques **32 px** (`uiAnnuaireActionOverlayBtnGhost`) ; picker **`annuaire-overlay`**.

**Fichiers** : `components/annuaire/annuaire-pharmacy-card.tsx`, `components/pharmacy/pharmacy-navigation-picker.tsx`, `lib/ui-action-buttons.ts`.

---

### Session 2026-06-01 (suite 2) — FAB Conversation déplaçable (détail dossier)

**Livré** (branche **`fix/validated-supply-ecart-ui-modal`**, pas de migration SQL) :
- Bouton rond **Conversation** (`RequestConversationFabDock`) sur détail patient et pharmacien **`/dashboard/.../demandes/[id]`** : **glisser** pour repositionner sur toute la zone visible ; position mémorisée en **sessionStorage** (`proxipharma:conversationFabInset`).
- **Limite haute** = bas du bandeau fixe **`PlatformHeader`** (attribut **`data-proxipharma-platform-header`** sur `platform-header.tsx`) ; marges ~8px sur les bords ; calque **`z-[10050]`** (`Z_FLOATING_ABOVE_STICKY_FOOTER`) — au-dessus des footers sticky dossier, **sous** les modales (`11000`).
- **Position initiale** : au-dessus du footer sticky du dossier (`stickyFooterFabMinBottomPx` / `lib/platform-sticky-footer.ts`) ; après déplacement, le bouton peut être posé plus bas (y compris au-dessus du footer grâce au z-index).
- Clamp partagé : **`lib/conversation-fab-position.ts`** (`clampConversationFabInset`, `platformHeaderBottomPx`).

**Fichiers clés** : `components/requests/request-conversation-panel.tsx`, `lib/conversation-fab-position.ts`, `components/layout/platform-header.tsx`.

**Hors périmètre** : **consultation libre** = messagerie **inline** (pas de FAB) ; **notes par ligne** = `pharmacist-line-conversation-chip` (non déplaçable). **Messages vocaux** (session **2026-06-05** + suite, **`20260706_001`**, **`20260707_001`**) : **`ConversationComposer`** (inline + modal FAB) et **`ConversationMessageDraftField`** (envoi initial saisie publique) — max **30 s**.

---

### Session 2026-06-01 — Abandon refonte UX Glovo-like (branche supprimée)

**Décision** : la refonte « big bang » Glovo-like est **abandonnée** — ne pas la reprendre ni la merger.

**Actions** :
- Branche distante **`design/ux-refonte-2026`** **supprimée** sur GitHub (commits historiques **`3b189a7`**, **`89b35d1`** uniquement sur l’historique Git si besoin de consultation : `git fetch origin` puis `git log origin/design/ux-refonte-2026` ne fonctionne plus ; utiliser les SHA ou le reflog distant côté admin GitHub si récupération nécessaire).
- **UI/UX à venir** : affinages **écran par écran** sur **`fix/validated-supply-ecart-ui-modal`** (preview PR habituelle), charte actuelle sky/amber/violet selon type de demande.

**Phrase de reprise (contexte seul)** : **§13.35**.

---

### Session 2026-05-30 — Refonte UX Glovo-like (archivée — abandonnée 2026-06-01)

**Branche refonte** (historique) : **`design/ux-refonte-2026`** — commits **`3b189a7`**, **`89b35d1`**. **Jamais mergée** ; branche distante **supprimée** le **2026-06-01**.

**Livré sur la branche refonte** (preview uniquement, non retenu en prod) :
- **`lib/design-system/`** (tokens, accents type demande) · composants **`components/ui/`** (`ListRow`, `PageHeader`, `StickyActionBar`, …).
- **`docs/DESIGN-SYSTEM.md`**, **`docs/UX-REFONTE-CHECKLIST.md`** — parcours test preview (public, patient, pharmacien).
- Couverture : annuaire, fiche, auth, saisies publiques, hubs/détails patient & pharmacien, compte, promos — **pas de migration SQL**.

**Décision finale** : voir session **2026-06-01** ci-dessus. Travail courant / merge prod = **`fix/validated-supply-ecart-ui-modal`**.

---

### Session 2026-05-29 — Pharmacien : Mes paramètres, charte compte/officine, hub produits, post-validé

**Branche** : `fix/validated-supply-ecart-ui-modal` — commits poussés **`566f4a5`** … **`ee2eb02`** (derniers : **`378f6b5`** lint vue répondue ; **`6146ef4`** hub pharmacien sky + KPIs ; **`ee2eb02`** paramètres + en-têtes charte).

**Supabase (pilote)** : **toutes les migrations Git appliquées** jusqu’à **`20260630_001_partial_counter_closure.sql`** (dont **`20260625_001`** revalidation patient, **`20260626_001`** CRM pharmacies patient, **`20260628_*`** traitée / abandon, **`20260629_*`** fulfillment + notifs, **`20260630_001`** clôture comptoir partielle).

**Mes paramètres pharmacien** (`ee2eb02`) :
- **`/dashboard/pharmacien/parametres`** · **`components/pharmacist/pharmacist-settings-page.tsx`** — sections repliables (**`PharmacistSettingsSection`** = alias patient) : profil (nom modifiable), **Mon officine** (raccourcis fiche / horaires / pricing / promos / aperçu public), connexion/sécurité (MDP, e-mail, compte admin provisionné), notifications (**`ExternalNotificationPrefs`** `variant="pharmacien"` `appearance="settings"`), raccourcis hubs, déconnexion (pas d’auto-suppression compte — admin pilote).
- Menu header : **Mes paramètres** (`platform-header.tsx`).

**Charte compte / officine** (`ee2eb02`) — **`lib/platform-dashboard-chrome.ts`** (primary, pas sky dossiers) + **`PharmacistAccountPageHeader`** :
- Tableau de bord, **Clients**, **Produits commandés**, **Ruptures**, **Ma fiche**, **Horaires et garde**, **Pricing**, **Offres promos**, **Réservations packs**, **Visites et interactions**.

**Hub demandes produits pharmacien** (`6146ef4`, remplacé **2026-06-01 suite 4**) :
- Ancien : thème sky, bandeau 3 colonnes, KPIs dupliqués — **remplacé** par **`RequestKindHubDashboard`** (8 statuts en tête, charte compte sur liste).

**Détail pharmacien post-validé / répondue** (lots **`566f4a5`**, **`378f6b5`**) :
- Workflow **brouillon différé** + footer **Enregistrer** ; modale canal unique pour amendements ; ordre save **amendements puis lignes** (évite erreur canal avec données déjà en base).
- Vue **répondue figée** : alternatives en lecture seule (`effectiveAltTab` → principal) ; reset onglets alt via **`resetRespondedLineAltUi`** (pas de `useEffect`+`setState` — CI **`react-hooks/set-state-in-effect`**).
- **Clôture comptoir partielle** : **`lib/pharmacist-counter-closure.ts`**, **`PharmacistCloseRequestConfirmModal`**, migration **`20260630_001`** (auto-écart lignes non récupérées si ≥1 `picked_up`).
- En-tête dossier : statut + détail + bouton parcours ; pastilles sur rangée dédiée ; **`InfoHint`** viewport-safe.

**Phrase de reprise** : **§13.34**.

**Prochain jalon** : retours terrain preview ; §4.6 pharmacien **envoyée** / **ordonnances** / **consultations** si écarts ; finitions UX mineures hubs ordonnances/consultations.

---

### Session 2026-05-25 (suite 3) — Hub demandes produits, Mes pharmacies, Mes paramètres

**Branche** : `fix/validated-supply-ecart-ui-modal` — commits poussés **`4c555da`** … **`cce3d15`** (pas de nouvelle migration sur le lot hub/paramètres ; **Mes pharmacies** = **`20260626_001`**).

**Hub demandes produits** (`/dashboard/demandes`) — voir aussi **session 2026-06-01 suite 4** :
- **Tableau de bord** (historique **2026-05-25**) : regroupements indicatifs — **remplacé** par **`RequestKindHubDashboard`** (8 statuts d’abord, puis raccourcis **`lib/patient-product-hub-sections.ts`**).
- **Liste** (`patient-demandes-hub.tsx`) : filtre **Statut** (buckets) + pharmacie / réf. / tri — **pas** de regroupement URL ; **`filterPatientProductHubListRows`** = statut seul.
- **Archives / terminés** (`4c555da`) : **`PatientRequestOutcomeBanner`** + **`ReadonlyArchivedProductBucketsView`** ; répondue sans propositions officine post-envoi.

**Mes pharmacies** (`b1e9b9d`, **`3f6fed5`**) :
- Migration **`20260626_001_patient_pharmacy_directory_crm.sql`** — RPC **`patient_pharmacy_directory_enriched`**, **`patient_pharmacy_detail`** ; fallback client si RPC absente.
- **`/dashboard/patient/pharmacies`** + fiche **`[pharmacyId]`** ; retour **← Annuaire** ; cartes sans liens imbriqués (WhatsApp/tél. hors `Link` principal) ; chrome **`lib/platform-dashboard-chrome.ts`** (charte annuaire, plus sky produits).

**Mes paramètres** (`cce3d15`) :
- **`components/patient/patient-settings-page.tsx`** — profil (nom, code client), connexion/sécurité, notifications (**`ExternalNotificationPrefs`** `appearance="settings"`), aide, déconnexion.
- **`POST /api/patient/delete-account`** — refus si demandes/promos actives ; menu header **Mes paramètres**.

**Correctifs build** : **`a7fb256`** — typage archive snapshot ; **`3f6fed5`** — hydration liens Mes pharmacies.

**Phrase de reprise** : **§13.34**.

**Prochain jalon** : retours UX patient mineurs si besoin ; **pharmacien** §4.6 — **envoyée** puis **répondue**.

---

### Session 2026-05-25 (suite 4) — Badge « Fermée » rouge uniforme (annuaire + fiche + horaires)

**Branche** : `fix/validated-supply-ecart-ui-modal` — commit **`e7540d3`** (pas de migration).

**UI** :
- **`lib/pharmacy-open-status-ui.ts`** — styles partagés : **Ouverte** (vert) / **Fermée** (rouge `rose`) ; lignes horaires « fermé » / « férié » ; case **Fermé** édition horaires pharmacien.
- **Annuaire** : `annuaire-pharmacy-card.tsx` (badge couverture — plus de gris slate).
- **Fiche publique** : `pharmacy-public-profile.tsx` (couverture + encart **Aujourd’hui** onglet Horaires).
- **Pharmacien** : `pharmacy-compact-time-range.tsx`, `pharmacy-overrides-tab.tsx` (libellés **M fermé** / **AM fermé**).

**Doc agent** : `AGENTS.md` (ligne annuaire / fiche).

---

### Session 2026-05-25 — Patient demande produits : saisie publique, envoyée, répondue, validée (UI/UX)

**Branche** : `fix/validated-supply-ecart-ui-modal` — commits poussés **`e37f667`** … **`aec3071`** (lot UI patient ; pas de nouvelle migration).

**Saisie publique** (`/pharmacie/[id]/demande-produits` + **catalogue**) :
- Grille compacte **`ProductRequestLinePanel`** — **`components/pharmacy/patient-demande-produits-ui.tsx`** (photo 56px, PU/Total, Qté, Message).
- Explorer : charte sky, barre recherche seule, footer un bouton « Ajouter X produit(s)… » (sans « Tout sélectionner »).

**Demande envoyée** (`submitted` / `in_review`) — détail patient **`app/dashboard/demandes/[id]/page.tsx`** :
- En-tête **`PatientProductRequestDossierHeader`** (sky, N°, Contacter, Voir la fiche).
- Lignes **`PatientProductRequestCompactLine`** ; correctifs mobile (`overflow-x-hidden`, import `cn`).

**Demande répondue** (`responded`) — **`components/requests/product/patient-responded-line-chooser.tsx`** + **`patient-product-request-actions.tsx`** :
- Même en-tête dossier sky que **envoyée**.
- Bloc produit compact : **case à cocher** sur le **coin haut gauche du bloc** (léger débordement ; avec **onglets** alternatives : position plus basse — prop **`variantTabsAbove`**).
- **Alternatives groupées** : un seul conteneur bordé sky (« Choisir une option », onglets + carte active).
- Badges **Ta demande** / **Alternative** / **Ajout Officine** ; **PU** + **Tot** indicatif (Tot sous PU) ; titre produit **une ligne** (`truncate` + `title`).
- **Motif** ajout officine **dans le bloc** (ellipsis si long).
- Indisponible / rupture : icône **Ban** (pas de case) ; non retenu : fond atténué + **titre barré**.
- **Qté conservée** au recochage d’une ligne déjà retenue (`toggleLineRetention` garde `prev.qty` si `branch: null`).
- Modale **Confirmer ta sélection** : charte sky, **total** mis en avant.

**Demande validée** (`confirmed` / `processing` / `treated` — cartes actives) — **`patient-product-request-actions.tsx`** :
- En-tête **`PatientProductRequestDossierHeader`** (shell sky/teal) à la place du récap envoyée.
- Carte **`PatientValidatedCompactLineCard`** : photo ~62px, nom 1 ligne, **Historique** + **`PatientLineNotesIconButton`** (si notes ligne), **PU / Tot** indicatif, **qté validée** lecture seule.
- **Bandeau libellés** sous la carte : **`lib/patient-validated-line-labels-fr.ts`** (`buildPatientValidatedLineLabelsFr`) — **origine** (Ta demande, Alternative, Ajout Officine, ordonnance…) + **un** statut préparation (À réserver, Réservé, À commander, Commandé, Reçu en officine, Récupéré) + **événements** officine (Modifié / Ajouté / Écarté) **sans redondance** avec l’origine.
- **Retiré** sur la carte : pastilles **disponibilité**, bandeau suivi ligne, badges amendements dupliqués dans le corps.
- Listes groupées : **À réserver** / **À commander** ; amber hors périmètre & écarts ; **`<details>`** sky pour lignes **non retenues** (fermé par défaut).

**Fiche publique Services** (`d108e33`) — **`pharmacy-public-profile.tsx`** : plus de grille Appeler/WhatsApp/Itinéraire en tête onglet Services ; intro épurée.

**Lint CI** (`aec3071`) — **`patient-line-notes-icon-button.tsx`** : hooks toujours exécutés (`hasNotes` avant `return null`) ; nettoyage imports morts dans **`patient-product-request-actions.tsx`**.

**Phrase de reprise** : **§13.32**.

**Prochain jalon documenté (§4.6)** : affiner UI patient **traitée** + dossiers **terminés** (lecture seule) si retours ; puis **pharmacien** — **envoyée** puis **répondue**.

**QA** : `responded` (principal, alternative groupée, ajout officine, indispo Ban, qty recochage) → validation → `confirmed` (libellés origine/statut/écarté, notes, pas de dispo sur carte).

---

### Session 2026-05-25 (suite) — Patient validée + traitée (UI/UX)

**Branche** : `fix/validated-supply-ecart-ui-modal` — commits **`48fa47c`** … **`449debd`** (lot UI patient ; pas de nouvelle migration sur ce sous-lot sauf **`20260625_001`** déjà documentée pour revalidation patient).

**Demande validée** (`confirmed`) — **`patient-product-request-actions.tsx`** :
- Contours blocs **À réserver** en **sky** (alignement charte demande produits).
- Bandeau amendements dans **`PatientProductRequestDossierHeader`** (**Modifiée** + modale **Résumé** via **`lib/patient-pharma-amendment-resume-fr.ts`**) — commit **`1330407`** ; ancien **`PatientPharmaUpdateBanner`** standalone retiré.
- **Modifier ma validation** : bouton au-dessus d’**Abandonner** ; en édition, **Annuler** / **Enregistrer les modifications** en pied fixe **ambre** (à la place de « Mettre à jour ma date de passage »).
- RPC **`patient_update_confirmation`** ; verrou optimiste **`p_expected_updated_at`** (**`20260625_001`**).

**Demande traitée** (`treated`) — même fichier + **`lib/patient-validated-line-labels-fr.ts`** + **`lib/datetime-fr.ts`** (`patientPlannedVisitPassageLineFr`) :
- Deux blocs : **Produits réservés pour vous et en attente de votre passage** · **Produits commandés pour vous** (sous-totaux + total pied de page).
- **Votre passage est prévu le … à …** : ligne sous l’**en-tête dossier** (après bandeau amendements si présent).
- Pastilles ligne **traitée** : pas de « Réservé » / « Commandé » / « À réserver » / « À commander » ; **Réception prévue** (pastille teal/cyan) ; **Reçu en officine** (pastille émeraude) ; masquer **Réception prévue** si **`post_confirm_fulfillment = arrived_reserved`**.
- Sections **non retenues** et **écarts** conservées en **`<details>`**.

**Répondue** (correctif même lot) : groupes **`lib/patient-responded-line-buckets.ts`** ; badges Ta demande/Alternative retirés du titre.

**Lint CI** (`449debd`) : `useMemo` passage traitée déplacé **avant** le `return null` anticipé (`react-hooks/rules-of-hooks`).

**Phrase de reprise** : **§13.33**.

**Prochain jalon** : dossiers **terminés** (lecture seule) si retours ; **pharmacien** envoyée / répondue (§4.6).

---

### Session 2026-05-19 (annuaire + fiche publique UI) — Cohérence parcours patient officine

**Branche** : `fix/validated-supply-ecart-ui-modal` — commits poussés **`264f7e6`**, **`2ae5d22`**, **`194443c`**, **`d500301`** (après rebase sur remote).

**Pas de nouvelle migration** sur ce lot.

**Annuaire** (`components/annuaire/`, `/`) :
- Hero image **`public/brand/annuaire-hero.png`**, header compact, compteur sous bandeau
- Cartes : partage, nom + **`public_ref`**, **avis** (`rating_avg` / `rating_count`) sur la couverture
- Menu **Rayon** : portail `fixed` `z-[200]` (plus de clipping scroll) ; libellés **max** colorés ; position au clic (ESLint **`react-hooks/set-state-in-effect`**)

**Chrome public partagé** :
- **`components/pharmacy/pharmacy-public-chrome.tsx`** — `pharmacyPublicCard`, `PharmacyPublicBackLink`, `PharmacyFlowHero`, `PharmacyPublicSectionTitle`, `PharmacyPublicInfoBlock`, `PharmacyPublicEmptyState`
- **`components/pharmacy/pharmacy-request-service-links.tsx`** — liens Services (produits / ordonnance / consultation)

**Fiche digitale** (`components/pharmacy/pharmacy-public-profile.tsx`, **`/pharmacie/[id]`**) :
- Onglet **Services** : grille **Appeler / WhatsApp / Itinéraire** (comme cartes annuaire) + cartes demande avec description
- Onglet **Offres** : **`public-promo-offers.tsx`** — cartes alignées, CTA **primary**, intro + état vide
- Onglet **Horaires** : intro + encart **Aujourd’hui** + liste 7 jours en carte unique
- Onglet **Infos** : blocs **Adresse / Contact / Note / Titulaire / Services** ; message bienvenue
- **`pharmacy-rating-form.tsx`**, **`pharmacy-profile-contact-grid.tsx`** — même gabarit cartes

**Demande produits patient** :
- **`app/pharmacie/[id]/demande-produits/page.tsx`** + **`catalogue/page.tsx`** — hero émeraude, cartes `pharmacyPublicCard`, totaux **primary** (fini thème bleu ciel dominant)
- Retour **← Fiche officine** harmonisé

**Lint CI** : **0 erreur** sur le lot annuaire rayon (warnings `<img>` inchangés).

**Phrase de reprise** : **§13.31**.

**QA mobile** : annuaire (rayon, avis) → fiche (4 onglets) → demande produits → catalogue → envoi.

---

### Session 2026-05-24 — Onboarding admin, ma-fiche pharmacien, reset pilote, auth SMS oublié

**Branche** : `fix/validated-supply-ecart-ui-modal`.

**Migrations** (**appliquées** sur Supabase pilote) :
- **`20260620_001_fix_pharmacist_profile_analytics_journal_cte.sql`**
- **`20260621_001_pharmacies_statut_check_align.sql`** (`ouverte` | `fermee` | `garde`)
- **`20260622_001_pharmacy_titular_public.sql`** — colonne **`pharmacies.titular_public`** + backfill **`titular_name`** depuis profil propriétaire

**Onboarding admin → officine + pharmacien** :
- API **`POST /api/admin/onboard-pharmacy`** — **`lib/admin-onboard-pharmacy-server.ts`**, **`components/admin/AdminOnboardPharmacyForm.tsx`**
- Crée Auth (tél. + MDP provisoire), **`profiles`** (upsert), **`pharmacies`**, **`pharmacy_staff`** ; **`titular_name`** / **`titular_public`** à la création
- Première connexion pharmacien : MDP obligatoire — **`app/auth/page.tsx`** + **`lib/provisioned-pharmacist-auth.ts`**
- Coords GPS Maroc admin : **`lib/pharmacy-coords-morocco.ts`**, **`AdminPharmacyCoordsFields.tsx`**
- Navigation patient : **`components/pharmacy/pharmacy-navigation-picker.tsx`**

**Ma fiche pharmacien** (`/dashboard/pharmacien/ma-fiche`) :
- Onglet **Coordonnées** : nom, adresse, ville, tél., WhatsApp (éditables)
- Onglet **Accueil** : titulaire prérempli (officine ou profil owner), toggle **Visible / Masqué** (`titular_public`)
- Fiche publique : titulaire affiché seulement si **`titular_public`** et nom renseigné

**Auth — mot de passe oublié** :
- **Téléphone** : OTP SMS (`signInWithOtp` + `verifyOtp` + `updateUser`) — **`lib/auth-phone-password-reset.ts`**, **`app/auth/page.tsx`**
- **E-mail** : lien inchangé — **`/api/auth/request-password-reset`**

**Reset pilote** :
- Script **`supabase/scripts/reset-pilot-keep-products-single-admin.sql`** (sans table temp `_reset_keep_admin` ; exécuter **tout** le fichier — modale Supabase « Run without RLS »)
- **État pilote (fin session)** : reset SQL **effectué** (1 admin conservé) ; reset Storage **effectué** (garde `products/`) ; **tests ma-fiche / onboarding** faits ; **création officine finale + MDP oublié SMS** à valider au prochain passage
- **Horaires fiche publique** (commit **`0c4f0e7`**) : aujourd’hui + 6 jours, noms de jours complets
- **Référence stable** : tag Git **`pilote-stable-2026-05-24`** → commit **`0c4f0e7`** — voir **§10.1**

**Phrase de reprise** : **§13.30**.

---

### Session 2026-05-19 (pricing officine) — Moteur de pricing pharmacien

**Branche** : `fix/validated-supply-ecart-ui-modal` — commit poussé **`f7361ff`** (rebase sur remote).

**Migration** (**appliquée** sur Supabase pilote) :
- **`20260619_001_pharmacy_pricing_engine.sql`** — tables **`pharmacy_pricing_settings`**, **`pharmacy_pricing_laboratory_rules`**, **`pharmacy_pricing_product_overrides`** ; RPC **`pharmacist_pricing_config_get`** / **`pharmacist_pricing_config_save`**, **`pharmacist_pricing_distinct_laboratories`**, **`pharmacy_pricing_config_public_get`** (parcours patient), **`resolve_pharmacy_product_unit_price`** ; backfill **`price_ppv`** médicaments si manquant.

**Règles métier** :
- **Médicaments** : toujours **PPV** catalogue (`products.price_ppv`) — **non paramétrable** dans l’UI pricing.
- **Parapharmacie** : PPH + marge **−10 % à +40 %** (global, par laboratoire, ou par produit) ; priorité **produit > laboratoire > global**.
- **Source de vérité affichage** : grille officine (plus le PPH brut catalogue) sur demandes produits, ordonnances, promos, panier patient.
- **Patient** : libellés **Prix / PU** uniquement (jamais « PPH » / « PPH +10 % »).

**UI pharmacien** :
- **`/dashboard/pharmacien/pricing`** — **`components/pharmacist/pricing/pharmacist-pricing-manager.tsx`** (onglets Général / Laboratoires / Produits).
- Menu profil : **Moteur de pricing** (`platform-header.tsx`).

**Code** :
- **`lib/pharmacy-pricing/`** — résolution (`resolve.ts`), hooks (`use-pharmacy-pricing.ts`), API RPC.
- **`lib/product-price.ts`** — **`formatPharmacyCatalogPrice`** / **`formatPharmacyLinePrice`**.
- Intégration : **`demande-produits`** + catalogue, **`patient-product-request-actions`**, **`pharmacien/demandes/[id]`**, promos (`lib/promo/pricing.ts`), modal ordonnance.

**Lint CI** : correctifs **`react-hooks/set-state-in-effect`** (annuaire pagination, hooks pricing) — warnings restants non bloquants.

**Phrase de reprise** : **§13.29**.

**QA pilote** : configurer une grille sur **`/dashboard/pharmacien/pricing`** → vérifier PU patient (nouvelle demande produits) et PU indicatif pharmacien à la réponse ; modifier la grille et recontrôler les **nouveaux** parcours (lignes déjà répondues gardent le **`unit_price`** enregistré).

---

### Session 2026-05-19 (promo + horaires) — Packs promo, horaires mobile, cloche notifs

**Branche** : `fix/validated-supply-ecart-ui-modal` — commits poussés **`1499e7e`**, **`5859ab8`**, **`71acf25`**.

**Migration** (à appliquer sur Supabase pilote si pas encore fait) :
- **`20260610_001_promo_offers_reservations.sql`** — tables **`pharmacy_promo_offers`**, **`pharmacy_promo_offer_lines`**, **`pharmacy_promo_reservations`**, historique statuts, refs **`P042/26`**, **`promo_in_app_notifications`** ; RLS + RPC (`patient_submit_promo_reservation`, `pharmacist_confirm_promo_reservation`, `pharmacist_decline_promo_reservation`, `pharmacist_mark_promo_reservation_collected`, `cancel_promo_reservation`). **Prérequis** : jusqu’à **`20260609_001`** (Storage cover/logo versionnés).

**Packs promo (workflow séparé des demandes)** :
- Pharmacien : **`components/promo/pharmacy-promo-offers-manager.tsx`** — **`/dashboard/pharmacien/offres-promos`** ; **`/dashboard/pharmacien/reservations-packs`** (hub **tableau de bord + liste** + détail actions RPC).
- Public : **`components/promo/public-promo-offers.tsx`** + **`promo-reserve-modal.tsx`** — onglet Offres **`pharmacy-public-profile.tsx`** (remplace stub).
- Patient : **`/dashboard/patient/packs-promo`** — hub **tableau de bord + liste** (`?vue=dashboard|liste`, tuiles 5 statuts, cartes hub, filtres pharmacie/réf./tri) + détail ; annulation si `submitted` / `confirmed`.
- Libs : **`lib/promo/`** (`save-offer.ts`, `dates.ts`, `pricing.ts`, `reservation-hub-buckets.ts`, `reservation-status-ui.ts`, `reservation-copy-fr.ts`, …).
- Header : **`platform-header.tsx`** — cloche = **`app_notifications`** + **`promo_in_app_notifications`** (compteur + liste fusionnés, liens détail pack).

**Horaires pharmacien** (commit **`1499e7e`**, fix mobile **`71acf25`**) :
- **`horaires-garde`** : onglet **Horaires** — 7 jours compacts (`pharmacy-weekly-hours-tab.tsx`, `pharmacy-compact-time-range.tsx`) ; **Exceptions** — fériés Maroc automatiques (`lib/morocco-public-holidays.ts`), plus de type « jour férié » manuel ; **Garde** — fin auto (`lib/pharmacy-on-call-compute.ts`).
- **Fix mobile** : grille Matin / Après-midi (après-midi n’était plus en colonne étroite) ; teintes discrètes par jour ; label **Après-midi**.
- **`ma-fiche`** : refonte onglets Accueil / Photos / Liens / Services.
- Script reset horaires : **`supabase/scripts/reset-pharmacy-schedules.sql`**.

**Menus** : patient **Mes packs promo** ; pharmacien **Réservations packs** (`platform-header.tsx`).

**Phrase de reprise** : **§13.28**.

**Lint CI** : corriger toute **erreur** `react-hooks/set-state-in-effect` (pas seulement les warnings) — modales : sous-composant + `key`, pas `setState` dans `useEffect` pour reset.

---

### Session 2026-05-22 — Fiche digitale (Infos/Horaires/notes), upload photos versionné, supply post-validé

**Branche** : `fix/validated-supply-ecart-ui-modal` — commits poussés **`0094611`**, **`9862128`**, **`60c543b`**.

**Migration** (à appliquer sur Supabase pilote si pas encore fait) :
- **`20260608_001_pharmacy_ratings.sql`** — table **`pharmacy_ratings`** (1 note 1–5 par compte et officine, **sans commentaire** au pilote), agrégats **`pharmacies.rating_avg`** / **`rating_count`**, RPC **`submit_pharmacy_rating`**.
- **`20260609_001_storage_pharmacy_versioned_media_paths.sql`** — **à appliquer** si upload couverture/logo échoue en RLS : autorise `cover-{ms}.webp` / `logo-{ms}.webp` (policy **`20260528_001`** n’acceptait que `cover` / `logo` exacts).

**Fiche digitale publique** (`components/pharmacy/pharmacy-public-profile.tsx`, commit **`9862128`**) :
- Onglets **grille 4 colonnes** (plus d’espace vide à droite).
- Onglet **Infos** : grille contacts (`pharmacy-profile-contact-grid.tsx` — icônes **`Share2`** / **`ExternalLink`** pour Facebook/Instagram, absents de `lucide-react` 1.11), bloc adresse, titulaire, services.
- Onglet **Horaires** : encart **Aujourd’hui** + semaine en liste avec badges (ouvert / fermé / garde / exception). Styles fermé : **`lib/pharmacy-open-status-ui.ts`** (rouge uniforme — voir journal §10 session **2026-05-25 suite 4**).
- **Notes patients** : `PharmacyRatingForm` — pilote **sans commentaire** ; après vote = ligne compacte **« Votre note »** + **Modifier** ; enregistrement au clic étoile.

**Upload photos officine** (commit **`9862128`**, corrige retour à l’ancienne image) :
- Chemins Storage **horodatés** : `pharmacies/{id}/cover-{ms}.webp` | `logo-{ms}.webp` (**`lib/storage-media.ts`** `pharmacyImageObjectPath`) ; suppression de l’ancien fichier au remplacement (**`lib/pharmacy-media.ts`**).
- Aperçu local pendant l’envoi + anti-cache URL ; **`ma-fiche`** persiste la colonne après upload.
- **RLS** : appliquer **`20260609_001`** sur Supabase (sinon erreur « row-level security » : policy n’acceptait que `cover.webp` / `logo.webp` fixes).

**Supply pharmacien post-validé** (commit **`0094611`**, `app/dashboard/pharmacien/demandes/[id]/page.tsx`) :
- **Qté validée** : brouillon aligné `selected_qty` / `available_qty` ; plus d’écrasement au `load()` en `confirmed`/`treated` ; amendement **`validated_qty_change`**.
- **Ajout produit après validation** : brouillon (`pendingProposalRows`) + canal patient ; qté/dispo saisies avant ajout ; flush à **Enregistrer les modifications**.

**Build** (commit **`60c543b`**) : remplacement icônes Facebook/Instagram inexistantes dans lucide (échec Turbopack/Vercel).

**Phrase de reprise** : **§13.28**.

---

### Session 2026-05-19 (suite) — Fiche digitale, upload photos officine

**Branche** : `fix/validated-supply-ecart-ui-modal` — commits poussés **`b846a8c`**, **`a4a3b8a`**.

**Migrations** (ordre `YYYYMMDD_*`, à appliquer sur Supabase pilote si pas encore fait) :
- **`20260606_001_pharmacy_digital_profile.sql`** — profil `pharmacies`, catalogue services, horaires hebdo Maroc, exceptions, gardes, seed horaires à la création.
- **`20260607_001_lock_line_notes_after_validation.sql`** — notes ligne figées après `confirmed` (trigger) ; conversation dossier inchangée.

**Fiche digitale** :
- Publique **`/pharmacie/[id]`** — `components/pharmacy/pharmacy-public-profile.tsx` (couverture, logo, onglets Services / Offres stub / Horaires / Informations).
- Pharmacien **`/dashboard/pharmacien/ma-fiche`** (texte, services, liens) + **`/dashboard/pharmacien/horaires-garde`**.
- **`lib/pharmacy-schedule-fr.ts`**, **`lib/pharmacy-profile-types.ts`**, **`lib/pharmacy-staff-context.ts`**.

**Photos officine** (commit **`a4a3b8a`**, chemins versionnés depuis **`9862128`**) :
- Upload **couverture** + **logo** depuis **Ma fiche** (`components/pharmacy/pharmacy-image-upload-field.tsx`, **`lib/pharmacy-media.ts`**).
- Storage **`public-assets`** : `pharmacies/{id}/cover-{timestamp}.webp` | `logo-{timestamp}.webp` (spec **`lib/pharmacy-cover-spec.ts`** : ratio **21:9**, 1920×823 px ; policies **`20260524_001`**).
- Colonnes **`cover_image_path`** + **`logo_url`** ; enregistrement auto après upload.

**Notes produit** (commit **`b846a8c`**) : **`lib/request-line-notes-policy.ts`** ; modal pharmacien lecture seule en `confirmed`|`treated` ; supply n’écrase plus les commentaires.

**Phrase de reprise** : **§13.28** (voir session **2026-05-22** pour le détail récent).

---

### Session 2026-05-19 — Notes produit figées après validation

**Règle produit** (3 parcours) : notes patient / officine par ligne **une fenêtre d’édition** puis lecture seule ; **conversation dossier** inchangée.

**Code** : `lib/request-line-notes-policy.ts` ; fiche pharmacien `canEditLineProductNotes` (plus d’édition modal en `confirmed`|`treated`) ; sauvegarde supply conserve les commentaires persistés ; libellé modal « Notes figées… ».

**Migration** `supabase/migrations/20260607_001_lock_line_notes_after_validation.sql` — trigger `BEFORE UPDATE` sur `request_items` / `request_item_alternatives`.

---

### Session 2026-06-04 — Retours test (badges, notifs, consultation, catalogue)

**Branche** : `fix/validated-supply-ecart-ui-modal` — commit groupé (voir hash après push).

**SQL** : **`20260604_001_patient_notify_validated_request_updated.sql`** — restaure notif patient **« Demande validée mise à jour »** (amendements / ajustements post-validation) complémentaire à **`20260603_001`** ; **à appliquer** sur Supabase pilote si pas encore fait.

**Consultation libre** :
- **Recherche catalogue** pharmacien : `propCatalogSearchActive` inclut `free_consultation` (formulaire visible sans `propOpen` → recherche ne partait plus).
- **Patient** : en-tête dossier + **`PatientSentEnvoyeeSummaryCard`** en tête ; brief + conversation ; **`summaryInPageChrome`** ; conversation sans rechargement tremblant (`onMarkedRead` stable, `key` sans `conversationMessageCount`).
- **Pharmacien** : bandeau violet « Consultation reçue » ; aide saisie produits.

**Ordonnance** :
- Badges **Ordonnance** / **Proposé** (principal scan vs complément) ; **`PRESCRIPTION_ADDITIONAL_PROPOSED_REASON`** sur compléments ; patient sans double scan en clôturé.
- Post-validé : badge **« Ajouté après validation »** via **`request_supply_amendments`** (`buildLineAddedAfterConfirmAmendment`, RPC à l’insert) ; **`lib/pharmacist-request-catalog-product-block.ts`** (anti-doublon catalogue).

**Supply traité** : **`RequestLineSuiviStrip`** sur lignes retenues ; pastilles fulfillment masquées en `treated`.

**Fichiers clés** : `app/dashboard/pharmacien/demandes/[id]/page.tsx`, `app/dashboard/demandes/[id]/page.tsx`, `lib/supply-line-post-confirm.ts`, `lib/patient-line-proposed-badge.ts`, `components/requests/request-conversation-inline.tsx`, `components/requests/shared/request-line-suivi-strip.tsx`.

**Phrase de reprise** : **§13.28** (voir aussi **§13.26** pour le lot consultation/ordonnance juin).

---

### Session 2026-06-03 (suite UI) — Consultation scroll, qtés patient, dispo ordonnance, alternatives

**Branche** : `fix/validated-supply-ecart-ui-modal` — commits **`dd06fe3`**, **`7286128`** (poussés).

**Infra** : migrations **`20260601_001`**, **`20260602_001`**, **`20260603_001`** — **toutes appliquées** sur Supabase pilote (ne pas réappliquer sauf nouvelle migration).

**Consultation libre** :
- **Suppression** header sticky + onglets Conversation / Produits : **une seule page scroll** (brief + messagerie inline + lignes), comme demande produits / ordonnance.
- Composants **`consultation-detail-sticky-chrome`** / **`consultation-detail-tab-bar`** : **non utilisés** (fichiers conservés).

**Quantités — patient (`responded`)** :
- Libellé **« Proposé X »** (ligne principale + alternatives) = **`available_qty`** saisie par la pharmacie.
- Plafond stepper patient = offre officine ; le patient peut **diminuer**, pas dépasser.
- **Alternatives** : correction **`maxQtyAlt`** (plus de plafond erroné à `min(requested_qty, alt.available_qty)` sur ligne proposée consultation).

**Quantités — post-validation** :
- Cartes patient : **`selected_qty`** (choix validé) ; ajustement pharmacien avec accord → **`selected_qty`** recalculée `min(qté validée, nouvelle qté officine)` à l’enregistrement (**`saveConfirmedAdjustmentsCore`**).

**Disponibilités** :
- **`lib/pharmacist-availability.ts`** : **`pharmacistAvailabilityOptionsForLine`** — **ordonnance** (saisie scan + modal) = **Indisponible** / **Rupture** / etc. ; **consultation libre** + **ajout officine** demande produits = **Disponible** / **À commander** seulement.
- Modal **`PharmacistOrdonnanceQuickAddModal`** : liste complète **`PHARMACIST_AVAILABILITY_OPTIONS`**.

**Fichiers clés** : `app/dashboard/demandes/[id]/page.tsx`, `app/dashboard/pharmacien/demandes/[id]/page.tsx`, `components/requests/product/patient-product-request-actions.tsx`, `lib/patient-confirmed-line-buckets.ts`, `lib/pharmacist-availability.ts`, `lib/build-patient-line-timeline-fr.ts`.

**Phrase de reprise** : **§13.26**.

---

### Session 2026-06-01 — Lot demandes produits (commité) + ordonnance = demande produits (local, à committer)

**Branche** : `fix/validated-supply-ecart-ui-modal`.

**Demande produits — commit `aec8fad` (poussé)** :
- Style page saisie **`/pharmacie/[id]/demande-produits`** ; notes patient alignées conversation.
- Ordre stable lignes pharmacien post-validé (**`lib/pharmacist-supply-list-order.ts`**).
- Footer **Clôturer** + modal récap (**`components/pharmacist/pharmacist-close-request-confirm-modal.tsx`**).
- Patient : retrait gros bandeau clôture, libellés **`confirmed`/`treated`** (réservé/commandé), cartes compactes inchangées.
- **SQL** **`20260601_001_product_request_notifs_ui.sql`** : notifs patient traitée, amendements post-validation, passage modifié, réception en officine — **à appliquer sur Supabase** avant test notifs.

**Ordonnance — lot aligné demande produits (modifs locales, retours terrain en attente)** :
- Après réponse pharmacien : **même parcours** que demande produits (validation, validé, traité, comptoir) ; nomenclature **Ordonnance** / **Saisi ordonnance** (plus « demande initiale » / motif scan).
- Lignes saisies depuis le scan : **`line_source = patient_request`** (sans `pharmacist_proposal_reason`) — équivalent saisie patient ; legacy **`pharmacist_proposed` + motif « Saisie depuis ordonnance »** toujours reconnu.
- Compléments hors ordonnance : **`pharmacist_proposed`** + motif (comme ajout officine produits).
- **Qté prescrite** = qté demandée ; mêmes mécanismes dispo / alternatives / post-validé.
- **UI** : scan **`PrescriptionScanCollapsible`** (produits d’abord, scan replié) ; modal **`PharmacistOrdonnanceQuickAddModal`** ; identité **ambre** (header par statut, hubs `confirmed`/`treated`, blocs validés patient).
- Fichiers clés : **`lib/prescription-pharmacist-lines.ts`**, **`lib/prescription-patient-labels.ts`**, **`components/requests/prescription/prescription-scan-collapsible.tsx`**, **`app/dashboard/pharmacien/demandes/[id]/page.tsx`**, **`components/requests/product/patient-product-request-actions.tsx`**, **`lib/request-kinds/prescription.config.ts`**, **`components/requests/demande-hub-ui.tsx`**.

**Prochaine étape** : retours utilisateur sur **demandes produits** → corrections → **commit + push** ; puis QA ordonnance + migration **`20260601_001`**.

**Phrase de reprise** : **§13.23**.

---

### Session 2026-05-17 (suite 2) — Retours ordonnance + header consultation sticky

**Branche** : `fix/validated-supply-ecart-ui-modal` — commits **`b086521`**, **`46e68c7`** (poussés).

**Ordonnance — retours terrain (lot 2)** :
- **Rupture / indispo** : qté dispo **0** à l’ajout et au brouillon (`ordonnanceInsertAvailableQty`, plus de repli sur qté prescrite).
- **Produits proposés** (complémentaires) : une seule **qté proposée** (pas de qté prescrite) ; badge **Proposé** (config `pharmacistProposedBadge`).
- **Enregistrement post-validé** : modal sans faux écarts sur ligne principale quand **alternative retenue** (`supplyRowPersistedSupplyFields` ; comparaison branche alternative).
- **Badges** : **Ordonnance** / **Ordonnance + alternative** / **Proposé** (complémentaires uniquement pour **Proposé** ; voir session **2026-06-01** pour saisie scan en `patient_request`).
- **Lot 1** (`b086521`) : notif pharmacien si patient modifie ordonnance (`20260531_001`), modal publication pharma, libellés patient, historique voix patient.

**Consultation libre** (historique — **remplacé** session **2026-06-03 suite UI**) :
- Ancien : header sticky + onglets Conversation / Produits → **retiré** ; détail = scroll unique comme les autres parcours.

**Demande produits** :
- Migration **`20260531_002`** : notification pharmacien dédiée quand le patient modifie sa **date de passage** (`confirmed` / `treated`).

**Fichiers clés** : `lib/prescription-ordonnance-line-qty.ts`, `lib/prescription-patient-labels.ts`, `app/dashboard/pharmacien/demandes/[id]/page.tsx`, `app/dashboard/demandes/[id]/page.tsx`, `components/requests/consultation/consultation-detail-sticky-chrome.tsx`, `components/requests/product/patient-product-request-actions.tsx`.

**Prod / QA** : migrations **`20260529_001`**, **`20260530_001`**, **`20260531_001`**, **`20260531_002`** si pas déjà appliquées ; déployer front ; checklist **`docs/workflow-ordonnance-consultation-REPONSES.md`** §D.

---

### Session 2026-05-17 (suite) — Consultation libre : onglets, publication, parcours patient

**Branche** : `fix/validated-supply-ecart-ui-modal`.

**Consultation libre — restructuration livrée** :
- **2 onglets** détail patient + pharmacien : **Conversation** (brief + messagerie inline) | **Produits proposés** (saisie / validation).
- **Onglet par défaut** : Conversation tant que non `responded` ; ensuite Produits. Pastille non-lu sur Conversation.
- **FAB conversation supprimée** pour `free_consultation` → `RequestConversationInline` + `ConsultationDetailTabBar`.
- **Publication** : `publishResponse` étendu à `free_consultation` ; dispos **Disponible** / **À commander** uniquement ; date obligatoire si à commander.
- **Patient** : plus d’éditeur catalogue avant réponse ; après `responded` = workflow demande produits (principal / alternative / aucun) ; badges **Proposition pharmacie**.
- Fichiers clés : `lib/consultation-detail-tabs.ts`, `components/requests/consultation/*`, `request-conversation-inline.tsx`, détails `demandes/[id]`.

**Rappel ordonnance + auth** (commits précédents sur la branche) : parcours ordonnance ambre, `lib/auth-site-url.ts`, `/auth/callback`, `RUNBOOK.md` §2b, lint footer ordonnance (`onFooterStateChange`).

**QA terrain** : checklist **`docs/workflow-ordonnance-consultation-REPONSES.md`** §D ; migrations **`20260529_001`** (+ **`20260530_001`** ordonnance patient si pas fait).

---

### Session 2026-05-17 — Finalisation UX ordonnance + consultation libre (retours terrain)

**Branche** : `fix/validated-supply-ecart-ui-modal` (commits dont **`0fc70d0`** ordonnance qté prescrite/dispo).

**Ordonnance — retours intégrés** :
- Modal **`PharmacistOrdonnanceQuickAddModal`** : recherche catalogue ; **ne pas fermer** au clic produit ; bouton **Ajouter** ; **qté prescrite** + **qté dispo** (dispo ≤ prescrit, partiel / indispo / à commander comme demande produits).
- Lignes liste pharmacien : édition des deux quantités ; plafond dispo = prescrit ; badge **Ordonnance** (plus « Proposé ») — config + patient + modal confirmation envoi.
- **`lib/prescription-ordonnance-line-qty.ts`** : logique partagée modal / fiche ligne.
- Séparation stricte **produits ordonnance** (ambre) vs **ajout officine** (violet, uniquement `product_request`).

**Consultation libre** :
- Migration **`20260529_001`** : photos (3 slots), RPC submit/attach, workflow lignes, Storage `consultations/`.
- **`ConsultationBriefPanel`** : texte + photos éditables avant réponse ; lightbox ; ESLint `set-state-in-effect` corrigé.
- Hubs patient/pharmacien violet ; création **`/pharmacie/[id]/consultation-libre`** ; détail complet (`workflowEnabled: true`).

**Documentation** : **`docs/workflow-ordonnance-consultation-REPONSES.md`** (synthèse retours + checklist QA).

**Prod / QA** : appliquer **`20260529_001`** si pas fait ; smoke test ordonnance + consultation + non-régression demande produits ; cocher checklist §D du doc retours.

---

### Session 2026-05-25 — Refactor `request-kinds` (phase 1) + workflow ordonnances (phase 2)

**Branche** : `fix/validated-supply-ecart-ui-modal` (commit à pousser après cette session).

**Phase 1 — architecture types de demande** :
- **`lib/request-kinds/`** : registre `product_request` / `prescription` / `free_consultation` (thème, routes hubs, capacités, refs **D/O/C**).
- UI partagée : **`components/requests/shared/`** (`request-kind-header`, `request-detail-back-link`, `request-type-stub-panel`).
- Module produits extrait : **`components/requests/product/patient-product-request-actions.tsx`** (réexport depuis l’ancien chemin détail patient).
- Détail patient/pharmacien : routage par `getRequestKindConfig` ; stub si `workflowEnabled: false` (consultation libre activée ensuite — session **2026-05-17**).

**Phase 2 — ordonnances** :
- Migrations **`20260525_001`** (compteurs refs **O** par type) · **`20260525_002`** (`page_2_path`, image nullable) · **`20260525_003`** (`_request_uses_product_line_workflow`) · **`20260525_004`** (RPC annulation / supply / traité élargies aux ordonnances).
- **`lib/prescription-media.ts`** : upload/compression WebP, URLs signées Storage `ordonnances/{request_id}/…`.
- Capture patient : **`/pharmacie/[id]/demande-ordonnance`** (1–2 photos, message optionnel) ; CTA fiche pharmacie.
- Détail patient : panneau attente **`PatientPrescriptionRequestPanel`** (`submitted`/`in_review`) ; dès **`responded+`** → même workflow lignes que produits + messagerie.
- Détail pharmacien : **`PrescriptionImageViewer`**, saisie 100 % officine (`pharmacist_proposed`, motif défaut « Saisie depuis ordonnance »), publication réponse + post-validé partagés.
- Correctif brouillon catalogue : retour **`demande-produits/catalogue`** en édition ne perd plus les lignes (`lib/patient-demande-produits-draft.ts`).

**Prod / QA** : appliquer **`20260525_*`** sur Supabase avant E2E ; smoke test **produits** inchangé + parcours **ordonnance** complet (envoi → saisie pharma → réponse → validation patient).

---

### Session 2026-05-24 — Catalogue patient, photos Storage, ESLint CI

**Branche** : `fix/validated-supply-ecart-ui-modal` (commits **`bbe686b`**, **`4ed2cf9`** + correctifs lint).

**Infra catalogue & photos** :
- Migrations **`20260524_001`** (buckets **`public-assets`** / **`private-media`**) · **`20260524_002`** (colonnes media pharmacies) · **`20260524_003`** (catalogue pilote ~31 produits MAROC, chemins `products/{uuid}/main.jpg`).
- **`lib/storage-media.ts`** : **`resolvePublicMediaUrl`**, **`mapRequestItemsPhotos`** (join `products.photo_url` → URL publique Supabase).
- Scripts : **`scripts/attach-catalog-images.mjs`**, **`scripts/reset-pilot-catalog.mjs`**, **`supabase/scripts/reset-pilot-catalog.sql`** ; doc **`catalog/LISTE_PHOTOS.md`**.

**UI patient — saisie & modification** :
- **`/pharmacie/[id]/demande-produits`** + **`/demande-produits/catalogue`** : explorateur multi-sélection (**`ProductCatalogExplorerToolbar`** : recherche + type + marque modale ; liste plein écran scrollable ; scroll infini 60/lot via **`useProductCatalogExplorer`**), produits déjà en panier / dossier grisés ; brouillon **`sessionStorage`** (`lib/patient-demande-produits-draft.ts`, **`lib/product-catalog-filters.ts`**).
- **`PatientProductRequestActions`** : même lien catalogue en **mode modification** demande **`submitted`/`in_review`** (`?requestId=` + retour dossier) ; vignettes corrigées après envoi et sur tout le détail demande.
- **`next.config.ts`** : domaine **`*.supabase.co`** pour images.

**CI** : ESLint **`react-hooks/set-state-in-effect`** / **`preserve-manual-memoization`** — resync brouillon / lignes resubmit par **réinit. en rendu** (pattern **`visitSyncKey`**) ; panier catalogue en **`useMemo`** ; handlers catalogue sans **`useCallback`** superflu.

**Prod** : merger vers **`main`** + déployer Vercel pour vignettes catalogue ; appliquer migrations **`20260524_*`** sur le projet Supabase de prod si pas déjà fait.

---

### Session 2026-05-17 — Notes produit pharmacien, auth OTP, doublons Auth

**Branche** : `fix/validated-supply-ecart-ui-modal` (commit **`06a4413`**).

**UI pharmacien — note / échange par ligne** :
- Le raccourci **OK** n’insère plus la chaîne `"OK"` dans **`request_items.pharmacist_comment`** (visible patient comme message officine).
- Modal **`PharmacistLineConversationModal`** (`components/pharmacist/pharmacist-line-conversation-chip.tsx`) : bouton **Confirmer la note** — valide le texte saisi (désactivé si vide), ferme la fenêtre ; publication au patient toujours via **envoi de la réponse** dossier.
- **`PharmacistLineReactControl`** aligné (libellés « Note produit » / « Confirmer la note »).

**Auth patient** :
- **Renvoi OTP** inscription : `signInWithOtp` avec **`shouldCreateUser: false`** (`app/auth/page.tsx`) pour limiter un 2ᵉ `auth.users` pendant le même parcours.
- **Pilote** : OTP inscription peut arriver par **WhatsApp** (Twilio Verify / config Supabase Phone) et non par SMS ; numéro **pro** souvent **Failed** côté Twilio SMS Verify (MDM / filtrage opérateur) — tester avec **06/07 perso** ; notifs métier restent **SMS Messages** (`TWILIO_SMS_FROM`), pas WhatsApp worker.
- **Doublons** constatés (même `+212…`, 2 UID) avant garde **`20260522_003`** : en pilote → supprimer comptes Auth + reset demandes (`clear-all-requests`) puis nouvelle inscription.

**Infra** : pas de nouvelle migration sur ce lot.

---

### Session 2026-05-22 — SMS pilote patient, expiration 24 h, garde inscription

**Branche** : `fix/validated-supply-ecart-ui-modal` (commits **`04c69e3`** … **`92668e4`**).

**Notifications hors-app (Q35)** :
- SMS **patient uniquement**, événements **`request_status:responded`** et **`request_status:treated`** (**`20260522_001`**, worker + **`20260522_002`**).
- Texte SMS : `ProxiPharma: {officine} a repondu. Dossier {request_public_ref}.` / `… a traite le dossier {ref}.` — ASCII, ~1 segment, ref **`D042/26`** (**`lib/external-notification-queue-worker.ts`**).
- UI prefs : pas de case SMS côté pharmacien (**`ExternalNotificationPrefs variant="pharmacien"`**).
- Webhook + e-mail inchangés (§ session 2026-05-16).

**Expiration `responded`** :
- Défaut **24 h** après **`responded_at`** (**`20260523_001`**) ; cron **`/api/cron/expire-overdue-requests`** aligné ; surcharge Vercel **`EXPIRE_RESPONDED_SILENCE`** si besoin de test court.

**Auth inscription** :
- Pas d’OTP si téléphone déjà dans **`auth.users`** : **`POST /api/auth/signup-phone-check`**, **`auth_phone_user_exists`** (**`20260522_003`**).

**Admin / comptes** (constat pilote) :
- Assignation **`pharmacy_staff`** depuis **`/admin`** ne met **pas** **`profiles.role = pharmacien`** — à faire manuellement ou évolution UI à prévoir.
- Compte créé par SMS : chercher l’utilisateur dans Auth par **téléphone** ou **UUID** `profiles.id` ; e-mail facultatif peut être dans **`profiles.email`** avant confirmation **`auth.users.email`**.

---

### Session 2026-05-16 — Notifications hors-app : worker SMS Twilio + incident facturation

**Livré (code, branche `fix/validated-supply-ecart-ui-modal` → mergé `main` en fin de session)** :
- Worker SMS : **`app/api/cron/send-external-sms`**, logique partagée **`lib/external-notification-queue-worker.ts`** (e-mail Resend inchangé).
- Garde-fous facturation : cron SMS **manuel uniquement** (`.github/workflows/send-external-sms-cron.yml`) ; e-mail seul sur schedule (`.github/workflows/send-external-emails-cron.yml`) ; **1 tentative** SMS, pas de retry cron.
- UI prefs : texte « e-mail + SMS branchés » ; **`RUNBOOK.md` §9**, **`AGENTS.md`**.

**Tests fondateur (non résolu livraison SMS notif)** :
- Profil test OK : `sms_enabled`, `whatsapp` **+212…**, file `notification_external_queue` avec `channel=sms` → **`sent`** + e-mail reçu.
- **SMS notif non reçu** sur le téléphone malgré `sent` ; OTP inscription **reçu** (même compte Twilio, autre config Supabase Auth vs `TWILIO_SMS_FROM` Vercel).
- Incident billing Twilio : ~**4 USD**, logs **~4 delivered / ~30 failed** — cause probable : ancien workflow **toutes les 5 min** + retries (corrigé en repo ; workflow GitHub **désactivé** côté fondateur en attendant).

**Blocage prochaine session (priorité)** :
1. Vercel : **`TWILIO_ACCOUNT_SID`**, **`TWILIO_AUTH_TOKEN`**, **`TWILIO_SMS_FROM`** (= **même numéro** que Supabase Auth OTP ; **`TWILIO_MESSAGING_SERVICE_SID` non requis** si `FROM` renseigné) → redeploy.
2. Twilio : plafond dépenses ; **Geo permissions** Maroc ; comparer log message notif vs OTP (From, code erreur).
3. Réactiver **uniquement** `Send External Emails Cron` (schedule) ; SMS via **`Send External SMS Cron (manual)`** après 1 test **Delivered** dans Twilio.
4. WhatsApp API : toujours **sans worker** (Meta Business + templates) — après SMS stable.

**Commits repères** : `feat(notifications): worker SMS Twilio…`, `fix(notifications): limiter facturation SMS Twilio (cron manuel)`.

**Suite même jour (webhook + SMS courts)** :
- **Webhook Supabase** sur INSERT `notification_external_queue` → `/api/webhooks/dispatch-external-sms` : **SMS reçu rapidement** sur le téléphone (quelques secondes).
- **Run manuel** GitHub *Send External Emails Cron* : e-mail + SMS OK ; cron `schedule` GitHub **peu fiable** (lignes `pending` sans webhook / sans manuel).
- Twilio **30007** (*Message filtered*) surtout sur **SMS longs + URL** ; format court sans lien = livraison OK au pilote.
- Correctif repo : SMS courts (`ProxiPharma - [titre] ([pharmacie])`, ~1 segment) — merger `main` + redeploy pour figer en prod.
- `SMS_BLOCKED_DESTINATIONS` + `supabase/scripts/cancel-sms-queue-bad-destination.sql` (numéro test `212600000123`).
- **Notifs** = `profiles.whatsapp` (E.164) ; **Auth.phone** vide sur comptes legacy e-mail = normal.
- **Lien dans le SMS** : possible techniquement (URL courte) mais **risque 30007** ; e-mail garde le lien complet ; voir **`RUNBOOK.md` §9**.
- **Webhook e-mail + SMS** : même URL `/api/webhooks/dispatch-external-sms` traite les deux canaux à l’INSERT (commit `feat(notifications): webhook traite email et SMS a l'insert`) — **à merger `main` + redeploy**.

---

### Session 2026-05-15 — Auth SMS + mot de passe ; démarrage WhatsApp (infra Twilio)

**Auth patient** (branche **`fix/validated-supply-ecart-ui-modal`**, commits auth récents) :
- **`/auth`** : connexion **téléphone ou e-mail** + mot de passe (`lib/auth-login-identifier.ts`).
- **`/auth?mode=signup`** : nom, téléphone, e-mail facultatif → OTP SMS → mot de passe (`lib/phone-e164.ts`, `lib/ensure-patient-profile.ts`).
- **`/auth/update-password`** ; **`lib/supabase.ts`** : `detectSessionInUrl`.
- Migration **`20260521_001_profiles_email_nullable.sql`**.
- Tests auth : **Chrome** uniquement (pas Simple Browser IDE) — voir **`AGENTS.md`**.

**WhatsApp notifications** — **pas de worker** encore ; SQL Q35 déjà prêt (`notification_external_queue`, prefs).
- **Étape 1 en cours côté fondateur** : Twilio + **Meta Business** obligatoire pour l’API ; sandbox / template ; erreur vue **63055** = ne pas passer par **MM Lite** pour messages **utilitaires** (utiliser Cloud API + templates **Utility**).
- Rappel produit : notifs API ≠ numéro perso pharmacien ; contact manuel via **`wa.me`** sur fiche pharmacie.

**À faire prochaine session** : valider envoi test template WhatsApp (hors MM Lite) → étape 2 code (`/api/cron/...` ou script test + env).

---

### Session 2026-05-14 — patient détail demande produits : parcours **envoyée / répondue / validée / traitée** (UI)

**Contexte** : alignement UX écran patient **`/dashboard/demandes/[id]`** ; **aucune nouvelle migration**.

**`PatientProductRequestActions.tsx` + `app/dashboard/demandes/[id]/page.tsx`** :
- Récap **`PatientSentEnvoyeeSummaryCard`** étendu à **`confirmed` / `treated`** (pastille **`requestStatusFr`** + texte d’aide dans la carte ciel, comme **envoyée** / **répondue**) ; suppression des bandeaux dupliqués sous le récap ; **`hideMainRequestHeader`** aussi pour **`confirmed` / `treated`**.
- **`responded`** : choix **alternatives** (radios, panneau unique), badge **Réception** ambre (**`RespondedReceptionBadgeFr`**) sur les lignes **à commander** (y compris ligne résumé qté/dispo), pied **Valider ma demande** (compteur + total une ligne), hint **Conversation** en bas ; statut d’action conservé **dans** le récap (pas de seconde carte « Action »).
- **`submitted` / `in_review`** : titre de section **Produits** ; pied fixe resubmit (ligne compteur + montant alignés **`formatPriceDh`**).
- **`confirmed` / `treated`** : même section **Produits** ; pied fixe **produits retenus + total** + **Mettre à jour ma date de passage** ; bouton **désactivé** tant que date/heure inchangées vs serveur (**`visitPassageDirty`**) ; resync formulaire passage quand **`initialPlannedVisitDate` / `initialPlannedVisitTime`** changent (**réinitialisation en rendu**, pas d’**`useEffect`** + **`setState`** — conformité **`react-hooks/set-state-in-effect`** / ESLint CI).
- **`PatientValidatedCompactLineCard`** : gabarit proche liste **envoyée** (`rounded-xl border-2`, vignette **20×20**, grille **PU / Qté / Total**, pastille dispo **`availabilityStatusUi`**, réception **`RespondedReceptionBadgeFr`** si **à commander**).

**Lint** : `npm run lint` — **0 erreur** (warnings **`@next/next/no-img-element`** existants sur d’autres fichiers inchangés).

**Git** : branche **`fix/validated-supply-ecart-ui-modal`**.

---

### Session 2026-05-13 — supply post-validé (alt. choisie), notifs comptoir, expiration `responded`

**Contexte** : développement continu ; préférence équipe : **en dev, une solution simple + base vidée** vaut mieux qu’un long contournement SQL uniquement pour préserver des données de test obsolètes (demander **`scripts/clear-all-requests.mjs`** / **`supabase/scripts/clear-all-requests.sql`** ou reset Supabase si besoin).

**UI — pharmacien post-`confirmed` / `treated`** : **`app/dashboard/pharmacien/demandes/[id]/page.tsx`** — pour une ligne avec **alternative choisie**, la dispo / date « à commander » et le clamp **`post_confirm_fulfillment`** suivent le **brouillon** (`effectiveAvailSupplyDraft`, `effectiveEtaSupplyDraft`, `inferredAvailabilityForPostConfirmClamp`) comme le payload d’enregistrement, et **`virtualizeItemsForSupplyBuckets`** n’exclut plus ces lignes.

**SQL — migrations** :
- **`20260515_001_no_in_app_notif_counter_picked_up.sql`** — entrée d’historique `counter_outcome:picked_up` : **aucune** ligne dans **`app_notifications`** (trigger **`_emit_in_app_notifications_for_status_history`**).
- **`20260516_001_expire_overdue_responded_at_pilot_30m.sql`** — **`expire_overdue_requests(interval)`** (pilote 30 min, remplacé par **`20260523_001`** = **24 h**).
- **`20260522_001`** … **`20260523_001`** — SMS patient répondu/traité, pas de SMS pharmacien, garde inscription téléphone, expiration **24 h** (voir §10 session **2026-05-22**).

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
  - `supabase/migrations/20260516_001_expire_overdue_responded_at_pilot_30m.sql` (pilote 30 min ; corps actuel **`20260523_001`** = **24 h**)
  - `supabase/migrations/20260522_001_sms_pilot_responded_treated_patient_only.sql` · **`20260522_002`** · **`20260522_003`** · **`20260523_001_expire_responded_silence_24h.sql`**
  - `supabase/migrations/20260524_001_storage_buckets_media.sql` (Storage **`public-assets`** / **`private-media`**, policies)
  - `supabase/migrations/20260524_002_pharmacies_media_url_columns.sql` (`pharmacies.logo_url` / `cover_url`)
  - `supabase/migrations/20260524_003_ma_catalog_photos_ready.sql` (MERGE catalogue pilote MAROC + chemins photo)
  - `supabase/migrations/20260601_001_product_request_notifs_ui.sql` (notifs patient post-validation / traitée / réception officine)
  - `supabase/migrations/20260602_001_retest_workflow_fixes.sql` (correctifs workflow retest)
  - `supabase/migrations/20260603_001_retest_workflow_fixes.sql` (retours test : notifs, consultation, catalogue)
  - `supabase/migrations/20260604_001_patient_notify_validated_request_updated.sql` (notif patient « Demande validée mise à jour »)
  - `supabase/migrations/20260605_001_alternative_qty_patient_confirm.sql` (plafond qté alternative à la validation patient)
  - `supabase/migrations/20260606_001_pharmacy_digital_profile.sql` (fiche digitale : profil, services, horaires, gardes)
  - `supabase/migrations/20260607_001_lock_line_notes_after_validation.sql` (notes ligne figées après `confirmed`)
  - `supabase/migrations/20260608_001_pharmacy_ratings.sql` (avis publics 1–5 étoiles par compte ; agrégat sur `pharmacies`)
  - `supabase/migrations/20260609_001_storage_pharmacy_versioned_media_paths.sql` (RLS Storage : noms fichiers cover-{ms} / logo-{ms})
  - `supabase/migrations/20260610_001_promo_offers_reservations.sql` (offres packs promo + réservations + notifs `promo_in_app_notifications` — workflow séparé des `requests`)
  - `supabase/migrations/20260611_001_promo_duplicate_reservation_guard.sql`
  - `supabase/migrations/20260612_001_pharmacist_ordered_products_hub.sql`
  - `supabase/migrations/20260613_001_promo_cancel_confirm_messages.sql`
  - `supabase/migrations/20260614_001_post_confirm_arrival_cancelled_notif.sql`
  - `supabase/migrations/20260615_001_pharmacist_market_shortage_hub.sql`
  - `supabase/migrations/20260616_001_pharmacist_dashboard_patient_crm.sql`
  - `supabase/migrations/20260617_001_pharmacist_profile_analytics.sql`
  - `supabase/migrations/20260618_001_market_shortage_notify_chosen_alternative.sql`
  - `supabase/migrations/20260619_001_pharmacy_pricing_engine.sql` (**moteur pricing** officine — parapharmacie PPH±marge, médicaments PPV fixe)
  - `supabase/migrations/20260620_001_fix_pharmacist_profile_analytics_journal_cte.sql`
  - `supabase/migrations/20260621_001_pharmacies_statut_check_align.sql`
  - `supabase/migrations/20260622_001_pharmacy_titular_public.sql` (**titular_public** + backfill titulaire)
  - `supabase/migrations/20260625_001_patient_update_confirmation_optimistic.sql` (**`patient_update_confirmation`** + verrou **`p_expected_updated_at`**)
  - `supabase/migrations/20260626_001_patient_pharmacy_directory_crm.sql` (annuaire patient **Mes pharmacies**)
  - `supabase/migrations/20260627_001_skip_conversation_notif_initial_submission_message.sql`
  - `supabase/migrations/20260628_001_pharmacist_mark_request_treated_relaxed.sql` · **`20260628_002_pharmacist_abandon_request_no_pickup.sql`**
  - `supabase/migrations/20260629_001_relax_arrived_reserved_no_prior_ordered.sql` · **`20260629_002_no_treated_notif_on_treated_update.sql`**
  - `supabase/migrations/20260630_001_partial_counter_closure.sql` (**clôture comptoir** si ≥1 ligne **`picked_up`** — auto-écart des autres lignes retenues)
  - `supabase/migrations/20260701_001_notifications_professional_improvements.sql` (notifs pro, rappels, canaux externes élargis)
  - `supabase/migrations/20260701_002_auth_phone_lookup_user_id.sql` (lookup auth par téléphone)
  - `supabase/migrations/20260703_001_pharmacist_dashboard_needs_action_priorities.sql` (priorités hub pharmacien)
  - `supabase/migrations/20260703_002_prescription_line_workflow_rpcs.sql` (workflow lignes ordonnance / consultation)
  - `supabase/migrations/20260704_001_preserve_submitted_at_on_sent_resubmit.sql` (conserver **`submitted_at`** au resubmit envoyée)
  - `supabase/migrations/20260705_001_consultation_conversation_notif_skip_fix.sql` (notif pharmacien 1er message chat consultation)
  - `supabase/migrations/20260706_001_conversation_audio_messages.sql` (messages vocaux conversation : colonnes audio, Storage, RLS)
  - `supabase/migrations/20260707_001_private_media_conversation_audio_mime.sql` (**MIME audio** autorisés sur bucket **`private-media`**)
  - `supabase/migrations/20260707_002_patient_prescription_update_sync.sql` (note ordonnance patient → conversation + drift)
  - `supabase/migrations/20260708_001_prescription_first_attach_no_update_notif.sql` (pas notif « mise à jour » au 1er attach ordonnance)
  - `supabase/migrations/20260709_001_i18n_patient_notification_ar.sql` (notifs in-app patient bilingues ar/fr)
  - `supabase/migrations/20260711_001_patient_consultation_edit_after_response.sql` (consultation patient éditable jusqu’à **`responded`**, **`patient_content_updated_at`**)
  - `supabase/migrations/20260712_001_consultation_first_attach_and_save_brief.sql`
  - `supabase/migrations/20260710_001_products_brand_columns.sql` (**products.brand** + **brand_confidence**)
  - `supabase/migrations/20260713_001_pharmacy_pricing_brand_rules.sql` (**pricing parapharmacie par marque**) (**`patient_save_consultation_brief`**, pas de double notif au 1er envoi avec photos)
  - `supabase/migrations/20260714_001_i18n_patient_notification_ar_enrichment.sql` (notifs in-app patient ar enrichissement)
  - `supabase/migrations/20260715_001_rebrand_pharmeto_notification_copy.sql` (ancre rebrand Pharmeto)
  - `supabase/migrations/20260716_001_pharmacy_nom_adresse_ar.sql` (`nom_ar`, `adresse_ar` officine)
  - `supabase/migrations/20260717_001_patient_pharmacy_directory_nom_ar.sql` (Mes pharmacies + `nom_ar`)
  - `supabase/migrations/20260718_001_pilot_pharmacy_public_listed.sql` (**`public_listed`**, **`pilot_access`**, RLS annuaire pilote)
  - `supabase/migrations/20260718_002_pilot_visibility_seed_fix.sql` (fix seed SQL Editor — **à appliquer après 001**)
  - `supabase/migrations/20260811_001_disable_external_sms_notifications.sql` (SMS métier off ; enqueue e-mail + WhatsApp patient P0)
  - `supabase/migrations/20260812_001_planned_visit_pharmacy_hours_validation.sql` (passage patient vs horaires officine)
  - `supabase/migrations/20260813_001_pharmacy_catalog_products.sql` (catalogue privé officine + recherche unifiée)
  - `supabase/migrations/20260815_001` · **`20260816_001`** · **`20260818_001`** · **`20260819_001`** · **`20260819_002`** (catalogue communautaire V1 — **001 enum seul puis 002**)
  - `supabase/migrations/20260817_001_whatsapp_c_pilote_pharmacist_enqueue.sql` (enqueue WhatsApp pharmacien nouvelle demande)
  - `supabase/migrations/20260820_001_pharmacy_pricing_catalog_visibility.sql` (**masquer PU patient avant réponse** + override produit pricing)
  - `supabase/migrations/20260821_001_pharmacist_abandon_request.sql` (**abandon direct pharmacien** validé/traité avec motif)

**Pilote (état infra juin 2026)** : migrations jusqu’à **`20260822_001`** ; prod **`pharmeto.ma`** ; marque **Pharmeto** ; **annuaire public = Al Jazira seule** ; catalogue **~19 677** ; photos catalogue = URLs BeautyMall (sauvegarde locale **`docs/CATALOGUE-PHOTOS-INDEPENDANCE-BEAUTYMALL.md`**) ; i18n patient **~1 220** clés FR/AR. Reprise courte : **§13.63** (photos) ou **§13.62**.

Regles fonctionnelles retenues (alignement dernier atelier):
- A la **`responded` -> `confirmed`**, le patient indique une **date de passage** (bornes métier CAS : 4 jours sans « à commander » sélectionné, sinon jusqu à **ETA max + 3 j** pour les lignes « à commander » de sa sélection) et une **heure optionnelle** ; données stockées sur **`requests`**, effacées si le patient **renvoie** la demande (`submitted`).
- A la **`responded` -> `confirmed`**, le patient peut choisir pour chaque ligne le **produit principal** ou **une alternative** proposee (`patient_chosen_alternative_id`), ou **rien** pour la ligne.
- **Prix catalogue officine** (depuis **`20260619_001`**, migration **appliquée**) : résolution via **`lib/pharmacy-pricing`** + RPC **`resolve_pharmacy_product_unit_price`** / **`pharmacy_pricing_config_public_get`** — **médicament = PPV** ; **parapharmacie = PPH + marge** (global / laboratoire / produit, voir **`/dashboard/pharmacien/pricing`**). Patient : libellé **Prix / PU** uniquement. **`request_items.unit_price`** = prix saisi ou résolu à l’enregistrement pharmacien (lignes déjà répondues).
- Le client peut **modifier et renvoyer** une demande produit **avant réponse** (`submitted`|`in_review`) ou **après réponse** (`responded` uniquement pour ce flux ; en **`confirmed`** le renvoi liste est retiré côté UI — abandon possible) via RPC `patient_resubmit_product_request_after_response` → retour **`submitted`**, reset préparation pharma.
- Le **retrait reel** au comptoir est porte par le **pharmacien**: colonne par ligne `request_items.counter_outcome` (en UI post-validé **saisie brouillon** limitée à **`unset`** / **`picked_up`** pour les lignes non figées ; valeurs legacy **`deferred_next_visit`** / **`cancelled_at_counter`** restent en base et sont affichées en lecture seule ou normalisées à l’enregistrement). **Clôture** dossier : **`pharmacist_complete_request_after_counter`** accessible dès qu’**au moins une** ligne retenue (non écartée) est **`picked_up`**, avec **confirmation** si d’autres lignes retenues ne le sont pas encore.
- **Après réponse** : l’app ne renseigne plus **`expires_at` +7 j** sur publication (pilote). L’expiration **`responded`** sans validation patient repose sur **`expire_overdue_requests()`** (cron **`service_role`** ou **`/api/cron/expire-overdue-requests`**) : **`responded_at`** vs **`now()`** ; défaut **24 h** (**`20260523_001`**) ; **`expires_at`** non nul reste pris en charge en seconde passe. **`abandon_unconfirmed_responded_requests()`** = alias. Les **`request_items`** sont limités à **qté 1–10** et **un seul `product_id` par demande**.
- Les statuts enum `partially_collected` / `fully_collected` restent en base mais le flux officiel livre passe par **`completed`**; `patient_mark_collected` nest plus callable par le JWT patient (obsolete).

Implémentation frontend associée repo (voir journal §10 dont **Sessions 2026-05-03**, **2026-05-05**, **2026-05-06** et **lot plateforme / codes publics 2026-05-05**):
- **`/`** annuaire interactif (**`components/annuaire/`** — hero, filtres, rayon portail, cartes avec avis + actions contact) + recherche **`public_ref`** → fiche **`/pharmacie/[id]`**
- **`/pharmacie/[id]`** : fiche digitale (**`PharmacyPublicProfile`** + **`pharmacy-public-chrome`**) — Services (grille contact + liens demande), Offres (**`PublicPromoOffers`**), Horaires, Infos (blocs cartes + **`PharmacyRatingForm`**).
- **`/pharmacie/[id]/demande-produits`** (+ **`/catalogue`**) : parcours patient aligné visuellement sur l’annuaire (hero émeraude, cartes produits) ; **aperçu photo + description** catalogue au clic vignette (**`736100f`**).
- **Catalogue pilote** : **~19 677** produits en BDD (juin 2026) — **13 651** parapharmacie BeautyMall (photos URL **`beautymall.ma`**, descriptions HTML **`full_description`**, marques **~93,65 %**) + **6 026** médicaments officine (PPH/PPV, sans photo) ; voir **`scripts/README-beautymall-catalog.md`** et **`scripts/README-medicaments-officine.md`**.
- **`/dashboard/pharmacien/ma-fiche`** + **`/dashboard/pharmacien/horaires-garde`** : édition fiche officine (onglets **Coordonnées** / Accueil / Photos / Liens / Services ; titulaire + **`titular_public`** ; horaires compacts + fériés auto + garde ; upload **couverture** / **logo** versionnés via **`lib/pharmacy-media.ts`**).
- **`/admin`** : espace pilote refoné (**juin 2026**) — layout + nav **`lib/admin-nav.ts`** ; dashboard **`admin-dashboard.tsx`** ; **`/admin/demandes`**, **`/admin/officines`**, **`/admin/produits-communautaires`** ; onboarding officine (**`AdminOnboardPharmacyForm`**) ; accès pilote **`admin-pilot-access-list.tsx`**.
- **`/dashboard/pharmacien/offres-promos`** + **`/dashboard/pharmacien/reservations-packs`** ; **`/dashboard/patient/packs-promo`** — workflow packs promo (après **`20260610_001`**).
- **`/dashboard/pharmacien/pricing`** — moteur de pricing officine (**`20260619_001`**, appliquée).
- **`/dashboard/pharmacien/parametres`** — **Mes paramètres** pharmacien (**`pharmacist-settings-page.tsx`**, charte **`platform-dashboard-chrome`**).
- **Hubs pharmacien par type** : **`/dashboard/pharmacien/demandes`** (sky), **`/ordonnances`** (amber), **`/consultations-libres`** (violet), **`/reservations-packs`** (emerald) — **`RequestKindHubDashboard`** + **`PharmacistProductDemandeHubCard`** ; libs **`pharmacist-*-hub-dashboard-ui.ts`**.
- **Barre basse** : **`PlatformBottomNav`** — 4 onglets dossiers patient/pharmacien ; détail dossier = onglet actif selon type (**`platform-bottom-nav-dossier-tab`**).
- **`/pharmacie/[id]/demande-produits`**: création demande **`submitted`**
- **`/dashboard`** (résumé / routage rôle), **`/dashboard/demandes`** (hub + **filtre par réf.** + codes **`request_public_ref`** sur cartes), **`/dashboard/demandes/[id]`** (ref mémorable + code officine en détail)
- **`/dashboard/demandes`** (vue liste) : refonte UX des filtres/cartes ; suppression bouton copie ; compteurs et montants contextualisés (`responded` vs validé/en traitement/clôturé) ; statut intermédiaire UI **En traitement** (virtuel : `confirmed` + **`post_confirm_fulfillment`** `reserved`/`ordered`, migration **`20260507_005`**)
- **`/dashboard/demandes`** et **`/dashboard/pharmacien/demandes`** (vue dashboard) : bloc **En traitement** alimenté par le même statut dérivé ; bucket **Validée par vous / le client** pour **`confirmed`** sans réservation/commande
- **`/dashboard/demandes/[id]`** (détail patient) : refonte orientée produit avec header sticky montant+volume+passage prévu et actions globales en bas ; date de passage modifiable aussi en `confirmed` côté UI/app
- **`/dashboard/pharmacien`** (tableau de bord analytics + liens), **`/dashboard/pharmacien/demandes`** (idem refs + **code client** sur cartes), **`/dashboard/pharmacien/demandes/[id]`**, **`/dashboard/pharmacien/clients`** (recherche par **`patient_ref`**)
- **Chrome** : **`platform-header.tsx`** + **`platform-bottom-nav.tsx`** — dossiers = barre basse (4 types) ; menu profil = pharmacies / paramètres / déconnexion (plus Annuaire ni Notifications patient) ; cloche = **`app_notifications`** + **`promo_in_app_notifications`**
- **Patient** : **`/dashboard/patient/*`** (paramètres, **Mes pharmacies**, hubs par type via barre basse)
- **Pharmacien** : détail unique **`/dashboard/pharmacien/demandes/[id]`** pour D/O/C ; charte couleur par **`request_type`** ; contact patient via RPC (**`pharmacist_patient_contact_for_request`**, annuaire enrichi, **`pharmacist_patient_detail`** pour promos)
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
- **Expiration après `responded`** : **implémenté** — défaut **24 h** (**`20260523_001`**) + cron. **`abandon_unconfirmed_responded_requests()`** = alias.  
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
5. **Tâches planifiées** : job **`expire_overdue_requests()`** ✓ — défaut **24 h** (**`20260523_001`**) ; cron **`service_role`** ou route Vercel ; **Q34 in-app MVP** ✓.  
6. **Espace Admin** minimal issu du jalon BDD §9.

**Écart principal avec le déjà livré** : flux **`responded` → `confirmed`** inclut désormais **alternative + passage + validation serveur associée**. **Motifs annulation**, **anti-doublon / plafond qté**, **`market_shortages`** auto, **expiration `responded` 24 h** (**`20260523_001`**), **commentaires ligne patient (Q11)**, **propositions pharmacien (Q20)** et **notifications in-app MVP (Q34)** sont en place. **Q35** : e-mail + **SMS pilote patient** (répondu / traité) branchés ; **WhatsApp** worker à faire. Restent **admin** (rôle pharmacien à l’assignation), **micro-UX**, **cron** expiration sur Supabase si pas encore planifié.

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
| **Auto expiration** cron supabase **`expire_overdue_requests(interval)`** | Défaut **24 h** après **`responded_at`** (**`20260523_001`**) + passe **`expires_at`** ; alias **`abandon_unconfirmed_responded_requests()`** ; cron **`service_role`** ou **`/api/cron/expire-overdue-requests`** |
| **SMS hors-app pilote** | Patient **`responded` / `treated`** uniquement ; ref **`request_public_ref`** ; **`20260522_001`**–**`002`** ; webhook + Twilio |
| **Abandon automatique** 24 h après **`responded`** | **Remplacé** par le même batch **`expire_overdue_requests()`** ( statut cible **`expired`** , pas **`abandoned`** ) |
| **Ordonnance** : capture + saisie pharma (qté prescrite/dispo, modal, badge Ordonnance) | **Fait** (sessions **2026-05-25** + **2026-05-17**) — QA pilote §D dans `docs/workflow-ordonnance-consultation-REPONSES.md` |
| **Consultation libre** : texte + photos + workflow lignes + hubs violet | **Fait** (session **2026-05-17**, migration **`20260529_001`**) — QA pilote idem |
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

### 13.13) Phrase de reprise (recommandée après **2026-05-14** — détail patient demande produits : responded / validée / traitée)

**« On reprend ProxiPharma. Lis **`CONTEXTE.md` §6**, **`CAHIER_DES_CHARGES.md` §0.1, **§10 Journal (session 2026-05-14)**, §4.4 + §4.6, §11 (migrations jusqu’à **`20260516_001`**), §12. Branche **`fix/validated-supply-ecart-ui-modal`**. Fichiers clés patient : **`app/dashboard/demandes/[id]/PatientProductRequestActions.tsx`**, **`app/dashboard/demandes/[id]/page.tsx`** — récap carte ciel, pieds fixes, **`visitPassageDirty`**, cartes **`PatientValidatedCompactLineCard`** ; pas de migration sur ce lot. ESLint : éviter **`setState` dans un `useEffect`** pour resynchroniser le passage (pattern **réinit. en rendu** si les props **`initialPlannedVisit*`** changent). Je te dis ensuite quoi faire. »**

### 13.14) Phrase de reprise (session **2026-05-16** matin — dépassée)

Voir **§13.15** (webhook + 30007 + SMS courts).

### 13.15) Phrase de reprise (session **2026-05-16** — dépassée pour SMS / délai)

Voir **§13.16**.

### 13.16) Phrase de reprise (SMS pilote + expiration 24 h — voir aussi §13.17)

**« On reprend ProxiPharma. Lis **`CAHIER_DES_CHARGES.md` §10 (session 2026-05-22)**, **`RUNBOOK.md` §9**, **`AGENTS.md`**, **`CONTEXTE.md` §6**. Migrations Supabase si besoin : **`20260522_001`**–**`003`**, **`20260523_001`**. État : webhook INSERT `notification_external_queue` → `/api/webhooks/dispatch-external-sms` ; **SMS patient** seulement (**répondu** / **traité**), format ref dossier ASCII ; **e-mail** = canaux pilote habituels. Expiration **`responded`** = **24 h** (`expire_overdue_requests`). Inscription : pas d’OTP si téléphone déjà enregistré (`signup-phone-check`). Vercel : `TWILIO_*`, `RESEND_*`, `CRON_SECRET`. Admin : assignation officine ≠ `role pharmacien` automatique. Je te dis ensuite quoi faire. »**

### 13.17) Phrase de reprise (session **2026-05-17** — voir **§13.18**)

Voir **§13.18**.

### 13.18) Phrase de reprise (recommandée — après session **2026-05-24**)

**« On reprend ProxiPharma. Lis **`CAHIER_DES_CHARGES.md` §10 (session 2026-05-24)**, **`AGENTS.md`**, **`CONTEXTE.md` §6**, **`RUNBOOK.md` §9**. Branche **`fix/validated-supply-ecart-ui-modal`** (commits **`4ed2cf9`**+). Migrations si besoin : **`20260524_001`**–**`003`** (Storage + catalogue photos). UI : **`resolvePublicMediaUrl`** / **`mapRequestItemsPhotos`** ; page **`/pharmacie/[id]/demande-produits/catalogue`** + brouillon **`patient-demande-produits-draft`** ; **Voir tous les produits** aussi en modification demande envoyée. Prod : merge **`main`** + Vercel. ESLint : pas de **`setState` synchrone dans un `useEffect`** (resync en rendu). Je te dis ensuite quoi faire. »**

### 13.19) Phrase de reprise (recommandée — après session **2026-05-25** — ordonnances + registre types)

**« On reprend ProxiPharma sans régression. Lis **`CAHIER_DES_CHARGES.md` §10 (session 2026-05-25)**, **`AGENTS.md`**, **`CONTEXTE.md` §6**. Branche **`fix/validated-supply-ecart-ui-modal`**. Sur Supabase, appliquer dans l’ordre **`20260525_001`**–**`004`** si pas déjà fait. Registre : **`lib/request-kinds/`** ; ordonnance : **`/pharmacie/[id]/demande-ordonnance`**, **`lib/prescription-media.ts`**, **`components/requests/prescription/`**. Avant tout changement : smoke test **demande produits** (catalogue + édition retour catalogue + post-validé) puis **ordonnance** (envoi 1–2 photos → saisie pharma → réponse → validation patient). Consultation libre = phase 3 (`workflowEnabled: false`). Je te dis ensuite quoi faire. »**

### 13.20) Phrase de reprise (contexte global — dépassée pour consultation onglets)

**« On reprend ProxiPharma. Infra Supabase à jour (toutes les migrations appliquées). Lis `CONTEXTE.md` §6, `AGENTS.md`, `CAHIER_DES_CHARGES.md` §10 (session 2026-05-17) et `docs/workflow-ordonnance-consultation-REPONSES.md`. Branche `fix/validated-supply-ecart-ui-modal`. Périmètre : demandes produits (référence), ordonnances et consultations libres — registre `lib/request-kinds/`. Ne code rien tant que je n’ai pas précisé ce qui bloque. »**

### 13.21) Phrase de reprise (dépassée — avant lot retours §10 session 2026-05-17 suite 2)

Voir **§13.22**.

### 13.22) Phrase de reprise (dépassée — avant session **2026-06-01**)

Voir **§13.23**.

### 13.23) Phrase de reprise (recommandée — après session **2026-06-01**)

**« On reprend ProxiPharma. Lis `CAHIER_DES_CHARGES.md` §10 (session **2026-06-01**), `CONTEXTE.md` §6, `AGENTS.md`, `RUNBOOK.md` §9 si notifs/SMS. Branche **`fix/validated-supply-ecart-ui-modal`**. Commit poussé **`aec8fad`** (lot demandes produits UI + clôture + ordre lignes) ; **en local non commité** : alignement **ordonnance** (= demande produits après réponse pharma : lignes scan en **`patient_request`**, libellé **Saisi ordonnance**, scan **`PrescriptionScanCollapsible`**, thème ambre hubs/header/validé). Migration Supabase à appliquer si pas fait : **`20260601_001_product_request_notifs_ui.sql`**. Attendre ou intégrer **retours terrain demandes produits** avant commit/push du lot ordonnance. QA : demande produits (répondue → validée → traitée + notifs) puis ordonnance (saisie scan → réponse → validation ; complément **proposé** avec motif). Je te donne ensuite les retours ou la prochaine tâche. »**

### 13.24) Phrase de reprise — fiche digitale pharmacie (dépassée pour upload)

Voir **§13.28**.

### 13.25) Phrase de reprise — retours test terrain post-commit (2026-06-03)

Voir **§13.28**.

### 13.26) Phrase de reprise (dépassée — lot demandes juin 2026-06-03/04)

Voir **§13.28** pour la phrase consolidée actuelle.

### 13.26-suite) Phrase de reprise (historique — après session **2026-06-04**)

**« On reprend ProxiPharma. Branche `fix/validated-supply-ecart-ui-modal`. Lis `CONTEXTE.md` §6, `AGENTS.md`, `CAHIER_DES_CHARGES.md` §10 (sessions 2026-06-03 + **2026-06-04**), §4.4–§4.5, `docs/workflow-ordonnance-consultation-REPONSES.md`. Migrations déjà appliquées : `20260601_001`, `20260602_001`, `20260603_001` — **appliquer si besoin** : `20260604_001_patient_notify_validated_request_updated.sql` (notif patient « Demande validée mise à jour »). État livré : **consultation** = page scroll (brief + messagerie + lignes) ; recherche catalogue pharma consultation corrigée (`propCatalogSearchActive` + `free_consultation`) ; **ordonnance** = badges Ordonnance/Proposé, scan unique patient clôturé, ajout post-validé journalisé + badge « Ajouté après validation » ; patient consultation = récap en-tête, conversation stable ; supply **traité** = bandeau suivi ligne (`RequestLineSuiviStrip`). Fichiers clés : `app/dashboard/pharmacien/demandes/[id]/page.tsx`, `app/dashboard/demandes/[id]/page.tsx`, `lib/supply-line-post-confirm.ts`, `lib/pharmacist-request-catalog-product-block.ts`. Je te dis ensuite quoi faire. »**

### 13.27) Phrase de reprise (dépassée — avant session **2026-05-22**)

Voir **§13.28**.

### 13.28) Phrase de reprise (dépassée — promo + horaires seuls)

Voir **§13.29**.

### 13.29) Phrase de reprise (dépassée — pricing seul)

Voir **§13.30**.

### 13.30) Phrase de reprise (dépassée — onboarding + stable **`0c4f0e7`**)

Voir **§13.31**.

### 13.31) Phrase de reprise (dépassée — annuaire + fiche publique)

Voir **§13.32**.

### 13.32) Phrase de reprise (dépassée — session **2026-05-25** patient envoyée / répondue / validée v1)

Voir **§13.34**.

### 13.33) Phrase de reprise (dépassée — session **2026-05-25** validée + traitée)

Voir **§13.34**.

### 13.34) Phrase de reprise (dépassée — avant session **2026-06-03 suite 3**)

Voir **§13.37**.

### 13.58) Roadmap i18n arabe patient — affinage post-couverture (juin 2026)

**Contexte** : couverture **messages** patient **1 212 clés** FR/AR + CI **`npm run i18n:parity`** (juin 2026, **§14**). Reste surtout du **texte métier dynamique** (`*-fr.ts`, timelines) et contenus hors scope (catalogue HTML, SMS, pharmacien).

**Livré avant cette roadmap**
- Ville AR catalogue code (**§13.55**, commit **`cff4fa4`**).
- Fix bandeau dossier `nom_ar` manquant au select (**`2d94ffc`**).

**Étape 1 — Finitions rapides** : **livré** (commit **`059d712`**).
- Zéro chaîne FR repérée par **`i18n:parity --strict-strings`** (auth code sync, consultation panel, historique vide).
- **Itinéraire** / modale navigation → **`pharmacyPublic.*`**.
- **Mes pharmacies** : dates locale, `nom_ar`, types dossiers **`workflow.*`**, note avis ; migration **`20260717_001`** (`patient_pharmacy_directory_enriched` + `nom_ar`).

**Étape 2 — Archives & statuts terminaux** : **livré**.
- **`demandes.archive.terminal.*`** + hook **`usePatientArchiveOutcomeCopy`** (bandeaux dossier, footer archive, hint expirée).
- Fichiers : **`patient-product-request-actions.tsx`**, **`PatientRequestOutcomeBanner`**, **`demandes/[id]/page.tsx`**.
- **`lib/patient-archive-outcome-fr.ts`** conservé (utilitaires + fallback pharmacien).

**Étape 3 — Amendements & suivi validé** : **livré**.
- **`usePatientPharmaAmendmentCopy`** + clés **`demandes.amendmentResume`** / **`supplyAmendment`** (modale Résumé, détection amendements).
- **`useValidatedOriginLabel`**, pastilles ligne (**réservé / commandé / reçu**), chip CSS par **`key`** (compatible AR).
- **`patient-line-suivi-fr`** : hors parcours patient actif (pharmacien) — reporté.

**Étape 4 — Timelines dossier & lignes** : **livré**.
- Port **`TimelineCopyPort`** + hook **`usePatientTimelineCopy`** ; clés **`timeline.events`** (`lineBody`, `dossierMeta`, titres ligne/dossier, acteurs).
- **`build-dossier-timeline-fr`** + **`collect-line-events`** : corps des événements via `copy` (patient) ; dates + phases déjà localisées.
- UI : **`DossierHistoryListFr`**, hooks **`usePatientDossierTimeline`** / **`usePatientLineTimeline`**, modale historique ligne produit.

**Étape 5 — Relecture qualité AR** : **livré**.
- Auth OTP, annuaire (`onCall`), Mes pharmacies (`account`), parcours dossier (archives, amendements, timelines) — corrections fuites EN/FR et terminologie **فصحى**.
- RTL mobile : auth, hub demandes, annuaire pharmacies, choix produits répondu.

**Étape 6 — Hors pilote** (épiques séparées — prochaine doc si besoin)
- Descriptions catalogue **~19 677** lignes (BeautyMall HTML FR).
- SMS externes AR ; interface pharmacien AR ; URLs **`/ar/...`**.

**Phrase de reprise (étape 6 / fin pilote i18n patient)** :

**« Affinage i18n arabe patient §13.58 — étapes 1–5 livrées sur `fix/validated-supply-ecart-ui-modal`. Preview AR ou épique hors pilote (catalogue, SMS, pharmacien AR). Je te donne la tâche ou les retours. »**

### 13.63) Phrase de reprise (indépendance photos catalogue BeautyMall — juin 2026)

**« Pharmeto — indépendance photos catalogue BeautyMall. Lis **`docs/CATALOGUE-PHOTOS-INDEPENDANCE-BEAUTYMALL.md`** et dis-moi à quelle phase on en est (manifeste **`catalog/images/beautymall-download-manifest.json`**, comptage fichiers locaux, SQL **`photo_url`** BeautyMall vs Storage). **Phase 1** : `node --use-system-ca scripts/download-beautymall-catalog-images.mjs` (sauvegarde PC, pas Storage). **Phase 4 prod** : `node --use-system-ca scripts/attach-catalog-images.mjs --category beautymall_catalog`. Noms/descriptions déjà en base — seules les photos dépendent encore de BeautyMall. Branche courante possible : **`feature/product-search-relevance-rank`** ; migration **`20260822_001`** si pas appliquée. Je te donne la tâche ou les retours. »**

### 13.62) Phrase de reprise (recommandée — session **2026-06-14** pricing + abandon + admin + WhatsApp M2)

**« Pharmeto (`pharmeto.ma`) — reprise session **2026-06-14**. **Migrations Supabase** (ordre, si pas fait) : catalogue **`20260813_001`** → **`20260819_002`** ; WhatsApp **`20260817_001`** ; pricing visibilité **`20260820_001`** ; abandon pharmacien **`20260821_001`**. **Pricing patient (PR #352 mergée)** : modal validation = même PU que dossier (**`lib/patient-responded-line-pricing.ts`**) ; médicament = **PPV** toujours. **Pharmacien** : bouton **Abandonner le dossier** direct (**`pharmacist_abandon_request`**) sur validé/traité sans retrait comptoir. **Admin** : refonte espace pilote (**`/admin`**, demandes, officines). **WhatsApp M2 lot 1** : traité v2 + expiré + rappel — vars **`TWILIO_WHATSAPP_CONTENT_SID_TREATED` / `_EXPIRED` / `_REMINDER`** (**`docs/WHATSAPP-NOTIFS-REPRISE.md`**). Je te donne la tâche ou les retours preview. »**

### 13.61) Phrase de reprise (catalogue communautaire V1 seul — juin 2026)

**« Pharmeto — catalogue communautaire V1 livré (PR #342–#346, suite `feature/catalog-phase-c-admin` : Supprimer + marque liste). **Migrations** (ordre) : `20260813_001`, `20260815_001`, `20260816_001`, `20260818_001`, `20260819_001` (enum seul), `20260819_002`. Pharmacien : Mes produits + prix PPH/PPV + marge para ; patient : ligne manuelle ; admin : `/admin/produits-communautaires`. Hors scope V1 : notifs admin, photos Storage dédiées, dédoublonnage auto. Lis `AGENTS.md` (catalogue communautaire), `CONTEXTE.md` §2026-06-11. Je te donne la tâche ou les retours preview. »**

### 13.60) Phrase de reprise (dépassée — session **2026-06-11** passage horaires + CRM sans KPI)

**« Pharmeto (`pharmeto.ma`) — branche `fix/validated-supply-ecart-ui-modal` (commits **`77bccb7`**, **`5c651ad`**, **`57dc498`**). **Migrations Supabase** : **`20260811_001`** (SMS métier off, WhatsApp P0) puis **`20260812_001`** (passage vs horaires officine — appliquer avec RLS normal). **Passage patient** : ≥ **30 min** si aujourd’hui + heure ; jour fermé / hors créneaux bloqués UI + RPC ; **`lib/planned-visit-pharmacy-validation.ts`**. **Mes pharmacies / Clients** : liste = en-tête + recherche/filtres + cartes (**sans** KPI 3 colonnes). Lots antérieurs : annuaire pilote **§13.59**, i18n **§13.58**. Je te donne la tâche ou les retours preview. »**

### 13.59) Phrase de reprise (session **2026-06-10 (suite 2–3)** visibilité annuaire pilote)

**« Pharmeto (`pharmeto.ma`) — branche `fix/validated-supply-ecart-ui-modal` (commits **`b76bdec`**, **`d06520e`**, **`bdbfcc2`**). **Migrations Supabase** : **`20260718_001`** puis **`20260718_002`** (les deux obligatoires — le 002 corrige le seed `pilot_access` / `public_listed` si tout était resté à `false`). **Annuaire public** : **`pharmacies.public_listed = true`** → seule **AL JAZIRA** en prod ; Saad / Yassine BJ masquées sauf comptes **`pilot_access`**. **Annuaire app** : rechargement après déconnexion + filtre filet **`lib/annuaire/pilot-directory-access.ts`** ; déconnexion header = rechargement complet (**mobile**). **Comptes test** : admin MIASMO + 4 patients **`pilot_access = true`** ; **Noureddine SALAMI** → **`pilot_access = false`**. Admin : case **Visible dans l'annuaire public** à la création. Lots antérieurs : i18n **§13.58**, ville **§13.55**. Je te donne la tâche ou les retours preview. »**

### 13.57) Phrase de reprise (dépassée — après session **2026-06-09 (suite 4)**)

Voir **§13.58**.

**« On reprend Pharmeto (`pharmeto.ma`). Branche `fix/validated-supply-ecart-ui-modal` (commits **`58909d6`** scroll/hint date passage · **`2eed65a`**–**`04929df`** nom/ar/ville doc). **Migration** : **`20260716_001`** si pas appliquée (`nom_ar`, `adresse_ar`). **Validation `responded`** : date passage manquante ou hors plage → scroll bloc date + hint inline (**`visitDateRequiredToValidate`**) — pas bandeau haut seul. **Nom/adresse ar** : admin + ma fiche + patient AR (repli FR). **Ville** : **non livré** — **`§13.55`**. Lots antérieurs : **`§13.54`**. Je te donne la tâche ou les retours preview. »**

### 13.56) Phrase de reprise (dépassée — session **2026-06-09 (suite 3)**)

Voir **§13.57**.

**« On reprend Pharmeto (`pharmeto.ma`). Branche `fix/validated-supply-ecart-ui-modal` (commits **`2eed65a`** nom/adresse ar · **`d092794`** dossiers/hubs · **`8e8b47a`** fix Collator · **`e6eb40e`** i18n dossiers · **`6ddcbb6`** Plus Jakarta · **`04929df`** doc ville). **Migration** : **`20260716_001`** si pas appliquée (`nom_ar`, `adresse_ar`). **Nom/adresse ar** : admin + ma fiche + affichage patient AR (repli FR). **Ville** : **non livré** — spec **`§13.55`** (*Reprendre l'implémentation de la ville en arabe*). Lots antérieurs : drift/amendement/packs **`§13.54`**. Je te donne la tâche ou les retours preview. »**

### 13.55) Lot reporté — ville officine (liste admin + libellé arabe)

**Statut** : **livré** (2026-06-10, commit **`cff4fa4`**) — spec figée **§13.55** ; catalogue **`lib/pharmacy-cities-morocco.ts`**.

**Consigne utilisateur (reprise)** : *« Reprendre l'implémentation de la ville en arabe »* — lire cette section + **`AGENTS.md`** (paragraphe ville) ; **ne pas** refaire le lot **`nom_ar` / `adresse_ar`** (déjà livré, migration **`20260716_001`**).

**Objectif métier**
- **Admin** (onboarding + formulaire legacy **`AdminOnboardPharmacyForm`** / **`app/admin/page.tsx`**) : **`ville`** = **liste déroulante** (plus de saisie libre).
- **Pharmacien** (**Ma fiche → Coordonnées**) : même liste (valeur legacy hors catalogue conservée jusqu’à changement).
- **Patient / public** (locale **ar**) : afficher le **libellé arabe** de la ville si connue ; sinon repli sur le français stocké en base (comme **`nom_ar`**).
- **Pas de migration SQL** : colonne **`pharmacies.ville`** reste du texte FR canonique (ex. `Témara`, `Casablanca`).

**Implémentation prévue (spec figée)**
1. **`lib/pharmacy-cities-morocco.ts`** — catalogue `{ fr, ar }` (~35 villes/communes Maroc pilote) ; helpers :
   - `pharmacyCityLabel(ville, locale)`
   - `pharmacyCitySearchTerms(ville)` (annuaire + filtres hub)
   - `validatePharmacyCityForSubmit(ville, { allowLegacy? })`
   - `buildPharmacyCitySelectOptions(legacyValue?)`
2. **`components/pharmacy/pharmacy-city-select.tsx`** — `<select>` réutilisable (admin + ma fiche).
3. **Validation** : **`lib/admin-onboard-pharmacy.ts`**, **`lib/pharmacy-contact-fields.ts`** (`validatePharmacyContactForm` + option legacy ma fiche).
4. **Affichage patient** (brancher `pharmacyCityLabel`) : bandeau dossier, quick contact, hubs demandes/promo, annuaire, fiche publique, Mes pharmacies — miroir du lot **`nom_ar`** déjà fait.
5. **Piège build** : tri avec **`collatorForLocale(locale).compare(a, b)`** — **pas** `localeCompare(..., collator)`.

**Fichiers touchés lors de l’esquisse annulée** (référence reprise) :  
`AdminOnboardPharmacyForm.tsx`, `app/admin/page.tsx`, `pharmacy-ma-fiche-page.tsx`, `patient-demandes-hub.tsx`, `demande-hub-ui.tsx`, `patient-pharmacy-dossier-band.tsx`, `patient-pharmacy-quick-contact.tsx`, `annuaire-page.tsx`, `annuaire-pharmacy-card.tsx`, `pharmacy-public-info-tab.tsx`, `patient-pharmacy-detail.tsx`, `patient-promo-reservations-hub.tsx`, `promo-reservation-hub-card.tsx`, `patient-product-demande-hub-card.tsx`.

**Phrase de reprise (lot ville seul)** :

**« Reprendre l'implémentation de la ville en arabe — Pharmeto, branche `fix/validated-supply-ecart-ui-modal`. Spec **`CAHIER_DES_CHARGES.md` §13.55`**. Liste admin + ma fiche ; traductions AR intégrées dans le catalogue code ; affichage patient en locale ar. Migration **`20260716_001`** déjà appliquée (nom/adresse ar) — ne pas dupliquer. Livrer par petit commit + preview ; vérifier `npm run build` (Collator). »**

### 13.54) Phrase de reprise (dépassée — session **2026-06-09 (suite 2)** affinages preview)

Voir **§13.56**.

**« On reprend Pharmeto (`pharmeto.ma`). Branche `fix/validated-supply-ecart-ui-modal` (commits **`1330407`** lot initial · **`55336d2`** statut amendement · **`9768bda`** / **`f38c90b`** packs + ordonnances · **`f45728e`** libellé amendement). **Migrations** inchangées (**`20260715_001`** ancre). **Drift dossier** : **`RequestDetailStaleBanner`**, i18n **`demandes.drift`**, polling 5 s — bandeau **visible** patient **`confirmed → treated`** (consultation incluse). **Archives** : totaux **`demandes.archive.footer`**. **Ordonnances patient** : **`lib/patient-prescription-dossier-shell.ts`** (marge header→scan, stack scan/titre/bandeaux). **Hub packs promo** : tableau de bord = **tuiles seules** (`PromoStatDashboard`) ; cartes liste sans texte sous statut. **Amendement** : badge **Modifiée** + hint **« Modifiée par l'officine après votre validation »** + **Résumé** dans header. Rebrand + charte antérieurs : **§13.52** / **§13.51**. Je te donne la tâche ou les retours preview. »**

### 13.53) Phrase de reprise (dépassée — session **2026-06-09** retours UI initiaux)

Voir **§13.54**.

**« On reprend Pharmeto (`pharmeto.ma`). Branche `fix/validated-supply-ecart-ui-modal` (commit **`1330407`** retours UI). **Migrations** inchangées (**`20260715_001`** ancre). **Drift dossier** : **`RequestDetailStaleBanner`**, i18n **`demandes.drift`**, auto-refresh **`confirmed → treated`**, polling 5 s. **Archives** : totaux **`demandes.archive.footer`**. **Ordonnances patient** : espacements **`lib/patient-prescription-dossier-shell.ts`**. **Pharmacien répondue** : dispo adoucie (**`lib/pharmacist-availability-ui.ts`**). **Validée modifiée** : badge **Modifiée** + **Résumé** dans **`PatientProductRequestDossierHeader`**. **Hub packs promo** : cartes sans bloc sous statut. Rebrand + charte antérieurs : **§13.52** / **§13.51**. Je te donne la tâche ou les retours preview. »**

### 13.52) Phrase de reprise (dépassée — session **2026-06-08** rebrand Pharmeto)

Voir **§13.54**.

**« On reprend Pharmeto (`pharmeto.ma`). Branche `fix/validated-supply-ecart-ui-modal` (commits **`18163bd`** rebrand, **`a330fef`** logo PNG, **`2671f5a`** OG, **`478dec1`** header + annuaire interactif). **Migrations** si pas fait : **`20260714_001`** → **`20260715_001`**. **Marque** : **`PharmetoLogo`** + **`public/brand/pharmeto-icon.png`** (500×500 transparent) ; header lockup **40 px** ; hero **« Annuaire interactif des pharmacies »** ; OG **`app/opengraph-image.tsx`**. **Infra prod** : domaine + Resend Verified + notif e-mail **Pharmeto** OK ; **SMS réception** reporté. Lots antérieurs : charte pharmacien sky/amber/violet/emerald + barre basse (**§13.51**). Je te donne la tâche ou les retours preview. »**

### 13.51) Phrase de reprise (dépassée — session **2026-06-07** charte pharmacien + barre basse)

Voir **§13.52**.

**« On reprend ProxiPharma. Branche `fix/validated-supply-ecart-ui-modal` (commits **`f2875c0`** consultations violet pharma, **`8e718f6`** ordonnances amber + packs emerald, **`6ee6630`** / **`e910c29`** sky produits, **`64b8d13`** barre basse). **Migrations** si pas fait : **`20260709_001`** → **`20260713_001`**. **Pharmacien** : hubs + dossiers **sky** (produits), **amber** (ordonnances), **violet** (consultations), **emerald** (packs) — cartes riches, bandeau patient RPC, coquilles dossier ; **barre basse** 4 onglets. **Patient** : bandeau officine avec ref pharmacie ; menu profil sans Annuaire/Notifications (cloche OK). Pas de migration Git pour ce lot. Je te donne la tâche ou les retours preview. »**

### 13.50) Phrase de reprise (dépassée — session **2026-06-06 (suite 9)** hub réservations packs promo)

Voir **§13.51**.

**« On reprend ProxiPharma. Branche `fix/validated-supply-ecart-ui-modal` (commits **`fbe2445`** hub packs promo, **`91c6edc`** lint). **Migrations** si pas fait : **`20260709_001`** → **`20260713_001`**. **Packs promo** : hubs patient **`/dashboard/patient/packs-promo`** et pharmacien **`/dashboard/pharmacien/reservations-packs`** — tableau de bord + liste (5 statuts, cartes hub, filtres) ; préfixe **Pharmacie** sur nom officine (cartes, détail, notifs patient). Workflow RPC inchangé. Lots antérieurs : explorateur catalogue (**§13.49**), modale photo (**§13.48**). Je te donne la tâche ou les retours preview. »**

### 13.49) Phrase de reprise (dépassée — session **2026-06-06 (suite 8)** explorateur UX compact + scroll infini)

Voir **§13.50**.

**« On reprend ProxiPharma. Branche `fix/validated-supply-ecart-ui-modal` (commits **`bd9b310`** toolbar explorateur, **`d7622d6`** scroll infini). **Migrations** si pas fait : **`20260709_001`** → **`20260713_001`**. **Explorateur catalogue** : barre unique recherche/filtres, marque en modale, liste scrollable plein écran, pagination 60/lot. Lots **`4989304`** / **`aea9fd4`** : lignes RTL + modale photo (**§13.48**). Je te donne la tâche ou les retours preview. »**

### 13.48) Phrase de reprise (dépassée — session **2026-06-06 (suite 7)** lignes RTL + modale photo catalogue)

Voir **§13.49**.

**« On reprend ProxiPharma. Branche `fix/validated-supply-ecart-ui-modal` (commits **`4989304`** lignes RTL, **`aea9fd4`** modale photo). **Migrations** si pas fait : **`20260709_001`** → **`20260713_001`**. **UI patient** : lignes produit flex + RTL (qté / message / prix) ; **modale photo** : vraie photo si URL, cadrage sans chevauchement description. Explorateur catalogue filtres type/marque (**§13.47**). Je te donne la tâche ou les retours preview. »**

### 13.47) Phrase de reprise (dépassée — session **2026-06-06 (suite 6)** explorateur catalogue patient)

Voir **§13.49**.

**« On reprend ProxiPharma. Branche `fix/validated-supply-ecart-ui-modal` (commits **`fe3921f`** filtres catalogue type/marque, **`4989304`** lignes RTL). **Migrations** si pas fait : **`20260709_001`** → **`20260713_001`**. **Explorateur catalogue patient** : filtres parapharmacie / médicament + marque searchable, cartes produit refaites, i18n FR/AR. **Catalogue** : **~19 677** lignes ; pricing onglet **Marques** (recherche marques pharmacien). Lots antérieurs : i18n complet (**§13.46**), consultation (**§13.43**). Je te donne la tâche ou les retours preview. »**

### 13.46) Phrase de reprise (dépassée — session **2026-06-06 (suite 5)** couverture i18n patient vagues 1–6)

Voir **§13.49**.

**« On reprend ProxiPharma. Branche `fix/validated-supply-ecart-ui-modal`. **Migrations** si pas fait : **`20260709_001`** (notifs in-app ar) puis **`20260710_001`** → **`20260713_001`**. **i18n patient ar/fr — couverture complète** : cookie `pp_locale`, switcher header, RTL, **`messages/fr` + `messages/ar`** (`.ts`), CI **`i18n:parity`** ; conversation, pages publiques demande, hubs, détail dossier, paramètres, dates locale ; pharmacien/admin et SMS restent FR. **Catalogue** : **~19 677** lignes (BeautyMall + médicaments), marques para **~93,65 %**, pricing onglet **Marques**. Lots antérieurs : catalogue/vignettes (**§13.45**), consultation (**§13.43**), vocaux. Je te donne la tâche ou les retours preview. »**

### 13.45) Phrase de reprise (dépassée — session **2026-06-06 (suite 4)** catalogue médicaments + marques v2.1)

Voir **§13.46**.

**« On reprend ProxiPharma. Branche `fix/validated-supply-ecart-ui-modal` (commits **`fae90d9`** marques v2.1, **`7f6f675`** import médicaments). **Migrations** si pas fait : **`20260710_001`** → **`20260713_001`**. **Catalogue pilote Supabase** : **13 651** parapharmacie BeautyMall + **6 026** médicaments officine (Excel TVA=0, **`scripts/README-medicaments-officine.md`**) ≈ **19 677** lignes ; marques para **~93,65 %** (**`scripts/README-product-brands.md`**). **Pricing** : médicament = PPV fixe ; para = PPH + marge, onglet **Marques** pharmacien. Lots antérieurs : archive ordonnance annulée (**§13.44**), consultation lot 3 (**§13.43**), i18n ar/fr, vocaux. Je te donne la tâche ou les retours preview. »**

### 13.44) Phrase de reprise (dépassée — session **2026-06-06 (suite 3)** archive ordonnance annulée + marques/pricing)

Voir **§13.45**.

**« On reprend ProxiPharma. Branche `fix/validated-supply-ecart-ui-modal` (commits **`56bc5bc`** archive ordonnance annulée sans lignes, **`640346c`** marques + pricing officine par marque). **Migrations à appliquer** si pas fait : **`20260710_001`** → **`20260713_001`** (après **`20260712_001`**). **Ordonnance archive annulée/abandonnée/expirée** avant saisie produit : bandeau dossier + scan + lien annuaire (plus de fiche vide). **Marques** : **`ProductBrandLabel`**, onglet **Marques** pricing pharmacien. Lots antérieurs : consultation lot 3 (**§13.43**), i18n ar/fr, vocaux. Catalogue BeautyMall : **§13.39**. Je te donne la tâche ou les retours preview. »**

### 13.43) Phrase de reprise (dépassée — session **2026-06-06** consultation lot 3 + photos patient)

Voir **§13.44**.

**« On reprend ProxiPharma. Branche `fix/validated-supply-ecart-ui-modal` (commits **`428d662`** scroll/édition/lightbox, **`718913f`** brief replié + save unique, **`bf9b94f`** photos compress-before-check). **Migrations à appliquer** si pas fait : **`20260711_001`** → **`20260712_001`** (après **`20260709_001`**). **Consultation patient** : fil conversation scroll chaining ; **`ConsultationBriefPanel`** replié + **Enregistrer les modifications** (texte + photos) jusqu’à **`responded`** ; bulle **Modifié le…** ; lightbox **`ConsultationPhotoLightbox`** ; **une seule notif** pharmacien à l’envoi avec photos. **Photos** ordonnance/consultation : **`lib/patient-request-photo-upload.ts`** (compresser puis valider, plus faux rejet 8 Mo brut). Lots antérieurs : i18n ar/fr (**§13.42**), vocaux, ordonnance pharma. Catalogue BeautyMall : **§13.39**. Je te donne la tâche ou les retours preview. »**

### 13.42) Phrase de reprise (dépassée — session **2026-06-05 (suite 3)** i18n patient + fix ordonnance validée)

Voir **§13.43**.

**« On reprend ProxiPharma. Branche `fix/validated-supply-ecart-ui-modal`. **Migrations à appliquer** si pas fait : **`20260705_001`** → **`20260709_001`** (dernière **`20260709_001`** = notifs in-app ar). **i18n patient ar/fr** : cookie `pp_locale`, switcher header, RTL, `messages/fr` + `messages/ar` ; pharmacien/admin restent FR ; SMS externes FR. **Ordonnance validée** : dispo **À commander** → champ **Réception prévue** visible en édition supply. Lots antérieurs : vocaux (**`cb90da3`**, **`ea54827`**, **`20260706_001`**), consultation UX (**`081fc02`**, **`c507609`**), ordonnance pharma (**`6cb3160`**). Catalogue BeautyMall : **§13.39**. Je te donne la tâche ou les retours preview. »**

### 13.41) Phrase de reprise (dépassée — session **2026-06-05 (suite)** vocaux envoi initial + consultation UX lot 2 + ordonnance pharma)

Voir **§13.42**.

**« On reprend ProxiPharma. Branche `fix/validated-supply-ecart-ui-modal` (commits **`081fc02`** consultation UX, **`6cb3160`** ordonnance pharma, **`cb90da3`** vocal envoi initial, **`fa897de`** MIME audio, **`ea54827`** vocaux fil, **`c507609`** consultation lot 1). **Migrations à appliquer** si pas fait : **`20260705_001`** → **`20260706_001`** → **`20260707_001`** → **`20260707_002`** → **`20260708_001`**. **Vocaux** : **30 s max** — fil dossier (`ConversationComposer`) + saisie initiale patient (`ConversationMessageDraftField` sur demande produits / ordonnance / consultation libre). **Consultation** : fil scrollable + auto-scroll ; après réponse pharma → onglet **Produits** ; pas de badge « Produit » sur lignes ; archive = bandeau dossier seul. **Ordonnance pharma** : retours saisie/réponse (zoom scan, drift patient). Catalogue BeautyMall : **§13.39** / **`736100f`**. Je te donne la tâche ou les retours preview. »**

### 13.40) Phrase de reprise (dépassée — session **2026-06-05** lot 1)

Voir **§13.41**.

**« On reprend ProxiPharma. Branche `fix/validated-supply-ecart-ui-modal` (commits **`ea54827`** vocaux, **`c507609`** consultation libre). **Migrations à appliquer** si pas fait : **`20260705_001`** puis **`20260706_001`**. **Consultation libre** : en-têtes dossier, scroll conversation, annulation footer, refresh notif, cartes lignes neutres. **Conversation** : messages vocaux optionnels **30 s max** (`ConversationComposer`, Storage `conversation-audio/`). **Ordonnance archive clôturée patient** : bandeau dossier seul (plus de récap header doublon). Catalogue BeautyMall : **§13.39** / **`736100f`**. UI ordonnances actives : **§13.37** / **`112b679`**. Je te donne la tâche ou les retours preview. »**

### 13.39) Phrase de reprise (recommandée — après session **2026-06-04 (suite 2)** catalogue importé + aperçu photo)

**« On reprend ProxiPharma. Branche `fix/validated-supply-ecart-ui-modal` (commit **`736100f`**). **Catalogue BeautyMall** importé en pilote : **13 651** produits (`scripts/import-beautymall-catalog.mjs` + wipe `supabase/scripts/wipe-catalog-beautymall-import.sql`) ; photos URL externes ; **`full_description`** HTML. **UI** : vignette produit cliquable partout patient/pharmacien → modale photo + description (`PatientProductPhotoPreviewModal`, `PharmacistProductPhotoThumb`, `lib/product-description-html.ts`). Chaîne CSV : §0.1 + `scripts/README-beautymall-catalog.md` + §10 sessions **2026-06-04** et **(suite 2)**. Migrations Git : inchangées (**`20260703_002`**). UI ordonnances : §13.37 / **`721c991`**. Je te donne la tâche ou les retours preview. »**

### 13.38) Phrase de reprise (dépassée — session **2026-06-04** catalogue BeautyMall CSV seul)

Voir **§13.39** (import Supabase + aperçu photo effectués).

### 13.37) Phrase de reprise (UI demandes — session **2026-06-03 suite 4** ordonnances + outils vidage test)

**« On reprend ProxiPharma. Branche `fix/validated-supply-ecart-ui-modal` (dernier lot **2026-06-03 suite 4** : **ordonnances** = même UI que demandes produits — thème **ambre**, libellés **Ordonnance** / **qté prescrite**, historique saisie officine, hubs cartes produits, scan pharmacien au-dessus des lignes en saisie ; commit **`721c991`**. Lots antérieurs : **`5db38f8`** hub priorités + libellés pharmacien, **`2960d23`** bandeau patient officine). Lis `CONTEXTE.md` §6, `AGENTS.md`, `CAHIER_DES_CHARGES.md` §0.1, **§4.6**, **§10** (session **2026-06-03 suite 4**), §11. **Supabase pilote : migrations** jusqu’à **`20260703_002`**. **Vidage tests demandes** : SQL `supabase/scripts/clear-all-requests.sql` puis `clear-request-private-media.mjs --confirm` (voir §0.1). Fichiers clés : `prescription-ui-copy.ts`, `request-kind-ui-theme.ts`, `patient-product-request-actions.tsx`, `app/dashboard/pharmacien/demandes/[id]/page.tsx`, `prescription-scan-collapsible.tsx`. **Prochain jalon** : retours preview. Je te donne la tâche ou les retours. »**

### 13.36) Phrase de reprise (dépassée — session **2026-06-03 suite 3** demande produits patient + pharmacien)

**« On reprend ProxiPharma. Branche `fix/validated-supply-ecart-ui-modal` (dernier lot **2026-06-03 suite 3** : pharmacien **validée / traitée / archives** — cartes et groupes alignés patient, footer mobile, traitée sans bandeau Suivi ; patient — bandeau **`PatientPharmacyDossierBand`** avec icône officine, **Contacter**, **Itinéraire**, **Voir la fiche** ; hint footer en portail). Dernier commit **`2960d23`**. Lots antérieurs : **`773ad62`** parcours pharmacien épuré, **`6ad4f84`** archives pharma, parcours patient §4.6 **`978f862`**–**`f29e073`**. Lis `CONTEXTE.md` §6, `AGENTS.md`, `CAHIER_DES_CHARGES.md` §0.1, **§4.6**, **§10** (session **2026-06-03 suite 3**), §11. **Supabase pilote : migrations appliquées** jusqu’à **`20260630_001`**. Fichiers clés : `patient-pharmacy-dossier-band.tsx`, `pharmacist-supply-compact-line.tsx`, `pharmacist-closed-archive-line.tsx`, `pharmacist-closed-product-buckets-view.tsx`, `components/ui/info-hint.tsx`, `app/dashboard/pharmacien/demandes/[id]/page.tsx`, `app/dashboard/demandes/[id]/page.tsx`. **Prochain jalon** : retours preview. Je te donne la tâche ou les retours. »**

### 13.34-ancien) Phrase de reprise (historique — session **2026-06-02 suite 2**)

**« On reprend ProxiPharma. Branche `fix/validated-supply-ecart-ui-modal` (dernier lot **`773ad62`** : parcours **pharmacien** demandes produits épuré — en-tête dossier, groupes validés/archives alignés patient, cartes compactes neutres, bandeaux et redondances retirés ; lots **`e660dff`** alternatives patient sans présélection + barre « Retenir cette alternative », **`f29e073`** archives patient, **`978f862`**–**`6d9990b`** répondue/validée patient §4.6). Patient : parcours **envoyée→traitée** abouti (couleurs indicatives, modales `AppModalOverlay`). Pharmacien : détail produit même clarté ; logique supply/post-validé inchangée. Lis `CONTEXTE.md` §6, `AGENTS.md`, `CAHIER_DES_CHARGES.md` §0.1, **§4.6**, **§10** (session **2026-06-02 suite 2**), §11. **Supabase pilote : migrations appliquées** jusqu’à **`20260630_001`**. Fichiers clés : `patient-product-request-actions.tsx`, `patient-responded-line-chooser.tsx`, `app/dashboard/pharmacien/demandes/[id]/page.tsx`, `pharmacist-supply-compact-line.tsx`, `pharmacist-validated-bucket-section.tsx`. **Prochain jalon** : retours preview terrain ; ordonnances/consultations pharmacien si besoin. Je te donne la tâche ou les retours. »**

### 13.35) Phrase d’ouverture **contexte seul** (recommandée — juin 2026)

À coller en **premier message** d’un **nouveau chat** quand tu veux recharger le contexte **sans** lancer de travail : l’agent **lit** puis **attend** ta consigne.

**« Pharmeto (`pharmeto.ma`) — reprise de contexte uniquement. Branche de travail courante : **`main`** (dernier lot journal §10 **2026-06-14** — pricing patient PR #352, abandon pharmacien, admin pilote, WhatsApp M2 lot 1). Refonte UX Glovo-like **abandonnée** (branche **`design/ux-refonte-2026`** supprimée — voir §10 **2026-06-01**) ; UI/UX = affinages incrémentaux. Supabase pilote : migrations jusqu’à **`20260821_001`** ; annuaire public = **Al Jazira seule** ; catalogue **~19 677** produits. Lis `CONTEXTE.md` §6, `AGENTS.md`, `CAHIER_DES_CHARGES.md` §0.1, dernier §10 Journal, §11 et **§13.62**. Ne modifie aucun fichier, n’applique aucune migration et ne propose aucun changement tant que je n’ai pas donné une consigne explicite. Réponds par un bref récap, puis attends ma précision. »**

### 13.28-ancien) Phrase de reprise (dépassée — session **2026-05-22** fiche seule)

**« On reprend ProxiPharma. Branche `fix/validated-supply-ecart-ui-modal` (commits **`60c543b`**+ : **`0094611`** supply post-validé, **`9862128`** fiche + photos). Migrations jusqu’à **`20260608_001`**. Voir **§13.28** actuelle pour promo + horaires + **`20260610_001`**. »**

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
