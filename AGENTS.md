<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

Demande « produits » (MVP), ordre d’affinage UI par statut et règles dossiers figés : **`CAHIER_DES_CHARGES.md` §4.6**.

Après validation patient : statuts DB **`processing`** (préparation officine) et **`treated`** (préparation déclarée terminée, suivi comptoir), colonne **`request_items.withdrawn_after_confirm`**, table **`request_supply_amendments`** et RPC associées — voir **`CAHIER_DES_CHARGES.md` §4.4** et migration **`supabase/migrations/20260508_002_processing_treated_supply_workflow.sql`**. Le hub peut encore afficher **`in_progress_virtual`** quand le dossier est **`confirmed`** avec **`post_confirm_fulfillment`** sans passage en **`processing`**.
