# WhatsApp notifs métier — reprise (juin 2026)

Document de reprise pour fondateur + agent. Détail ops : **`RUNBOOK.md` §10**.

## État au 12/06/2026

### Livré en prod (PR **#344** — `feature/whatsapp-c-pilote`, mergée `main`)

| Événement | Rôle | Template | Content SID | Code |
|-----------|------|----------|-------------|------|
| `request_status:responded` | patient | `pharmeto_request_responded_fr_v2_link` | `HX887df3db18f89b20a78cfec865745d28` | ✅ testé OK |
| `request_status:submitted` | pharmacien | `pharmeto_pharmacy_new_request_fr` | `HX806ef0e68b7e5f2a6cc674b4637e4a60` | ✅ testé OK |
| `request_status:treated` | patient | `copy_pharmeto_request_treated_fr` (v1, sans lien) | `HX5aa3d5e71dc6242ac53448fb95022f54` | ✅ prod |

**Code** : `lib/twilio-whatsapp.ts`, `lib/external-notification-queue-worker.ts`, `app/rp/[token]/route.ts`, test `/api/cron/test-external-whatsapp`.

**Migration Supabase** : `20260817_001_whatsapp_c_pilote_pharmacist_enqueue.sql` (enqueue WhatsApp pharmacien `submitted`).

**Secours v1 répondu** (rollback) : `copy_pharmeto_request_responded_fr` → `HXe97624f91a846e92c56ca0fe2fabd2d5`.

### En attente Meta (soumis 12/06/2026 — lot M2 patient)

Business initiated **gris** = pending. **Ne pas coder** tant que pas **Approved** (vert).

| Template | Content SID | `event_type` |
|----------|-------------|--------------|
| `pharmeto_request_treated_fr_v2_link` | `HX7bb5e8dfca48fde180a316a0f0dc0e91` | `request_status:treated` |
| `pharmeto_request_expired_fr_v2_link` | `HX781b5d3d9091c307629c722799559825` | `request_status:expired` |
| `pharmeto_request_reminder_fr_v2_link` | `HX671183dc98399066641bbf71670cce3c` | `request_event:responded_expiry_reminder` |

### M2 restant (pas encore soumis Twilio)

**Patient** (bouton `https://pharmeto.ma/r/{{3}}`) :

| Template name | `event_type` |
|---------------|--------------|
| `pharmeto_request_product_arrived_fr_v2_link` | `request_event:post_confirm_product_arrived` |
| `pharmeto_request_shortage_available_fr_v2_link` | `request_event:market_shortage_product_available` |

**Pharmacien** (bouton `https://pharmeto.ma/rp/{{3}}`) :

| Template name | `event_type` |
|---------------|--------------|
| `pharmeto_pharmacy_confirmed_fr` | `request_status:confirmed` |
| `pharmeto_pharmacy_prescription_updated_fr` | `request_status:patient_prescription_updated` |
| `pharmeto_pharmacy_visit_updated_fr` | `request_event:patient_planned_visit_updated` |
| `pharmeto_pharmacy_patient_message_fr` | `request_conversation:message` |

Textes templates M2 : demander à l’agent *« étape M2 »* ou voir historique chat juin 2026.

---

## Variables Vercel (prod actuelles)

```
TWILIO_WHATSAPP_FROM=whatsapp:+212770165668
TWILIO_WHATSAPP_CONTENT_SID_RESPONDED=HX887df3db18f89b20a78cfec865745d28
TWILIO_WHATSAPP_CONTENT_SID_TREATED=HX5aa3d5e71dc6242ac53448fb95022f54
TWILIO_WHATSAPP_CONTENT_SID_PHARMACY_NEW_REQUEST=HX806ef0e68b7e5f2a6cc674b4637e4a60
```

**Après C-suite lot 1** (quand les 3 pending sont Approved) :

```
TWILIO_WHATSAPP_CONTENT_SID_TREATED=HX7bb5e8dfca48fde180a316a0f0dc0e91
TWILIO_WHATSAPP_CONTENT_SID_EXPIRED=HX781b5d3d9091c307629c722799559825
TWILIO_WHATSAPP_CONTENT_SID_REMINDER=HX671183dc98399066641bbf71670cce3c
```

---

## Phrases de reprise (copier-coller dans un nouveau chat **Agent**)

### Quand les 3 templates M2 sont **Approved** (business initiated vert)

Capture Twilio recommandée + phrase :

```
Continuons WhatsApp — 3 templates Approved, étape C-suite (lot patient M2)

Les 3 templates Meta sont Approved (business initiated vert) :
- pharmeto_request_treated_fr_v2_link → HX7bb5e8dfca48fde180a316a0f0dc0e91
- pharmeto_request_expired_fr_v2_link → HX781b5d3d9091c307629c722799559825
- pharmeto_request_reminder_fr_v2_link → HX671183dc98399066641bbf71670cce3c

Contexte déjà livré et testé (C-pilote, PR #344 mergée main) :
- pharmeto_request_responded_fr_v2_link → HX887df3db18f89b20a78cfec865745d28
- pharmeto_pharmacy_new_request_fr → HX806ef0e68b7e5f2a6cc674b4637e4a60
- Migration 20260817_001 appliquée Supabase · routes /r/ et /rp/

À faire : intégrer ces 3 événements patient dans lib/twilio-whatsapp.ts + worker + variables Vercel ; basculer TWILIO_WHATSAPP_CONTENT_SID_TREATED vers v2 ; commit + push + PR.

Reprise doc : docs/WHATSAPP-NOTIFS-REPRISE.md

Ensuite je soumettrai les 6 templates M2 restants (produit reçu, rupture, 4 pharmacien).
```

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
