# RUNBOOK - Pharmeto

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
- `EMAIL_FROM` (prod pilote : `Pharmeto <noreply@pharmeto.ma>` — validé terrain notif patient ; dev : `onboarding@resend.dev` si domaine non vérifié)
- `APP_BASE_URL` (URL publique Vercel/custom domain, utilisée dans les liens e-mail Auth côté serveur)
- `NEXT_PUBLIC_APP_BASE_URL` (même URL que `APP_BASE_URL`, exposée au navigateur pour OTP / confirmation e-mail)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` (WhatsApp alertes + OTP Auth, même compte si possible)
- `TWILIO_WHATSAPP_FROM` = `whatsapp:+212770165668` (notifs métier patient — voir §10)
- `TWILIO_WHATSAPP_CONTENT_SID_RESPONDED`, `TWILIO_WHATSAPP_CONTENT_SID_TREATED` (modèles Utility FR approuvés — §10)
- `TWILIO_SMS_FROM` (optionnel : route test `/api/cron/test-external-sms` uniquement ; **plus d’enqueue SMS métier** depuis **`20260811_001`**) **ou** `TWILIO_MESSAGING_SERVICE_SID`

Regle:
- Le nom doit etre exact
- La valeur ne doit pas contenir de guillemets

## 2b) Auth Supabase — codes OTP e-mail et liens (pas localhost)

**Symptômes** : e-mail avec un **lien** au lieu d’un **code à 6 chiffres** ; lien qui pointe vers `http://localhost:3000/...` (inutilisable sur téléphone).

### URL du site (obligatoire en prod)

1. **Vercel** → `APP_BASE_URL` **et** `NEXT_PUBLIC_APP_BASE_URL` = URL publique (ex. `https://proxipharma-app.vercel.app`), **sans** slash final.
2. **Supabase** → *Authentication* → *URL Configuration* :
   - **Site URL** = même URL publique (pas `localhost`).
   - **Redirect URLs** : ajouter au minimum :
     - `https://<votre-domaine>/auth/callback`
     - `https://<votre-domaine>/auth/update-password`
     - `https://<votre-domaine>/auth/**` (wildcard si proposé)
3. Redéployer Vercel après changement des variables.

En local, les liens e-mail restent souvent en `localhost` : tester l’inscription / MDP sur **l’URL de preview ou production**, ou utiliser un tunnel (ngrok) si besoin.

### Inscription : code à 6 chiffres (obligatoire côté app)

L’app appelle `signInWithOtp` **sans** `emailRedirectTo` à l’inscription, puis `verifyOtp` (`app/auth/page.tsx`). Le corps de l’e-mail est défini dans **Supabase** :

1. *Authentication* → *Email Templates* → modèle **Magic Link** (ou *Confirm signup* selon le flux activé).
2. Corps recommandé (code uniquement) :
   ```
   Votre code Pharmeto : {{ .Token }}
   (6 chiffres — saisissez-le dans l’application, onglet Créer un compte.)
   ```
3. **Ne pas** mettre `{{ .ConfirmationURL }}` comme seul contenu si vous voulez forcer le code dans l’app.
4. Si un lien est encore présent dans le template : au clic, l’utilisateur arrive sur `/auth/callback` puis **écran mot de passe** (`signup_password_pending` dans les métadonnées), pas le tableau de bord sans MDP.

### Parcours inscription (résumé)

| Étape | Canal | UI |
|--------|--------|-----|
| 1 | Formulaire | Téléphone + e-mail facultatif |
| 2 | OTP | Code 6 chiffres (SMS/WhatsApp ou e-mail) |
| 3 | Mot de passe | Obligatoire avant accès à l’app |

**Récupération MDP** : toujours un **lien** e-mail → `/auth/update-password` (normal).

### Récupération mot de passe et changement d’e-mail

Ces flux Supabase envoient **toujours un lien** (pas un code OTP) :

- Mot de passe oublié → `/auth/update-password` (`APP_BASE_URL` + template *Reset password*).
- Changement d’e-mail (paramètres patient) → `/auth/callback` puis retour paramètres.

Vérifier les mêmes **Site URL** / **Redirect URLs** et le template *Change email address* / *Confirm signup*.

### « Email rate limit exceeded » (429)

**Cause** : limite Supabase sur l’envoi d’e-mails Auth (OTP inscription, renvoi de code, mot de passe oublié). Avec le **SMTP intégré** Supabase, le quota est **très bas** (souvent ~2–3 e-mails / heure pour tout le projet) — facile à atteindre en tests répétés.

**À faire tout de suite** :
1. Attendre **~1 h** (le compteur se réinitialise).
2. Tester l’inscription **sans e-mail facultatif** (OTP par **SMS** uniquement).
3. Éviter les clics répétés sur « Renvoyer le code ».

**Pour la prod / les tests intensifs** : *Authentication* → configurer un **SMTP personnalisé** (Resend, SendGrid, etc.) — les quotas deviennent ceux de votre fournisseur. Voir [Rate limits Auth](https://supabase.com/docs/guides/auth/rate-limits).

L’app affiche un libellé français via `mapAuthErrorToFrench` (`lib/auth-messages-fr.ts`).

## 2c) Domaine production `pharmeto.ma` (Cap Connect → Vercel)

Registrar : **Cap Connect** (titulaire `.ma`). Hébergement app : **Vercel** projet `proxipharma-app` (prod = branche `main`).

**Ordre recommandé** : d’abord ajouter le domaine dans Vercel (pour voir les enregistrements exacts), puis coller le DNS chez Cap Connect, puis variables d’env + Supabase, puis redéployer.

### A) Vercel — ajouter le domaine

1. [Vercel Dashboard](https://vercel.com) → projet **proxipharma-app** → **Settings** → **Domains**.
2. Ajouter **`pharmeto.ma`** (production).
3. Ajouter **`www.pharmeto.ma`** → rediriger vers **`pharmeto.ma`** (recommandé).
4. Noter les enregistrements DNS affichés par Vercel (apex + `www`). En secours si l’UI montre les valeurs « classiques » :
   - **`pharmeto.ma`** (apex) → **A** → `76.76.21.21`
   - **`www.pharmeto.ma`** → **CNAME** → `cname.vercel-dns.com`
   - Vercel peut aussi proposer des valeurs **dynamiques** (`*.vercel-dns-0xx.com`) : **priorité aux valeurs affichées dans le dashboard**.

### B) Cap Connect — zone DNS `pharmeto.ma`

Espace client → domaine **PHARMETO.MA** → icône **globe / DNS** (gestion des enregistrements).

| Type | Nom / hôte | Valeur | TTL |
|------|------------|--------|-----|
| **A** | `@` ou vide (apex) | `76.76.21.21` *(ou IP Vercel affichée)* | 3600 |
| **CNAME** | `www` | `cname.vercel-dns.com` *(ou CNAME Vercel affiché)* | 3600 |

- Supprimer les anciens enregistrements **A / CNAME** conflictuels sur `@` et `www` s’il y en a.
- Ne pas activer l’**hébergement web** Cap Connect pour ce domaine (le site reste sur Vercel).
- Propagation : 15 min à 48 h. Vercel affiche **Valid Configuration** + certificat HTTPS auto.

Badge **ID MANQUANT** (CIN ANRT) : n’empêche pas le DNS ; téléverser la CIN quand même (conformité).

### C) Vercel — variables d’environnement (Production)

**Settings** → **Environment Variables** → scope **Production** :

| Variable | Valeur |
|----------|--------|
| `APP_BASE_URL` | `https://pharmeto.ma` |
| `NEXT_PUBLIC_APP_BASE_URL` | `https://pharmeto.ma` |

Sans slash final. Puis **Redeploy** du dernier déploiement production.

### D) Supabase — Auth (obligatoire)

Dashboard Supabase du pilote → **Authentication** → **URL Configuration** :

| Champ | Valeur |
|-------|--------|
| **Site URL** | `https://pharmeto.ma` |
| **Redirect URLs** | `https://pharmeto.ma/auth/callback` |
| | `https://pharmeto.ma/auth/update-password` |
| | `https://pharmeto.ma/auth/**` |

Conserver les URLs Vercel (`https://proxipharma-app.vercel.app/...`) en redirect si des previews / anciens liens doivent encore fonctionner.

### E) Tests après mise en ligne

Sur **`https://pharmeto.ma`** (Chrome ou Edge, pas le navigateur intégré IDE) :

1. Annuaire / page d’accueil.
2. Connexion ou inscription patient.
3. « Mot de passe oublié » → lien e-mail pointe vers **`pharmeto.ma`**, pas `localhost`.
4. Une demande produit test (parcours pilote).

### F) Webhook notifs hors-app (si déjà configuré)

Supabase Database Webhook → `POST https://pharmeto.ma/api/webhooks/dispatch-external-sms` (remplacer l’URL `*.vercel.app` si c’était l’URL de prod). Traite **e-mail** et **WhatsApp** à l’INSERT (`notification_external_queue`) — voir §9.

## 3) Process de release (solo founder)

**Répartition** : l’agent Cursor gère branche, commits, push et **PR ouverte** (voir `.cursor/rules/delivery-workflow-user.mdc`). Vous : migrations Supabase si besoin, attendre la preview, tester, **Merge** sur GitHub.

1. (Agent) Branche de travail + PR vers `main` si aucune PR ouverte après le dernier merge
2. (Agent) Commit et push sur la branche → preview Vercel sur la PR
3. (Vous) Attendre checks verts (`lint-and-build`, Vercel preview) et tester la preview
4. (Vous) Merge PR sur GitHub
5. (Vous) Verifier le deploiement production Vercel apres merge

Important:
- Ne pas push direct sur `main` (branche protegee)

## 4) Checklist post-deploiement (5 min)

- Ouvrir URL production
- Verifier annuaire public (navigation privee / deconnecte : **Al Jazira seule** ; compte test `pilot_access` : 3 officines)
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

## 9) Cron GitHub Actions (e-mail + WhatsApp)

**État juin 2026** : alertes métier = **e-mail + WhatsApp** patient (P0 répondu / traité). **SMS métier désactivé** (migration **`20260811_001`**) — OTP inscription / reset téléphone **inchangés** (Twilio Verify via Supabase Auth).

- **E-mail + WhatsApp (filet ~5 min)** : `.github/workflows/send-external-emails-cron.yml` — toutes les 5 min + manuel → `POST /api/cron/send-external-emails` puis `POST /api/cron/send-external-whatsapp`.
- **SMS (legacy)** : `.github/workflows/send-external-sms-cron.yml` — ne traite que d’**anciennes** lignes `channel=sms` encore `pending` ; **aucune nouvelle ligne SMS** n’est enqueue après **`20260811_001`**.
- **Quasi immédiat (~secondes, recommandé)** : Supabase → **Database Webhooks** → `POST https://<APP>/api/webhooks/dispatch-external-sms` avec en-tête `Authorization: Bearer <CRON_SECRET>`, table `notification_external_queue`, événement **INSERT** (une ligne `email` + une ligne `whatsapp` → deux appels ; le webhook ne traite **que la ligne insérée**). Sans webhook, délai = cron GitHub (~5 min).
- Secrets GitHub : `APP_BASE_URL`, `CRON_SECRET`.
- Variables Vercel notifs : `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `TWILIO_WHATSAPP_CONTENT_SID_*` (§10), `RESEND_*`, `EMAIL_FROM`.
- Retry auto : e-mail jusqu’à 3 tentatives ; WhatsApp **1 tentative** (pas de retry cron).

### Tester WhatsApp (pilote patient P0)

1. **Migration** : appliquer **`20260811_001_disable_external_sms_notifications.sql`** si pas fait.
2. **Vercel** : variables §10 + redeploy.
3. **Utilisateur test** : *Mes paramètres* → *Alertes hors application* → cocher **WhatsApp** ; profil avec numéro E.164 (`profiles.whatsapp`, ex. `+2126…`).
4. **Déclencher** : pharmacien répond ou marque traité → file `notification_external_queue` → ligne `channel=whatsapp`, `status=pending`.
5. **Webhook** ou cron manuel *Send External Emails Cron* → `sent` + message WhatsApp template.
6. **Test direct** : `POST /api/cron/test-external-whatsapp` (§10) ou Twilio Console **Try it out**.

**Destination** : **`profiles.whatsapp`** (E.164) — pas `auth.users.phone`.

**OTP vs notifs** : inscription = Twilio Verify ; notifs métier = **Content API WhatsApp** + modèles Meta approuvés (§10).

**Inscription** : téléphone déjà dans **`auth.users`** → pas d’OTP — **`/api/auth/signup-phone-check`** (**`20260522_003`**).

### Historique SMS métier (mai 2026 — désactivé)

Avant **`20260811_001`**, le pilote envoyait des SMS patient (`responded` / `treated`) via API Messages + `TWILIO_SMS_FROM`. Remplacé par WhatsApp (meilleure délivrabilité MA). Le code worker SMS reste pour tests (`/api/cron/test-external-sms`) et lignes legacy en file. UI prefs : case SMS masquée ; `sms_enabled` forcé à `false`. Script annulation file : `supabase/scripts/cancel-sms-queue-bad-destination.sql`.

## 10) Notifications WhatsApp (Q35 — actif prod pilote)

**État repo (juin 2026)** : worker **`channel=whatsapp`** livré et **activé Vercel** (`lib/twilio-whatsapp.ts`, `lib/external-notification-queue-worker.ts`) ; webhook `/api/webhooks/dispatch-external-sms` (e-mail + WhatsApp, **une ligne INSERT à la fois**) ; cron `/api/cron/send-external-whatsapp` (appelé aussi par le workflow e-mail §9) ; test `/api/cron/test-external-whatsapp`. Migration **`20260811_001`** : plus d’enqueue SMS métier — WhatsApp remplace SMS pour répondu / traité.

**Infra Meta/Twilio — FAIT ✅** :
- Expéditeur **+212770165668** (nom **Pharmeto**), sender Twilio **Online**
- WABA **Miasmo** / Page **Pharmeto.ma**
- **2 modèles Utility FR approuvés v1 (sans lien)** :

| Événement | Template Twilio | Content SID |
|-----------|-------------------|-------------|
| `request_status:responded` | `copy_pharmeto_request_responded_fr` | `HXe97624f91a846e92c56ca0fe2fabd2d5` |
| `request_status:treated` | `copy_pharmeto_request_treated_fr` | `HX5aa3d5e71dc6242ac53448fb95022f54` |

Corps type : `Pharmeto : {{1}} a répondu. Dossier {{2}}. Ouvrez l'application pour consulter.` (idem **traité**).

**En attente Meta (pilotes CTA avec lien — phase 2)** :
- `pharmeto_request_responded_fr_v2_link` → `HX887df3db18f89b20a78cfec865745d28` (URL `https://pharmeto.ma/r/{{3}}`)
- `pharmeto_pharmacy_new_request_fr` → `HX806ef0e68b7e5f2a6cc674b4637e4a60` (URL `https://pharmeto.ma/rp/{{3}}`)

Ne pas basculer le code sur v2 tant que Meta n’a pas **Approved** les pilotes. Garder v1 en secours.

**Variables Vercel** (en plus de `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`) :
- `TWILIO_WHATSAPP_FROM` = `whatsapp:+212770165668`
- `TWILIO_WHATSAPP_CONTENT_SID_RESPONDED` = `HXe97624f91a846e92c56ca0fe2fabd2d5`
- `TWILIO_WHATSAPP_CONTENT_SID_TREATED` = `HX5aa3d5e71dc6242ac53448fb95022f54`
- Optionnel test : `WHATSAPP_TEST_TO` = `+2126…` perso

**Test B** — après deploy preview :
```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" -H "Content-Type: application/json" \
  -d '{"to":"+2126XXXXXXXX","eventType":"request_status:responded"}' \
  "$APP_BASE_URL/api/cron/test-external-whatsapp"
```
Ou Twilio Console → **Try it out** → From `whatsapp:+212770165668`, ContentSid + variables `{"1":"Pharmacie Centrale","2":"D042/26"}`.

**Pilote worker** : patient uniquement ; événements **répondu** + **traité** (P0). Autres `event_type` enqueue mais **skip** worker tant qu’il n’y a pas de modèle. Destination = `profiles.whatsapp` (E.164). Phase 1 = **sans lien** (v1).

**Ops** : rafale backlog webhook corrigée (`onlyQueueRowIds` sur INSERT) ; script annulation file WhatsApp obsolète : `supabase/scripts/cancel-pending-whatsapp-backlog.sql`. Plan détaillé : `.cursor/plans/whatsapp_notifs_phases_92071eea.plan.md`.

**Rappels** :
- Numéro **SMS USA** (OTP Auth) ≠ expéditeur WhatsApp Business.
- **Ne pas** MM Lite (erreur **63055**) — Content API Twilio classique.
- `wa.me` fiche officine = canal manuel, pas l’API notifs.

**Auth patient** : tester `/auth` dans Chrome ; inscription `?mode=signup` ; connexion identifiant unique téléphone ou e-mail + mot de passe. **OTP inscription** : peut arriver par **WhatsApp** (Twilio Verify / Supabase Phone) ; numéro **pro** souvent en **Failed** SMS — privilégier un **06/07 perso** pour les tests. **Renvoi code** : `shouldCreateUser: false` (évite 2ᵉ `auth.users`). Doublons téléphone en pilote : reset demandes (`clear-all-requests`) + suppression des comptes Auth.

## 11) Checklist rebrand Pharmeto (preview + prod)

**État pilote juin 2026 (session 2026-06-10 suite 2–3 + affinages antérieurs)** — voir journal `CAHIER_DES_CHARGES.md` §10 et phrase reprise **§13.59** (visibilité annuaire ; antérieur **§13.54**).

| Étape | Statut |
|-------|--------|
| Code rebrand (nom, i18n, SMS préfixe, metadata) | OK (merge prod) |
| Logo PNG transparent 500×500 + favicons | OK (`public/brand/pharmeto-icon.png`, `PharmetoLogo`) |
| Header logo (40 px desktop / 34 px mobile) | OK |
| Image OG partage lien (logo réel) | OK (`app/opengraph-image.tsx`) |
| Titre annuaire **« Annuaire interactif des pharmacies »** | OK (FR/AR) |
| Prod `pharmeto.ma` + Vercel URLs | OK |
| Supabase Auth + template OTP Pharmeto | OK |
| Resend domaine `pharmeto.ma` Verified | OK |
| E-mail notif patient expéditeur **Pharmeto** | OK (test terrain) |
| Migrations jusqu'à `20260718_002` (`nom_ar`, `adresse_ar`, `public_listed`, `pilot_access`) | À confirmer sur Supabase (`001` puis `002` obligatoires) |
| SMS préfixe `Pharmeto:` (code legacy) | OK (SMS métier **désactivé** — §9) |
| WhatsApp alertes patient (répondu / traité) | OK pilote (§10) |
| Migration `20260811_001` (désactivation SMS métier) | À confirmer sur Supabase |
| OTP Auth Supabase (quota / e-mail) | Reporté si quota atteint |

**Vérifications après chaque merge marque/UI** :

1. **Preview Vercel** : header **Pharmeto** + logo sans fond gris ; favicon ; partage WhatsApp `pharmeto.ma` (OG — cache possible).
2. **i18n AR** : pas de régression RTL header + titre annuaire.
3. **Infra** (§2c) : `APP_BASE_URL` / `NEXT_PUBLIC_APP_BASE_URL` = `https://pharmeto.ma` ; webhook notifs `https://pharmeto.ma/api/webhooks/dispatch-external-sms`.
4. **Prod** : auth reset MDP, demande test, sur **Chrome/Edge** (pas navigateur IDE).

**Dev local** : `npm run dev:clean` si recompilations Turbopack Windows bloquantes ; erreur `Failed to fetch RSC` pendant « Compiling… » = recharger après fin compile.
