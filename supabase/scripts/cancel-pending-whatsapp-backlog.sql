-- Annule les WhatsApp encore en file (backlog pilote / tests avant fix webhook).
-- Supabase → SQL Editor → Run (modale « Run without RLS » si proposée).
-- N'affecte pas les lignes déjà envoyées (status = sent).

update public.notification_external_queue
set
  status = 'failed',
  attempt_count = 99,
  last_error = 'annulé : backlog WhatsApp pilote (tests)',
  sent_at = null
where channel = 'whatsapp'::public.notification_external_channel_enum
  and status in ('pending', 'processing');
