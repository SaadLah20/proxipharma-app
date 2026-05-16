-- Annule les envois en file vers un numéro erroné (ex. 0600000123 / 212600000123).
-- Exécuter dans Supabase SQL Editor après correction de profiles.whatsapp.

update public.notification_external_queue
set
  status = 'failed',
  attempt_count = 99,
  last_error = 'annulé : numéro invalide (pilote)',
  sent_at = null
where destination_snapshot ~ '600000123'
  and status in ('pending', 'processing', 'failed');
