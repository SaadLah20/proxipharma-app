<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

Demande « produits » (MVP), ordre d’affinage UI par statut et règles dossiers figés : **`CAHIER_DES_CHARGES.md` §4.6**.

Après validation patient : le dossier reste **`confirmed`** pendant la saisie réservé/commandé, puis **`treated`** dès que la pharmacie valide la préparation pour le comptoir (RPC **`pharmacist_mark_request_treated`**), colonne **`request_items.withdrawn_after_confirm`**, table **`request_supply_amendments`** et RPC associées — voir **`CAHIER_DES_CHARGES.md` §4.4** et migrations **`20260508_002_processing_treated_supply_workflow.sql`**, **`20260512_002_remove_request_processing_status.sql`**. Le hub affiche **`in_progress_virtual`** quand le dossier est **`confirmed`** avec **`post_confirm_fulfillment`** avancé sur au moins une ligne retenue.

**UI patient (mai 2026, branche `fix/rls-recursion` ou lot demandes sur `fix/validated-supply-ecart-ui-modal`)** — détail demande produits : après **`responded`**, ordre des lignes **`request_items`** comme la pharmacie ; libellé **`responded`** · **« Répondue - à valider »** ; réponse figée côté officine sans **Réagir** tant que pas **Modifier** ; message global pharmacien via **`request_comments`** ; hubs liste : cartes compactes + **`updated_at`** ; une fois **`confirmed` / `treated`** : cartes courtes sur les **lignes validées** (groupement réservation / commande), **lignes non retenues** en **`<details>`** fermé par défaut, **Historique** par produit (modal + **`lib/build-patient-line-timeline-fr.ts`**, enrichi par **`request_status_history`** chargé en parallèle du détail dans **`page.tsx`**). Bandeau **Suivi** (réservation / commande / **`arrived_reserved`**) + ligne **Comptoir** : **`lib/patient-line-suivi-fr.ts`** · **`PatientLineSuiviStrip`** pour **`confirmed`** et **`treated`**. Dossiers **terminés** (`cancelled`, `abandoned`, `expired`, `completed`, `partially_collected`, `fully_collected`) : bloc **`PatientRequestOutcomeBanner`** en tête + même grille de cartes compactes en **lecture seule** (**`ReadonlyArchivedProductBucketsView`** dans **`PatientProductRequestActions`**), **`request_status_history`** aussi chargé sur ces statuts. Badge **« Ajout officine »** : seulement **`pharmacist_proposed`** + amendement **`line_added_after_confirm`** (**`lib/supply-line-post-confirm.ts`**).

**Sauvegarde pharmacien post-validé** — **`post_confirm_fulfillment`** : envoyer l’enum **`unset`**, jamais **`null`** (colonne NOT NULL) ; le clamp à l’enregistrement suit la dispo **déduite du brouillon** (même règle que **`buildItemUpdatePayload`** / **`effectiveAvailSupplyDraft`**, y compris avec **alternative choisie** — **`inferredAvailabilityForPostConfirmClamp`** dans **`app/dashboard/pharmacien/demandes/[id]/page.tsx`**).

**UI pharmacien post-validé** — **`app/dashboard/pharmacien/demandes/[id]/page.tsx`** + **`components/pharmacist/pharmacist-supply-compact-line.tsx`** : brouillon (réservé/commandé, écart, comptoir **en attente / récupéré**) validé par **Enregistrer les modifications** ; pas d’auto-save comptoir sur cette vue compacte ; migrations **`20260509_001`** / **`20260509_002`** si infra à jour.

**UI pharmacien — note / échange par ligne** — **`components/pharmacist/pharmacist-line-conversation-chip.tsx`** (`PharmacistLineConversationModal` sur **`app/dashboard/pharmacien/demandes/[id]/page.tsx`**) : **Confirmer la note** valide le texte saisi dans **`pharmacist_comment`** (pas de raccourci qui insère `"OK"`). Envoi patient = **publier la réponse** dossier.

**Fiche digitale pharmacie (mai 2026)** — **`CAHIER_DES_CHARGES.md` §10 (session 2026-05-22)** + **§13.28**. Migrations **`20260606_001`** · **`20260607_001`** · **`20260608_001`** · **`20260609_001`** (RLS Storage noms versionnés — **obligatoire** si erreur upload « row-level security » après `20260528_001`). Publique **`/pharmacie/[id]`** : onglets grille 4 col., Infos (`pharmacy-profile-contact-grid.tsx`), Horaires, **`PharmacyRatingForm`** (note compacte après vote). Pharmacien **`ma-fiche`** : upload **couverture** / **logo** → chemins **`pharmacies/{id}/cover-{ms}.webp`** | `logo-{ms}.webp` (**`lib/pharmacy-media.ts`**, spec **`lib/pharmacy-cover-spec.ts`** 21:9) · **`horaires-garde`**. Storage : **`20260524_001`** + **`20260528_001`** + **`20260609_001`**.

**Supply post-validé (mai 2026)** — **`app/dashboard/pharmacien/demandes/[id]/page.tsx`** (commit **`0094611`**) : qté validée + brouillon au reload ; ajouts officine **`confirmed`/`treated`** en **`pendingProposalRows`** jusqu’à Enregistrer.

**Ne pas réécrire tout le détail produit** sans relire **`CONTEXTE.md` §6** et **`CAHIER_DES_CHARGES.md` §4.4–§4.5 + dernier §10 Journal + §13.28** (phrase de reprise ; §13.12 / **`20260509_*`** pour supply post-validé). Pour une **ouverture sans tâche** : **`CAHIER_DES_CHARGES.md` §13.11**.

**Catalogue & photos (mai 2026)** — **`lib/storage-media.ts`**, **`lib/patient-demande-produits-draft.ts`**, **`/pharmacie/[id]/demande-produits/catalogue`** ; vignettes = chemins Storage résolus en URL publique (pas `<img src="products/…">` relatif). Merge **`main`** + migrations **`20260524_*`** pour prod.

**Types de demande (registre)** — **`lib/request-kinds/`** : config par type (`product_request`, `prescription`, `free_consultation`) — thème header, routes hubs, capacités, refs **D/O/C**. Workflow commun → **`lib/request-kinds/shared-capabilities.ts`** + **`lib/demandes-hub-buckets.ts`**. **Ordonnances** : après réponse = parcours demande produits ; saisie scan = **`PHARMACIST_AVAILABILITY_OPTIONS`** (indispo / rupture OK) via **`pharmacistAvailabilityOptionsForLine`** + modal ordonnance ; badges **Ordonnance** / **Proposé** ; ajout post-validé → **`request_supply_amendments`** + badge **« Ajouté après validation »** (`lib/supply-line-post-confirm.ts`). **Consultation libre** : détail **scroll unique** (brief + **`RequestConversationInline`** + lignes) ; recherche catalogue pharma : **`propCatalogSearchActive`** inclut **`free_consultation`** (formulaire sans accordéon). **Patient `responded`** : qté **Proposé** = `available_qty` (y compris alternatives — **`maxQtyAlt`**) ; peut diminuer. **Post-validé** : cartes = **`selected_qty`** ; amendement qté officine → sync **`selected_qty`** à l’enregistrement pharmacien. Anti-doublon catalogue : **`lib/pharmacist-request-catalog-product-block.ts`**. Migrations : **`20260603_001`**, **`20260604_001`** (notif patient mise à jour validée). Phrase de reprise : **`CAHIER_DES_CHARGES.md` §13.26**.

**Livraison (utilisateur non dev)** — `.cursor/rules/delivery-workflow-user.mdc` : l’agent fait branche + **PR vers `main`** + commit/push ; l’utilisateur attend la **preview Vercel**, teste, puis **Merge** sur GitHub. Après merge d’une PR, rouvrir une PR pour la suite sur la branche (sinon pas de preview auto).

**Développement** : le pilote est **toujours en dev** — si une correction est nettement plus simple en **réinitialisant les données** (script reset demandes / base de test), **demander explicitement** une vidage plutôt que d’empiler migrations ou branches SQL uniquement pour préserver des jeux obsolètes.

**Auth locale (SMS / Supabase)** : tester **`/auth`** dans **Chrome ou Edge** (fenêtre système), **pas** le navigateur intégré / Simple Browser de l’IDE — stockage, cookies et requêtes vers **`*.supabase.co`** y sont souvent incomplets ; si ça marche dans Chrome, le flux est en général correct.

**Auth patient (mai 2026)** — **`app/auth/page.tsx`** :
- **Connexion** (`/auth`) : un champ **téléphone ou e-mail** + mot de passe (`lib/auth-login-identifier.ts`, `signInWithPassword`).
- **Inscription** (`/auth?mode=signup`) : nom + téléphone + e-mail facultatif → **OTP** (souvent **SMS** ; au pilote peut arriver via **WhatsApp** selon config Supabase/Twilio Verify) → mot de passe → session (`lib/ensure-patient-profile.ts`, `lib/phone-e164.ts`). Numéros **pro** : SMS Verify souvent **Failed** — tester en **perso** (`+2126…`).
- E-mail récupération : **`/auth/update-password`** ; opt-in e-mail aussi dans **`app/dashboard/patient/parametres/page.tsx`**.
- Migration **`20260521_001_profiles_email_nullable.sql`** : `profiles.email` nullable.
- Unicité : **téléphone / e-mail** uniques côté **`auth.users`** (Supabase) ; doublons possibles dans **`profiles.whatsapp`** sur comptes **legacy** (e-mail avant SMS).
- **Inscription** : avant envoi OTP, **`POST /api/auth/signup-phone-check`** + **`auth_phone_user_exists`** (**`20260522_003`**) — pas de SMS si le numéro est déjà dans **`auth.users`** ; message « utilisez Connexion ». **Renvoi OTP** : `shouldCreateUser: false`. Doublons historiques même téléphone en pilote : reset demandes + suppression comptes Auth.

**Notifications hors-app (e-mail + SMS)** :
- File SQL : **`notification_external_queue`**, prefs **`notification_external_prefs`**, trigger sur **`app_notifications`** (`20260505_001`). SMS/WhatsApp : destination = **`profiles.whatsapp`** (E.164).
- Workers : **`send-external-emails`**, **`send-external-sms`**, **`/api/webhooks/dispatch-external-sms`** (principal, ~secondes) ; **`lib/external-notification-queue-worker.ts`** (SMS 1 tentative, texte court anti **Twilio 30007**, `SMS_BLOCKED_DESTINATIONS`).
- **SMS pilote (patient uniquement)** : enqueue **`request_status:responded`** et **`request_status:treated`** seulement (**`20260522_001`**, **`20260522_002`**). Pas de SMS pharmacien (UI prefs **`variant="pharmacien"`**). Texte : `ProxiPharma: {officine} a repondu. Dossier {request_public_ref}.` / `… a traite le dossier {ref}.` — ASCII, 1 segment, ref **`D042/26`** (pas le libellé type « Demande de produits »).
- **Destination notif SMS** : **`profiles.whatsapp`** (E.164) — pas `auth.users.phone` (legacy e-mail OK sans téléphone Auth).
- **Vercel** : `TWILIO_*` + `TWILIO_SMS_FROM` (ex. `+19789813065`, API Messages) ; `SMS_BLOCKED_DESTINATIONS` pour numéros test invalides.
- **Webhook Supabase** (INSERT file, même URL) = **e-mail + SMS rapides** (canal de la ligne insérée). Cron GitHub = filet (~5 min). E-mail = lien complet ; **SMS = sans URL** (30007 si lien long).
- Détail / reprise : **`RUNBOOK.md` §9**, **`CAHIER_DES_CHARGES.md` §10 (2026-05-16 + 2026-05-22)**, phrase **§13.16**.

**Notifications WhatsApp (en cours, pas encore de worker)** :
- **Étape 1 (infra, avant code)** : Meta Business + expéditeur WhatsApp via Twilio ; test manuel **template** depuis la console ; **ne pas** utiliser **MM Lite** pour messages utilitaires (erreur Twilio **63055** → envoyer via **Cloud API**, modèles catégorie **Utility** pour statuts demande).
- **Numéro SMS USA Twilio ≠ expéditeur WhatsApp** ; **pas** d’envoi API depuis le WhatsApp perso du pharmacien — liens **`wa.me`** OK sans Meta Business.
- **Prochaine étape code** : variables d’env + route test d’envoi template, puis worker cron `channel=whatsapp` (sur le modèle Resend).

**Expiration `responded`** : cron **`service_role`** / **`/api/cron/expire-overdue-requests`** sur **`expire_overdue_requests()`** ; défaut **24 h** après **`responded_at`** (**`20260523_001`** ; surcharge Vercel **`EXPIRE_RESPONDED_SILENCE`**). **`abandon_unconfirmed_responded_requests()`** = alias.

**Notifications in-app** : marquage comptoir **`counter_outcome:picked_up`** → **aucune** insertion **`app_notifications`** (**`20260515_001`**). Libellés patient : **`20260514_001`** (surcharges **`_in_app_notification_patient`**).
