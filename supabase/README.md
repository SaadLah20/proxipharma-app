# Supabase migrations

Ce dossier contient le SQL versionne sous Git (**source de verite schema + RLS / RPC majeurs** pour l assistant et les humains). L aide IA Cursor **ne se connecte pas** a votre projet Supabase : synchroniser cette arborescence avec la base passe par vos actions (SQL Editor dans l ordre, ou CLI).

## Chronologie fichiers migrations (baseline -> recent)

| Fichier | Role |
|---------|------|
| `20260429_001_rls_baseline.sql` | RLS profiles, pharmacies, pharmacy_staff ; helper `is_admin()` |
| `20260430_001_products_reference.sql` | Table `products` reference (lecture large, ecriture admin) |
| `20260430_002_requests_workflow_v1.sql` | Modele hybride demandes (`requests` + tables par type), items, alternatives, comments, historique statuts, `market_shortages` |
| `20260501_001_patient_reaction_and_alternative_rls.sql` | RLS alternatives (ecriture pharmacien/admin) ; RPC patient `patient_confirm_*` / abandon ; fonction `expire_overdue_requests()` (service_role) |
| `20260501_002_seed_workflow_demo.sql` | Seed optionnel demo (demande responded + alternatives si donnees presentes) |
| `20260502_001_resubmit_after_response_and_counter_pickup.sql` | Revision client liste produits apres responded/confirmed ; `counter_outcome` + statut **`completed`** ; RPC pharmacien comptoir ; RPC `patient_resubmit_*` |
| `20260503_001_patient_chosen_alternative.sql` | `patient_chosen_alternative_id` ; RPC confirmation enrichi |
| `20260503_003_seed_products_thirty_ma.sql` | Seed produits démo (~31, MAD) |
| `20260503_004_patient_planned_visit.sql` | Passage officine ; RPC `patient_confirm_after_response` 4 args |
| `20260503_005_abandon_24h_qty_dupe_shortage_reasons.sql` | Qté 1–10, unique produit/demande, motifs abandon/annulation, `abandon_unconfirmed_responded_requests`, trigger `market_shortages` |
| `20260503_006_patient_resubmit_submitted_in_review.sql` | `patient_resubmit_*` aussi depuis **`submitted` / `in_review`** |
| `20260503_007_profiles_pharmacist_select_request_patients.sql` | Policy `profiles` (⚠️ provoque récursion si **009** non appliquée) |
| `20260503_008_pharmacist_patient_contact_rpc.sql` | RPC **`pharmacist_patient_contact_for_request`** + **`pharmacist_patient_directory_for_my_pharmacy`** (lecture nom/contact patient) |
| `20260503_009_drop_profiles_policy_007_recursion.sql` | Supprime la policy **007** (corrige récursion RLS) |

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
