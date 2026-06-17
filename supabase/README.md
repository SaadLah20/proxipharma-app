# Supabase migrations

Ce dossier contient le SQL versionne sous Git (**source de verite schema + RLS / RPC majeurs** pour l assistant et les humains). L aide IA Cursor **ne se connecte pas** a votre projet Supabase : synchroniser cette arborescence avec la base passe par vos actions (SQL Editor dans l ordre, ou CLI).

## Chronologie fichiers migrations (baseline -> recent)

| Fichier | Role |
|---------|------|
| `20260429_001_rls_baseline.sql` | RLS profiles, pharmacies, pharmacy_staff ; helper `is_admin()` |
| `20260430_001_products_reference.sql` | Table `products` reference (lecture large, ecriture admin) |
| `20260430_002_requests_workflow_v1.sql` | Modele hybride demandes (`requests` + tables par type), items, alternatives, comments, historique statuts, `market_shortages` |
| `20260501_001_patient_reaction_and_alternative_rls.sql` | RLS alternatives (ecriture pharmacien/admin) ; RPC patient `patient_confirm_*` / abandon ; **`expire_overdue_requests(interval)`** (corps final **`20260523_001`**) |
| `20260501_002_seed_workflow_demo.sql` | Seed optionnel demo (demande responded + alternatives si donnees presentes) |
| `20260502_001_resubmit_after_response_and_counter_pickup.sql` | Revision client liste produits apres responded/confirmed ; `counter_outcome` + statut **`completed`** ; RPC pharmacien comptoir ; RPC `patient_resubmit_*` |
| `20260503_001_patient_chosen_alternative.sql` | `patient_chosen_alternative_id` ; RPC confirmation enrichi |
| `20260503_003_seed_products_thirty_ma.sql` | Seed produits démo (~31, MAD) |
| `20260503_004_patient_planned_visit.sql` | Passage officine ; RPC `patient_confirm_after_response` 4 args |
| `20260503_005_abandon_24h_qty_dupe_shortage_reasons.sql` | Qté 1–10, unique produit/demande, motifs abandon/annulation, `abandon_unconfirmed_responded_requests` (alias **`expire_overdue_requests`** depuis **`20260516_001`**), trigger `market_shortages` |
| `20260829_001_market_shortage_skip_pharmacy_catalog_lines.sql` | Rupture marché : pas d’insert **`market_shortages`** si ligne catalogue privé (`product_id` null) |
| `20260830_001_pharmacy_catalog_restore_archived_hidden.sql` | Mes produits : lister `archived_hidden` + RPC **`pharmacist_restore_pharmacy_product`** |
| `20260831_001_pharmacy_catalog_list_supprimes_filter.sql` | Filtre RPC : Dépubliés ≠ Supprimés (`archived_hidden` séparé) |
| `20260832_001_pharmacist_officine_notes_hub.sql` | Hub Notes officine (pharmacien) |
| `20260833_001_catalog_product_reports.sql` | Signalements produits catalogue (pharmacien + admin) |
| `20260834_001_pharmacist_pharmacy_ratings_hub.sql` | Hub avis patients (pharmacien) |
| `20260835_001_catalog_product_report_admin_form.sql` | Signalements : formulaire admin + valeurs appliquées |
| `20260836_001_pharmacist_dashboard_snapshot_v2.sql` | Tableau de bord pharmacien : RPC snapshot v2 (garde, messages, KPIs officine) |
| `20260507_001_patient_abandon_cancel_expire_clone.sql` | Règles abandon/annulation/expiré ; batch 24 h → **`expired`** ; RPC **`patient_create_followup_from_expired_product_request`** |
| `20260507_002_counter_cancel_reason.sql` | Motifs d'annulation ligne au comptoir (client / pharmacie) + détail libre, RPC `pharmacist_set_item_counter_outcome` étendue |
| `20260507_003_pharmacist_cancel_request.sql` | RPC **`pharmacist_cancel_request`** : annulation totale par la pharmacie avec motif (submitted / in_review / responded / confirmed → cancelled) |
| `20260503_006_patient_resubmit_submitted_in_review.sql` | `patient_resubmit_*` aussi depuis **`submitted` / `in_review`** |
| `20260503_007_profiles_pharmacist_select_request_patients.sql` | Policy `profiles` (⚠️ provoque récursion si **009** non appliquée) |
| `20260503_008_pharmacist_patient_contact_rpc.sql` | RPC **`pharmacist_patient_contact_for_request`** + **`pharmacist_patient_directory_for_my_pharmacy`** (lecture nom/contact patient) |
| `20260503_009_drop_profiles_policy_007_recursion.sql` | Supprime la policy **007** (corrige récursion RLS) |
| `20260511_001_pharmacist_in_app_notif_trim_body.sql` | Corps notif in-app pharmacien allégé |
| `20260511_002_seed_products_unsplash_photo_urls.sql` | Seed photos Unsplash (noms courts) |
| `20260511_003_products_photo_url_backfill_by_name.sql` | Backfill `photo_url` par nom |
| `20260512_001_ma_catalog_photos_and_extended_products.sql` | Photos catalogue MAROC + **`seed_ma_catalog_v2`** |
| `20260512_002_remove_request_processing_status.sql` | Retrait **`processing`** ; flux **`confirmed`** / **`treated`** |
| `20260514_001_in_app_notification_copy_tuning.sql` | Libellés notifs patient ; `DROP` surcharges **`_in_app_notification_patient`** |
| `20260515_001_no_in_app_notif_counter_picked_up.sql` | Pas de notif in-app pour **`counter_outcome:picked_up`** |
| `20260516_001_expire_overdue_responded_at_pilot_30m.sql` | **`expire_overdue_requests(interval)`** + alias abandon ; silence **30 min** (pilote, remplacé par **023**) |
| `20260521_001_profiles_email_nullable.sql` | `profiles.email` nullable (patients SMS sans e-mail) |
| `20260522_001_sms_pilot_responded_treated_patient_only.sql` | Enqueue SMS patient : **`responded`** + **`treated`** uniquement |
| `20260522_002_disable_pharmacist_sms.sql` | Désactive prefs SMS pharmacien + annule file SMS pharmacien |
| `20260522_003_auth_phone_exists_signup_guard.sql` | RPC **`auth_phone_user_exists`** (inscription : téléphone déjà pris) |
| `20260523_001_expire_responded_silence_24h.sql` | Défaut expiration **`responded`** → **24 h** (remplace 30 min) |
| `20260811_001_disable_external_sms_notifications.sql` | **SMS alertes métier off** ; enqueue **e-mail + WhatsApp** patient (P0 répondu/traité) ; annule SMS `pending`/`processing` |
| `20260812_001_planned_visit_pharmacy_hours_validation.sql` | Passage patient : garde horaires officine (≥ 30 min si aujourd’hui, jour fermé, hors créneaux) dans **`patient_confirm_after_response`** et **`patient_update_planned_visit_after_confirmation`** |
| `20260817_001_whatsapp_c_pilote_pharmacist_enqueue.sql` | WhatsApp C-pilote : enqueue pharmacien **`submitted`** (nouvelle demande) en plus du patient P0 |
| `20260818_001_admin_community_catalog_publish.sql` | Catalogue communautaire Phase C : RPC admin list/enrich/publish + compteur file |
| `20260819_001_pharmacy_catalog_archived_hidden_enum.sql` | Enum `archived_hidden` — **exécuter seul** (commit requis avant 002) |
| `20260819_002_pharmacy_catalog_pharmacist_archive.sql` | Mes produits : RPC archivage pharmacien + modifier si dépublié |

**Ordre** : après **007**, appliquer **009** sur toute base où **007** a été jouée. En pratique **008 + 009** suffisent pour le contact patient côté pharmacien (sans policy **007**).

Regle **supabase/.temp/** (CLI locale) gitignore projet racine pour ne pas polluer le depot.

## Comment appliquer

1. Ouvrir Supabase **SQL Editor** (ou `supabase db push` si projet lie CLI).
2. Executer les migrations **dans l ordre** des prefixes `YYYYMMDD_...`.
3. Valider depuis l app invites / patient / pharmacien / admin comme decrit dans `CAHIER_DES_CHARGES.md`.

## Regle pour toute évolution suivante

1. Ajouter **un nouveau** fichier sous `supabase/migrations/` (prefix incremental `YYYYMMDD_XXX_description.sql`).
2. Commit Git **meme MR / meme lot** que les changements app Next si possible.
3. Appliquer sur Supabase ; ne pas faire evoluer uniquement prod sans fichier migre équivalent depot.
