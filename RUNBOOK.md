# RUNBOOK - ProxiPharma

Guide operationnel minimal pour maintenir la production stable.

## 1) Environnements

- Production: projet Vercel connecte a la branche `main`
- Preview: deploiements automatiques sur branches de feature via Pull Request
- Base de donnees: Supabase (RLS active)

## 2) Variables d'environnement critiques

Configurer ces variables dans:
- Vercel (`Project Settings > Environment Variables`)
- GitHub (`Settings > Secrets and variables > Actions`)

Variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (serveur uniquement: cron/worker, **ne jamais** exposer au navigateur)
- `CRON_SECRET` (secret partagé pour protéger les endpoints cron)
- `RESEND_API_KEY` (prestataire e-mail, free tier possible)
- `EMAIL_FROM` (ex: `ProxiPharma <onboarding@resend.dev>` en dev, puis domaine validé)
- `APP_BASE_URL` (URL publique Vercel/custome domain, utilisée dans les liens e-mail)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` (SMS alertes hors-app, même compte que l’auth si possible)
- `TWILIO_SMS_FROM` (numéro expéditeur E.164, ex. `+1…`) **ou** `TWILIO_MESSAGING_SERVICE_SID`

Regle:
- Le nom doit etre exact
- La valeur ne doit pas contenir de guillemets

## 3) Process de release (solo founder)

1. Creer une branche de travail:
   - `git switch -c feat/nom-court`
2. Commit et push sur la branche
3. Ouvrir une PR vers `main`
4. Attendre checks verts:
   - `lint-and-build`
   - Vercel preview
5. Merge PR
6. Verifier le deploiement production Vercel

Important:
- Ne pas push direct sur `main` (branche protegee)

## 4) Checklist post-deploiement (5 min)

- Ouvrir URL production
- Verifier annuaire public (invite)
- Verifier login patient
- Verifier espace pharmacien
- Verifier espace admin
- Verifier absence d'erreurs 500 dans la console

## 5) Incidents frequents

### CI echoue sur build avec variables manquantes

Symptome:
- erreur sur `NEXT_PUBLIC_SUPABASE_URL` ou `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Action:
1. Verifier secrets GitHub Actions
2. Verifier variables Vercel
3. Relancer workflow / redeployer

### Notifications externes ne partent pas (Q35)

Symptome:
- `notification_external_queue` reste en `pending`

Action:
1. Verifier que le cron/worker appelle `POST /api/cron/send-external-emails` avec `Authorization: Bearer <CRON_SECRET>`
2. Verifier `SUPABASE_SERVICE_ROLE_KEY` / `RESEND_API_KEY`
3. Verifier que `notification_external_prefs` est activé pour l'utilisateur + `profiles.email` non vide

### Erreur RLS "infinite recursion detected in policy for relation profiles"

Cause:
- policy `profiles` recursive

Action:
1. Aller dans Supabase SQL Editor
2. Supprimer la policy recursive
3. Reappliquer le correctif avec fonction helper `is_admin()`

### Erreur Postgres `42P13` sur migration `20260505_007` (changement `RETURNS TABLE` des RPC pharmacien)

Cause:
- `CREATE OR REPLACE FUNCTION` ne suffit pas si la liste des colonnes retournées (`pharmacist_patient_contact_for_request`, `pharmacist_patient_directory_for_my_pharmacy`) change.

Action:
- Le fichier migre versionne inclut `DROP FUNCTION IF EXISTS ...` puis `CREATE FUNCTION`. Rejouer ce bloc ou mettre a jour le depot et reexecuter la migration.

### Check PR : Vercel « Deployment failed » (plan Hobby + crons trop fréquents)

Cause:
- `vercel.json` avec une expression cron du type « toutes les 2 minutes » n’est pas compatible avec le **plan Hobby** (intervalle minimal **≈ une fois par jour**).

Action:
1. Retirer les `crons` de `vercel.json` ou passer sur **Pro** si tu insistes pour Vercel Cron en minuterie.
2. Garder **GitHub Actions** (`.github/workflows/send-external-emails-cron.yml`) pour les envois mails fréquents.

### Push refuse sur `main`

Symptome:
- `Protected branch update failed`

Action:
1. Pousser sur une branche feature
2. Ouvrir PR
3. Merge apres checks verts

## 6) Sauvegarde et hygiene

- Garder les policies RLS versionnees (script SQL dans un dossier migrations)
- Eviter les modifications manuelles non tracees en production
- Documenter chaque incident resolu en 2-3 lignes dans ce fichier

## 7) Commandes utiles

```bash
npm run lint
npm run build
git status
git log --oneline -n 10
```

## 8) Envoi automatique emails Q35

- Endpoint: `/api/cron/send-external-emails` (`GET` ou `POST`, header `Authorization: Bearer <CRON_SECRET>`)
- **Plan Hobby Vercel** : les Cron Jobs Vercel ne permettent qu’une fréquence **minimale d’une fois par jour** (pas toutes les 2 minutes). Une entrée `vercel.json` avec `*/2 * * * *` peut **faire échouer le déploiement** ou ne jamais s’afficher comme job actif comme attendu.
- **Référence planifiée** : GitHub Actions (voir §9).

## 9) Cron GitHub Actions (email + SMS)

- **E-mail** : `.github/workflows/send-external-emails-cron.yml` — toutes les 5 min + manuel → e-mail puis SMS (filet de sécurité).
- **SMS** : `.github/workflows/send-external-sms-cron.yml` — planifié **toutes les 5 min** (+ manuel) → `POST /api/cron/send-external-sms`. (GitHub ne permet pas &lt; 5 min en `schedule` ; webhook pour quelques secondes.)
- **E-mail + SMS rapides (recommandé, quelques secondes)** : Supabase → **Database Webhooks** → `POST https://<APP>/api/webhooks/dispatch-external-sms` avec en-tête `Authorization: Bearer <CRON_SECRET>`, table `notification_external_queue`, événement **INSERT** (une ligne `email` + une ligne `sms` → deux appels, chaque canal traité tout de suite). Sans webhook, délai = cron GitHub (~5 min, irrégulier).
- Secrets GitHub requis:
  - `APP_BASE_URL` (ex: `https://proxipharma-app.vercel.app`)
  - `CRON_SECRET`
- Variables Vercel en plus pour SMS : `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM` (ou `TWILIO_MESSAGING_SERVICE_SID`)
- Optionnel : `SMS_BLOCKED_DESTINATIONS` (ex. `+212600000123`) — le worker ignore ces numéros sans appeler Twilio
- Retry auto : e-mail jusqu'à 3 tentatives ; **SMS : 1 seule tentative** (pas de retry cron).

### Tester les SMS (pilote)

1. **Ne pas confondre OTP et notifs** : codes inscription = **Twilio Verify** (libellé **Verify** possible). **Notifs** = API **Messages** + **`TWILIO_SMS_FROM`** (ex. `+19789813065`). Si Twilio affiche **30007**, raccourcir le texte (voir point de reprise ci-dessous).
2. **Twilio** : envoyer un SMS test depuis la console vers votre `+212…` (même compte que les OTP).
3. **Vercel** : ajouter les variables Twilio ci-dessus + redéployer.
4. **Facturation** : activer un plafond de dépenses Twilio ; ne lancer le workflow SMS manuel qu’après geo Maroc + test OK (les échecs sont souvent facturés).
5. **Utilisateur test** : dans le tableau de bord → *Alertes hors application* → cocher **SMS** ; profil avec numéro E.164 (`profiles.whatsapp`, ex. `+2126…`).
6. **Déclencher une notif** : action qui crée une `app_notification` (ex. pharmacien répond à une demande).
7. **File** : Supabase → `notification_external_queue` → ligne `channel=sms`, `status=pending`.
8. **Cron manuel** : GitHub Actions → *Send External SMS Cron (manual)* → *Run workflow*, ou en local :
   `curl -X POST -H "Authorization: Bearer $CRON_SECRET" "$APP_BASE_URL/api/cron/send-external-sms"`
9. **Résultat** : la ligne passe à `sent` + SMS reçu ; en cas d’échec, `last_error` sur la ligne et `status=failed`.

### SMS automatique (délai court)

1. **Fusionner sur `main`** les workflows `.github/workflows/send-external-emails-cron.yml` et `send-external-sms-cron.yml`, puis déployer l’app (route webhook incluse).
2. **Sans webhook** : SMS traités au plus tard en **~5 min** (cron SMS ou cron e-mail qui appelle aussi `/api/cron/send-external-sms`). Vérifier dans Actions que le workflow n’est pas **désactivé** et qu’il y a des runs `schedule` (pas seulement manuels).
3. **Quasi immédiat (~secondes)** — Supabase → **Database Webhooks** → Create hook :
   - Table : `notification_external_queue`
   - Events : **Insert**
   - URL : `https://<APP_BASE_URL>/api/webhooks/dispatch-external-sms`
   - HTTP headers : `Authorization: Bearer <CRON_SECRET>` (même secret que les crons)
4. Tester : notif avec **e-mail + SMS** cochés → les deux reçus en quelques secondes (sans PowerShell / sans attendre le cron).

### Point de reprise SMS (mai 2026)

**Chaîne validée** : file `notification_external_queue` → worker Vercel → Twilio Messages (`TWILIO_SMS_FROM`, ex. `+19789813065`) ; **e-mail + SMS** OK au **run manuel** GitHub (*Send External Emails Cron*) ; **webhook Supabase** (`POST /api/webhooks/dispatch-external-sms`, header `Authorization: Bearer <CRON_SECRET>`) → ligne `sms` passe à `sent` en quelques secondes.

**Notifs SMS** : destination = **`profiles.whatsapp`** (E.164), **pas** la colonne Phone de Supabase Auth (comptes legacy e-mail peuvent avoir Auth.phone vide).

**Livraison téléphone** : avec **webhook** + SMS **courts sans URL**, réception **rapide** validée au pilote. Twilio **30007** (*Message filtered*) surtout quand le SMS est **long** et/ou contient une **URL** (souvent 5+ segments vers le MA depuis numéro US).

**Lien dans le SMS (Q35)** :
- **Oui, techniquement** (concaténer une URL dans `buildOutboundNotificationText`), mais au pilote **fort risque de filtrage** opérateur (30007) — ne pas remettre l’URL longue type `https://proxipharma-app.vercel.app/dashboard/demandes/…`.
- **Pistes si un lien est requis** : (1) **e-mail** = lien complet (déjà en place) ; (2) SMS = texte court + « ouvrez l’app » ; (3) **URL très courte** sur votre domaine (ex. `https://proxipharma.app/r/Ab12` + redirection Next.js) ; (4) service raccourci (bit.ly, etc.) ; (5) **Twilio Link Shortening** sur un Messaging Service enregistré ; (6) après **A2P / conformité** US→MA, filtres souvent moins agressifs.
- **Recommandation pilote** : pas de lien en SMS ; webhook + texte court. Réévaluer un lien court après plusieurs **Delivered** stables.

**Cron GitHub `schedule`** : peu fiable (runs espacés ; lignes restent `pending` jusqu’au manuel). **Webhook = chemin principal** ; cron e-mail (+ appel SMS) = filet de sécurité ~5 min.

**Vercel** : `SMS_BLOCKED_DESTINATIONS=+212600000123` (numéros test invalides). Script SQL : `supabase/scripts/cancel-sms-queue-bad-destination.sql`.

**OTP vs notifs** : inscription = Twilio Verify (libellé **Verify** / WhatsApp +44 possible) ; notifs = API Messages + `TWILIO_SMS_FROM`.

**Test** : `POST /api/cron/test-external-sms` (après deploy route sur `main`) ; logs Twilio : **Delivered** + **1 segment**, pas 30007.

**Format SMS prod (pilote)** — patient, **`responded`** / **`treated`** uniquement ; sans URL ; ASCII ~1 segment :
- Répondu : `ProxiPharma: Ennasr a repondu. Dossier D042/26.`
- Traité : `ProxiPharma: Ennasr a traite le dossier D042/26.`
- Nom officine : sans préfixe « La pharmacie » si le nom commence déjà par « Pharmacie » ; ref = **`requests.request_public_ref`** (sinon `#` + 8 car. UUID).

**Inscription** : si le téléphone existe déjà dans **`auth.users`**, pas d’OTP à l’inscription — **`/api/auth/signup-phone-check`** (migration **`20260522_003`**).

## 10) Notifications WhatsApp (Q35 — en cours, pas déployé)

**État repo** : la file `notification_external_queue` et les prefs `whatsapp_enabled` existent ; **aucun** endpoint cron n’envoie encore `channel=whatsapp` (e-mail + SMS branchés, §9 ; WhatsApp après Meta/templates).

**Prérequis infra (étape 1 — à faire avant code)** :
1. Compte **Meta Business** + expéditeur WhatsApp via **Twilio** (Messaging → Try WhatsApp / Senders).
2. Créer un **modèle** approuvé, catégorie **Utility** (ex. statut demande + nom pharmacie), langue **fr**.
3. Tester l’envoi **depuis la console Twilio** vers un numéro de test sandbox (`+212…` en E.164).
4. **Ne pas** envoyer les notifs métier via **Marketing Messages Lite (MM Lite)** : erreur **63055** (*Only marketing messages supported on MM Lite API*) → utiliser l’API WhatsApp **Cloud** / envoi template classique.

**Rappels** :
- Le numéro **SMS USA** (OTP Auth) n’est **pas** l’expéditeur WhatsApp Business.
- Les messages ne partent **pas** depuis le WhatsApp personnel du pharmacien via l’API ; les liens `wa.me` sur la fiche officine restent le canal manuel.

**Prochaine étape code (étape 2)** : variables d’environnement Twilio WhatsApp + route de test serveur, puis worker cron sur le modèle `send-external-emails`.

**Auth patient** : tester `/auth` dans Chrome ; inscription `?mode=signup` ; connexion identifiant unique téléphone ou e-mail + mot de passe.
