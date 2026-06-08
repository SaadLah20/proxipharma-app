-- Pharmeto rebrand : ancrage migration (copy in-app patient déjà sans « ProxiPharma » depuis 20260701_001).
-- Aucune modification fonctionnelle requise si 20260701_001 est appliquée.

COMMENT ON FUNCTION public._in_app_notification_patient(
  public.request_status_enum,
  text,
  text,
  text,
  text,
  text
) IS 'Notifications in-app patient (FR) — marque Pharmeto / pharmeto.ma (2026-07-15).';
