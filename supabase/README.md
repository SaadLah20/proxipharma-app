# Supabase migrations

This folder stores SQL migrations that must be versioned in git.

## Current baseline

- `migrations/20260429_001_rls_baseline.sql`
  - Enables RLS on `profiles`, `pharmacies`, and `pharmacy_staff`
  - Adds role-based policies for `admin`, `pharmacien`, and authenticated users
  - Includes `public.is_admin()` helper to prevent recursive profile policy checks
- `migrations/20260430_001_products_reference.sql`
  - Creates `products` reference table for pharmacy workflows
  - Adds indexes for search/autocomplete and filters
  - Configures RLS as public read and admin-only write
- `migrations/20260430_002_requests_workflow_v1.sql`
  - Creates hybrid request workflow model (common + type-specific tables)
  - Adds request items, alternatives, comments, and status history
  - Adds market shortage tracking per pharmacy
  - Configures initial RLS access for patient, pharmacien, and admin

## How to apply

1. Open Supabase SQL Editor.
2. Run the migration file content.
3. Validate app access for invite, patient, pharmacien, and admin roles.

## Rule for next changes

For every database change:

1. Create a new SQL file in `supabase/migrations/`
2. Use incremental prefix format:
   - `YYYYMMDD_XXX_description.sql`
3. Apply in Supabase
4. Commit migration in the same PR as app code changes
