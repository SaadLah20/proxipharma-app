<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

Demande « produits » (MVP), ordre d’affinage UI par statut et règles dossiers figés : **`CAHIER_DES_CHARGES.md` §4.6**.

Après validation patient : le dossier reste **`confirmed`** pendant la saisie réservé/commandé, puis **`treated`** dès que la pharmacie valide la préparation pour le comptoir (RPC **`pharmacist_mark_request_treated`**), colonne **`request_items.withdrawn_after_confirm`**, table **`request_supply_amendments`** et RPC associées — voir **`CAHIER_DES_CHARGES.md` §4.4** et migrations **`20260508_002_processing_treated_supply_workflow.sql`**, **`20260512_002_remove_request_processing_status.sql`**. Le hub affiche **`in_progress_virtual`** quand le dossier est **`confirmed`** avec **`post_confirm_fulfillment`** avancé sur au moins une ligne retenue.

**UI patient (mai 2026, branche `fix/rls-recursion` ou lot demandes sur `fix/validated-supply-ecart-ui-modal`)** — détail demande produits : après **`responded`**, ordre des lignes **`request_items`** comme la pharmacie ; libellé **`responded`** · **« Répondue - à valider »** ; réponse figée côté officine sans **Réagir** tant que pas **Modifier** ; message global pharmacien via **`request_comments`** ; hubs liste : cartes compactes + **`updated_at`** ; une fois **`confirmed` / `treated`** : cartes courtes sur les **lignes validées** (groupement réservation / commande), **lignes non retenues** en **`<details>`** fermé par défaut, **Historique** par produit (modal + **`lib/build-patient-line-timeline-fr.ts`**, enrichi par **`request_status_history`** chargé en parallèle du détail dans **`page.tsx`**). Bandeau **Suivi** (réservation / commande / **`arrived_reserved`**) + ligne **Comptoir** : **`lib/patient-line-suivi-fr.ts`** · **`PatientLineSuiviStrip`** pour **`confirmed`** et **`treated`**. Dossiers **terminés** (`cancelled`, `abandoned`, `expired`, `completed`, `partially_collected`, `fully_collected`) : bloc **`PatientRequestOutcomeBanner`** en tête + même grille de cartes compactes en **lecture seule** (**`ReadonlyArchivedProductBucketsView`** dans **`PatientProductRequestActions`**), **`request_status_history`** aussi chargé sur ces statuts. Badge **« Ajout officine »** : seulement **`pharmacist_proposed`** + amendement **`line_added_after_confirm`** (**`lib/supply-line-post-confirm.ts`**).

**Sauvegarde pharmacien post-validé** — **`post_confirm_fulfillment`** : envoyer l’enum **`unset`**, jamais **`null`** (colonne NOT NULL) ; le clamp à l’enregistrement suit la dispo **déduite du brouillon** (même règle que **`buildItemUpdatePayload`** / **`effectiveAvailSupplyDraft`**, y compris avec **alternative choisie** — **`inferredAvailabilityForPostConfirmClamp`** dans **`app/dashboard/pharmacien/demandes/[id]/page.tsx`**).

**UI pharmacien post-validé** — **`app/dashboard/pharmacien/demandes/[id]/page.tsx`** + **`components/pharmacist/pharmacist-supply-compact-line.tsx`** : brouillon (réservé/commandé, écart, comptoir **en attente / récupéré**) validé par **Enregistrer les modifications** ; pas d’auto-save comptoir sur cette vue compacte ; migrations **`20260509_001`** / **`20260509_002`** si infra à jour.

**Ne pas réécrire tout le détail produit** sans relire **`CONTEXTE.md` §6** et **`CAHIER_DES_CHARGES.md` §4.4 + dernier §10 Journal + §13.12** (phrase de reprise type ; §13.10 reste valable pour le lot **`20260509_*`**). Pour une **ouverture sans tâche** (aucune implémentation avant consigne explicite) : **`CAHIER_DES_CHARGES.md` §13.11**.

**Développement** : le pilote est **toujours en dev** — si une correction est nettement plus simple en **réinitialisant les données** (script reset demandes / base de test), **demander explicitement** une vidage plutôt que d’empiler migrations ou branches SQL uniquement pour préserver des jeux obsolètes.

**Auth locale (SMS / Supabase)** : tester **`/auth`** dans **Chrome ou Edge** (fenêtre système), **pas** le navigateur intégré / Simple Browser de l’IDE — stockage, cookies et requêtes vers **`*.supabase.co`** y sont souvent incomplets ; si ça marche dans Chrome, le flux est en général correct.

**Auth patient (mai 2026)** — **`app/auth/page.tsx`** :
- **Connexion** (`/auth`) : un champ **téléphone ou e-mail** + mot de passe (`lib/auth-login-identifier.ts`, `signInWithPassword`).
- **Inscription** (`/auth?mode=signup`) : nom + téléphone + e-mail facultatif → **SMS OTP** → mot de passe → session (`lib/ensure-patient-profile.ts`, `lib/phone-e164.ts`).
- E-mail récupération : **`/auth/update-password`** ; opt-in e-mail aussi dans **`app/dashboard/patient/parametres/page.tsx`**.
- Migration **`20260521_001_profiles_email_nullable.sql`** : `profiles.email` nullable.
- Unicité : **téléphone / e-mail** uniques côté **`auth.users`** (Supabase) ; doublons possibles dans **`profiles.whatsapp`** sur comptes **legacy** (e-mail avant SMS).

**Notifications hors-app (e-mail + SMS)** :
- File SQL : **`notification_external_queue`**, prefs **`notification_external_prefs`**, trigger sur **`app_notifications`** (`20260505_001`). SMS/WhatsApp : destination = **`profiles.whatsapp`** (E.164).
- Workers : **`app/api/cron/send-external-emails`** (Resend), **`app/api/cron/send-external-sms`** (Twilio), **`/api/webhooks/dispatch-external-sms`** (déclenchement rapide) ; **`lib/external-notification-queue-worker.ts`** (SMS : 1 tentative). Cron GitHub : e-mail + SMS **5 min** ; SMS quasi immédiat si **Database Webhook** Supabase (voir **`RUNBOOK.md` §9**).
- **Vercel (SMS notifs)** : `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + **`TWILIO_SMS_FROM`** = **numéro Twilio acheté** (ex. `+447565507297`), API **Messages** — **pas** le libellé **Verify** des codes inscription (Supabase Auth = souvent **Twilio Verify**, expéditeur alphanumérique sans numéro visible).
- `TWILIO_MESSAGING_SERVICE_SID` **optionnel** (inutile si `FROM` est le numéro acheté).
- **SMS notifs (mai 2026)** : envoi manuel validé (PowerShell / cron) ; automatisation = cron GitHub + webhook Supabase optionnel. Garder plafond Twilio. Détail : **`RUNBOOK.md` §9**, **`CAHIER_DES_CHARGES.md` §10 session 2026-05-16**.

**Notifications WhatsApp (en cours, pas encore de worker)** :
- **Étape 1 (infra, avant code)** : Meta Business + expéditeur WhatsApp via Twilio ; test manuel **template** depuis la console ; **ne pas** utiliser **MM Lite** pour messages utilitaires (erreur Twilio **63055** → envoyer via **Cloud API**, modèles catégorie **Utility** pour statuts demande).
- **Numéro SMS USA Twilio ≠ expéditeur WhatsApp** ; **pas** d’envoi API depuis le WhatsApp perso du pharmacien — liens **`wa.me`** OK sans Meta Business.
- **Prochaine étape code** : variables d’env + route test d’envoi template, puis worker cron `channel=whatsapp` (sur le modèle Resend).

**Expiration `responded`** : cron Supabase **`service_role`** sur **`expire_overdue_requests()`** (optionnellement `expire_overdue_requests(interval '24 hours')` en prod) ; **`abandon_unconfirmed_responded_requests()`** est un **alias** (même lot **`20260516_001`**). Défaut actuel en dépôt : **30 minutes** après **`responded_at`** pour tests (pas un bug fuseau Maroc : **`timestamptz`**).

**Notifications in-app** : marquage comptoir **`counter_outcome:picked_up`** → **aucune** insertion **`app_notifications`** (**`20260515_001`**). Libellés patient : **`20260514_001`** (surcharges **`_in_app_notification_patient`**).
