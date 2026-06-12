-- Étape 1/2 — valeur enum archived_hidden.
-- PostgreSQL exige un COMMIT avant d'utiliser une nouvelle valeur enum.
-- Exécuter ce fichier SEUL, puis 20260819_002_pharmacy_catalog_pharmacist_archive.sql.

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'pharmacy_catalog_product_status'
      and e.enumlabel = 'archived_hidden'
  ) then
    alter type public.pharmacy_catalog_product_status add value 'archived_hidden';
  end if;
end $$;
