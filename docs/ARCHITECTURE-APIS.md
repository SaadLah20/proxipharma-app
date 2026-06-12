# ProxiPharma — APIs externes et technologies

Document de référence (parcours patient, pharmacien, admin, notifications, médias).  
**Branche de travail** : `fix/validated-supply-ecart-ui-modal` · **Dernière mise à jour doc** : mai 2026.

**Voir aussi** : [`RUNBOOK.md`](../RUNBOOK.md) (variables d’environnement), [`CAHIER_DES_CHARGES.md`](../CAHIER_DES_CHARGES.md) §11 (migrations), phrase de reprise **§13.31**.

---

## 1. Plateforme et hébergement

| Technologie | Rôle | Détails / intégration |
|-------------|------|------------------------|
| **Next.js 16** (App Router) | Framework web full-stack | Pages `app/`, routes API `app/api/`, déploiement Vercel |
| **React 19** | Interface utilisateur | Composants client / serveur |
| **TypeScript** | Typage | Code applicatif |
| **Tailwind CSS 4** | Styles | `app/globals.css`, `clsx`, `tailwind-merge` |
| **Vercel** | Hébergement production + previews PR | `APP_BASE_URL`, `VERCEL_URL` ; build `npm run build` |
| **GitHub Actions** | CI + crons filet | `.github/workflows/ci.yml` (lint + build) ; crons e-mail / SMS / expiration (~5 min) |

---

## 2. Backend et données (cœur métier)

| Technologie | Rôle | Détails / intégration |
|-------------|------|------------------------|
| **Supabase** (PostgreSQL) | BDD, auth, storage, RLS, RPC | Client : `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`lib/supabase.ts`). Serveur : `SUPABASE_SERVICE_ROLE_KEY` (`lib/supabase-service.ts`) |
| **Supabase Auth** | Connexion, inscription, OTP, MDP | `app/auth/page.tsx` — `signInWithPassword`, `signInWithOtp`, `verifyOtp`, reset |
| **Supabase Storage** | Médias fichiers | Buckets **`public-assets`** et **`private-media`** — `lib/storage-media.ts` |
| **Supabase Database Webhooks** | Notifs rapides | `INSERT` sur `notification_external_queue` → `POST /api/webhooks/dispatch-external-sms` |
| **PostgreSQL** (migrations) | Logique métier | `supabase/migrations/` — demandes, pricing, promos, ratings, refs `D042/26`, etc. |

### Buckets Storage

| Bucket | Contenu | Accès |
|--------|---------|--------|
| `public-assets` | Produits (`products/{id}/main.*`), officines (`pharmacies/{id}/logo|cover-*`) | URL publique `*.supabase.co/storage/...` |
| `private-media` | Ordonnances, consultations, photos patient liées au dossier | URL signée via `POST /api/media/private-signed-url` |

---

## 3. API externes (appels HTTP sortants)

| Service | Endpoint / canal | Utilisation | Variables d’environnement |
|---------|------------------|-------------|---------------------------|
| **Resend** | `https://api.resend.com/emails` | E-mails hors-app (file `notification_external_queue`, canal `email`) | `RESEND_API_KEY`, `EMAIL_FROM` |
| **Twilio Content API (WhatsApp)** | Content API + Messages WhatsApp | C-pilote : patient répondu (v2 link) + traité ; pharmacien nouvelle demande | `TWILIO_WHATSAPP_CONTENT_SID_*` |
| **Twilio Messages** | `https://api.twilio.com/.../Messages.json` | **Legacy** — plus d’enqueue SMS métier (`20260811_001`) ; route test `/api/cron/test-external-sms` seulement | `TWILIO_SMS_FROM` (optionnel) |
| **Twilio Verify** | Via **Supabase Auth** (Phone) | OTP inscription / reset téléphone (SMS ou WhatsApp selon config) — **≠** notifs métier | Config dashboard Supabase + compte Twilio |
| **Supabase Auth API** | `GET .../auth/v1/user` | Vérification JWT sur routes API (`lib/verify-bearer-user.ts`) | Clés Supabase |

**Implémentation** : `lib/external-notification-queue-worker.ts`, `lib/twilio-whatsapp.ts`.

### Prévu (phase 2+ — templates Meta restants)

| Service | Statut | Usage prévu |
|---------|--------|-------------|
| **WhatsApp traité v2 link** | Template à soumettre | Lien `/r/` sur événement traité |
| **WhatsApp événements étendus** | Code après templates M2 | 4 patient + 4 pharmacien restants |
| **SMTP personnalisé Supabase** | Recommandé prod | E-mails Auth (OTP, reset) via Resend/SendGrid côté Supabase |

---

## 4. APIs navigateur et liens profonds (sans clé API)

| Technologie | Utilisation | Fichiers / contexte |
|-------------|-------------|---------------------|
| **Geolocation API** | Rayon « près de moi » annuaire | `lib/annuaire/geo.ts` |
| **Web Share API** | Partager fiche / annuaire | `navigator.share` — fiche publique, cartes annuaire |
| **`tel:`** | Appeler l’officine | Annuaire, fiche, CRM pharmacien |
| **`https://wa.me/{E.164}`** | WhatsApp manuel (deep link) | Pas d’API Meta ; `profiles.whatsapp` / `pharmacies.whatsapp` |
| **Google Maps / Waze / Apple Maps** | Itinéraire (URLs uniquement) | `lib/pharmacy-navigation.ts` |
| **Google Fonts (Geist)** | Typographie | `app/layout.tsx` — `next/font/google` |

---

## 5. Médias et images distantes

| Source | Utilisation | Détails |
|--------|-------------|---------|
| **Supabase Storage CDN** | Photos catalogue, officines, médias privés | `lib/storage-media.ts`, `resolvePublicMediaUrl` |
| **Unsplash** (`images.unsplash.com`) | Seed démo catalogue | Migrations `20260511_002` ; `next.config.ts` `remotePatterns` — pas d’API runtime patient |

---

## 6. Routes API internes (Next.js)

| Route | Rôle | Dépendances |
|-------|------|-------------|
| `POST /api/cron/send-external-emails` | Worker e-mails | Resend, Supabase service role |
| `POST /api/cron/send-external-whatsapp` | Worker WhatsApp | Twilio Content API, Supabase |
| `POST /api/cron/send-external-sms` | Worker SMS (legacy, plus d’enqueue métier) | Twilio, Supabase |
| `POST /api/webhooks/dispatch-external-sms` | Traitement immédiat file (e-mail ou WhatsApp par INSERT) | Idem |
| `POST /api/cron/expire-overdue-requests` | Expiration `responded` (24 h par défaut) | RPC `expire_overdue_requests()` |
| `POST /api/auth/signup-phone-check` | Anti-doublon téléphone avant OTP | RPC `auth_phone_user_exists` |
| `POST /api/auth/request-password-reset` | Reset MDP e-mail | Supabase Auth |
| `POST /api/admin/onboard-pharmacy` | Création officine + pharmacien | Supabase Auth Admin |
| `POST /api/media/private-signed-url` | Lecture médias privés | Storage URL signée |
| `GET /r/[token]` | Raccourci lien court → dossier patient | Redirection interne |
| `GET /rp/[token]` | Raccourci lien court → dossier pharmacien | Redirection interne |
| `POST /api/patient/prescription-page` | Ordonnance (serveur) | Storage / métier prescription |

Protection crons / webhook : en-tête `Authorization: Bearer <CRON_SECRET>`.

---

## 7. Bibliothèques front (sans API externe)

| Librairie | Usage |
|-----------|--------|
| `@supabase/supabase-js` | Client Supabase (REST) |
| `lucide-react` | Icônes |
| `recharts` | Graphiques analytics pharmacien |
| `@base-ui/react`, `shadcn` | Composants UI |

---

## 8. Scripts ops (Node, hors runtime Vercel)

| Script | Usage |
|--------|--------|
| `scripts/clear-all-requests.mjs` | Reset demandes pilote |
| `scripts/reset-storage-keep-product-photos-only.mjs` | Reset Storage (garde `products/`) |
| `scripts/attach-catalog-images.mjs` | Rattacher photos catalogue |
| `scripts/import-products-catalog.mjs` | Import catalogue |
| `supabase/scripts/*.sql` | Reset pilote, horaires, etc. (SQL Editor) |

Prérequis scripts : `.env.local` avec `SUPABASE_SERVICE_ROLE_KEY` ; sous Windows : `node --use-system-ca` si erreur TLS.

---

## 9. Variables d’environnement (synthèse)

| Variable | Service / usage |
|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase (client) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase (client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase serveur (crons, admin, signed URLs) |
| `RESEND_API_KEY` | Resend |
| `EMAIL_FROM` | Expéditeur e-mail Resend |
| `TWILIO_ACCOUNT_SID` | Twilio |
| `TWILIO_AUTH_TOKEN` | Twilio |
| `TWILIO_WHATSAPP_FROM` | Expéditeur WhatsApp Business (`whatsapp:+212…`) |
| `TWILIO_WHATSAPP_CONTENT_SID_RESPONDED` | Modèle Meta répondu (v1) |
| `TWILIO_WHATSAPP_CONTENT_SID_TREATED` | Modèle Meta traité (v1) |
| `WHATSAPP_TEST_TO` | Route test WhatsApp |
| `TWILIO_SMS_FROM` | Legacy test SMS (optionnel) |
| `SMS_BLOCKED_DESTINATIONS` | Numéros test bloqués (legacy SMS) |
| `SMS_TEST_TO` | Route test SMS legacy |
| `CRON_SECRET` | Protection crons + webhook Supabase |
| `APP_BASE_URL` | URL publique (serveur) |
| `NEXT_PUBLIC_APP_BASE_URL` | URL publique (navigateur, Auth) |
| `VERCEL_URL` | Fallback URL preview Vercel |
| `EXPIRE_RESPONDED_SILENCE` | Surcharge délai expiration `responded` |
| `SMS_INCLUDE_REQUEST_LINK` | Lien court SMS (legacy — SMS métier off) |

---

## 10. Non utilisé (état actuel du dépôt)

- Paiement (Stripe, CMI, etc.)
- Cartographie payante (Google Maps Platform, Mapbox API)
- Analytics tiers (GA4, Posthog, Sentry) — analytics fiche = RPC `pharmacist_profile_analytics`
- Envoi WhatsApp API automatisé pharmacien + événements étendus (patient P0 livré — `RUNBOOK.md` §10)
- OpenAI / OCR cloud (ordonnance = upload + saisie pharmacien)

---

## 11. Export de ce document (PDF sans Pandoc)

1. Générer la page d’impression (une fois après modification du `.md`) :
   ```bash
   node scripts/export-architecture-apis-html.mjs
   ```
2. Ouvrir **`docs/ARCHITECTURE-APIS-print.html`** dans **Chrome** ou **Edge** (double-clic dans l’Explorateur).
3. **Ctrl+P** → Destination **Enregistrer au format PDF** → Enregistrer.

Alternative Cursor : extension **Markdown PDF** → clic droit sur ce fichier → *Markdown PDF: Export (pdf)*.
