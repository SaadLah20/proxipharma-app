# WhatsApp notifs métier — reprise (juin 2026)

Document de reprise pour fondateur + agent. Détail ops : **`RUNBOOK.md` §10**.

## État au 15/06/2026

### Livré en prod (PR **#344** — `feature/whatsapp-c-pilote`, mergée `main`)

| Événement | Rôle | Template | Content SID | Code |
|-----------|------|----------|-------------|------|
| `request_status:responded` | patient | `pharmeto_request_responded_fr_v2_link` | `HX887df3db18f89b20a78cfec865745d28` | ✅ testé OK |
| `request_status:submitted` | pharmacien | `pharmeto_pharmacy_new_request_fr` | `HX806ef0e68b7e5f2a6cc674b4637e4a60` | ✅ testé OK |
| `request_status:treated` | patient | `copy_pharmeto_request_treated_fr` (v1, sans lien) | `HX5aa3d5e71dc6242ac53448fb95022f54` | ✅ prod (v1) |

**Code** : `lib/twilio-whatsapp.ts`, `lib/external-notification-queue-worker.ts`, `app/rp/[token]/route.ts`, test `/api/cron/test-external-whatsapp`.

**Migration Supabase** : `20260817_001_whatsapp_c_pilote_pharmacist_enqueue.sql` (enqueue WhatsApp pharmacien `submitted`).

**Secours v1 répondu** (rollback) : `copy_pharmeto_request_responded_fr` → `HXe97624f91a846e92c56ca0fe2fabd2d5`.

**Secours v1 traité** (rollback) : `copy_pharmeto_request_treated_fr` → `HX5aa3d5e71dc6242ac53448fb95022f54`.

### C-suite lot 1 patient M2 — Approved Meta 13/06/2026 (mergée `main`)

| Template | Content SID | `event_type` | Env Vercel |
|----------|-------------|--------------|------------|
| `pharmeto_request_treated_fr_v2_link` | `HX7bb5e8dfca48fde180a316a0f0dc0e91` | `request_status:treated` | `TWILIO_WHATSAPP_CONTENT_SID_TREATED` |
| `pharmeto_request_expired_fr_v2_link` | `HX781b5d3d9091c307629c722799559825` | `request_status:expired` | `TWILIO_WHATSAPP_CONTENT_SID_EXPIRED` |
| `pharmeto_request_reminder_fr_v2_link` | `HX671183dc98399066641bbf71670cce3c` | `request_event:responded_expiry_reminder` | `TWILIO_WHATSAPP_CONTENT_SID_REMINDER` |

Branche : `feature/whatsapp-c-suite-m2-lot1` (commit **`a0c69ae`**). Pas de migration Supabase (enqueue déjà OK via `20260817_001`).

### M2 lot 2 partiel — Approved Meta 15/06/2026 — **prod** (PR **#369**, vars Vercel OK)

| Template | Content SID | `event_type` | Env Vercel |
|----------|-------------|--------------|------------|
| `pharmeto_request_product_arrived_fr_v2_link` | `HX60d070b8ea5b8f02f38209cb79f18d05` | `request_event:post_confirm_product_arrived` | `TWILIO_WHATSAPP_CONTENT_SID_PRODUCT_ARRIVED` |
| `pharmeto_request_shortage_available_fr_v2_link` | `HXbe4a11fd3dd30f9bfc1023c33afc58aa` | `request_event:market_shortage_product_available` | `TWILIO_WHATSAPP_CONTENT_SID_SHORTAGE_AVAILABLE` |
| `pharmeto_pharmacy_confirmed_fr` | `HX974770152c33d37c18defeef9e0809e2` | `request_status:confirmed` | `TWILIO_WHATSAPP_CONTENT_SID_PHARMACY_CONFIRMED` |

Migration **`20260826_001`** (enqueue pharmacien `confirmed`). **8 événements WhatsApp actifs** en prod (avant lot 3).

### M2 lot 3 pharmacien — Approved Meta 15/06/2026 (code + migration `20260828_001`)

| Template | Content SID | `event_type` | Env Vercel |
|----------|-------------|--------------|------------|
| `pharmeto_pharmacy_visit_updated_fr` | `HX6a9cc14a6400341a91be956857943ae2` | `request_event:patient_planned_visit_updated` | `TWILIO_WHATSAPP_CONTENT_SID_PHARMACY_VISIT_UPDATED` |
| `pharmeto_pharmacy_prescription_updated_fr` | `HXc1e711549498a13063f41c806cbd860c` | `request_status:patient_prescription_updated` | `TWILIO_WHATSAPP_CONTENT_SID_PHARMACY_PRESCRIPTION_UPDATED` |
| `pharmeto_pharmacy_patient_message_fr` | `HXf06efe852d03609d335ee6e89207ea17` | `request_conversation:message` | `TWILIO_WHATSAPP_CONTENT_SID_PHARMACY_PATIENT_MESSAGE` |

**11 événements WhatsApp** après merge + vars Vercel lot 3.

**En attente (3)** : templates passage pas encore soumis Meta (ci-dessous).

### Lot expiration passage (juin 2026 — migration `20260823_001`)

**In-app + e-mail** : actifs dès migration appliquée. **WhatsApp** : enqueue OK ; envoi seulement si SID Meta approuvé (sinon worker ignore, comme M2).

| Template (à soumettre Meta) | Rôle | `event_type` | Env Vercel (proposé) |
|-----------------------------|------|--------------|----------------------|
| `pharmeto_pickup_reminder_fr_v2_link` | patient | `request_event:planned_visit_day_reminder` / `planned_visit_pre_passage_reminder` | `TWILIO_WHATSAPP_CONTENT_SID_PICKUP_REMINDER` (repli : `TWILIO_WHATSAPP_CONTENT_SID_REMINDER`) |
| `pharmeto_pharmacy_responded_expiry_fr` | pharmacien | `request_event:responded_expiry_pharmacist_reminder` | `TWILIO_WHATSAPP_CONTENT_SID_PHARMACY_RESPONDED_EXPIRY` |
| `pharmeto_pharmacy_pickup_missed_fr` | pharmacien | `request_event:planned_visit_passed_no_pickup` | `TWILIO_WHATSAPP_CONTENT_SID_PHARMACY_PICKUP_MISSED` |

Cron : `POST /api/cron/expire-overdue-requests` (GitHub Actions 5 min) — appelle aussi `remind_planned_visit_passage`, `alert_pharmacist_pickup_missed`, `remind_pharmacist_responded_expiry`, `abandon_overdue_pickup_requests`.

---

## Variables Vercel (prod — après merge M2 lot 3)

```
TWILIO_WHATSAPP_FROM=whatsapp:+212770165668
TWILIO_WHATSAPP_CONTENT_SID_RESPONDED=HX887df3db18f89b20a78cfec865745d28
TWILIO_WHATSAPP_CONTENT_SID_TREATED=HX7bb5e8dfca48fde180a316a0f0dc0e91
TWILIO_WHATSAPP_CONTENT_SID_EXPIRED=HX781b5d3d9091c307629c722799559825
TWILIO_WHATSAPP_CONTENT_SID_REMINDER=HX671183dc98399066641bbf71670cce3c
TWILIO_WHATSAPP_CONTENT_SID_PHARMACY_NEW_REQUEST=HX806ef0e68b7e5f2a6cc674b4637e4a60
TWILIO_WHATSAPP_CONTENT_SID_PRODUCT_ARRIVED=HX60d070b8ea5b8f02f38209cb79f18d05
TWILIO_WHATSAPP_CONTENT_SID_SHORTAGE_AVAILABLE=HXbe4a11fd3dd30f9bfc1023c33afc58aa
TWILIO_WHATSAPP_CONTENT_SID_PHARMACY_CONFIRMED=HX974770152c33d37c18defeef9e0809e2
TWILIO_WHATSAPP_CONTENT_SID_PHARMACY_VISIT_UPDATED=HX6a9cc14a6400341a91be956857943ae2
TWILIO_WHATSAPP_CONTENT_SID_PHARMACY_PRESCRIPTION_UPDATED=HXc1e711549498a13063f41c806cbd860c
TWILIO_WHATSAPP_CONTENT_SID_PHARMACY_PATIENT_MESSAGE=HXf06efe852d03609d335ee6e89207ea17
```

**Rollback traité v1** : `TWILIO_WHATSAPP_CONTENT_SID_TREATED=HX5aa3d5e71dc6242ac53448fb95022f54` (sans lien bouton).

---

## Phrases de reprise (copier-coller dans un nouveau chat **Agent**)

### Quand les 3 templates pharmacien lot 3 étaient **Approved** (visit / ordonnance / message) — fait 15/06/2026

### Quand les 3 templates M2 lot 2 étaient **Approved** (produit, rupture, validée) — fait 15/06/2026

### Quand les 3 templates M2 lot 1 étaient **Approved** (traité v2, expiré, rappel) — fait juin 2026

### Si Meta **Rejected** un template

```
Continuons WhatsApp — pilote Rejected
Template : [nom]
Motif Meta : [copier-coller]
```

(+ capture Twilio)

### Pour les textes des 6 templates restants (M2 suite)

```
Continuons WhatsApp — étape M2 (fiche des 6 templates restants)
```

---

## Qui fait quoi

| Zone | Fondateur | Agent |
|------|-----------|-------|
| Templates Twilio/Meta | Créer, soumettre, attendre Approved | Fournit textes exacts (M2) |
| Variables Vercel | Coller SID + redeploy | Liste les noms d'env |
| Migration Supabase | SQL Editor quand signalé | Écrit `supabase/migrations/…` |
| Code worker | Tester preview, Merge PR | Code, commit, push, PR |

**Règles Meta** : Utility · Call to action · Website · **Save with samples** · URL `pharmeto.ma/r/{{3}}` ou `/rp/{{3}}` · texte fixe après dernière variable du corps.

**Ne pas** MM Lite (erreur 63055). **Ne pas** supprimer templates v1 tant que v2 non basculés en prod.
