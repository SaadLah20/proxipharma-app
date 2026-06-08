-- Diagnostic SMS hors-app (pilote ProxiPharma / Pharmeto)
-- Supabase → SQL Editor → Run (modale « Run without RLS » si proposée)
--
-- Remplacer YOUR_PATIENT_USER_ID par l'uuid du compte patient test (Table Editor → profiles)

-- 1) Profil + prefs + numéro SMS (destination = profiles.whatsapp, pas auth.users.phone)
select
  p.id,
  p.full_name,
  p.role,
  p.whatsapp,
  p.email,
  pref.sms_enabled,
  pref.email_enabled,
  pref.whatsapp_enabled,
  pref.updated_at as prefs_updated_at
from public.profiles p
left join public.notification_external_prefs pref on pref.user_id = p.id
where p.id = 'YOUR_PATIENT_USER_ID'::uuid;

-- 2) Dernières lignes file SMS pour ce patient (30 jours)
select
  q.created_at,
  q.event_type,
  q.status,
  q.destination_snapshot,
  q.attempt_count,
  q.last_error,
  q.sent_at,
  q.provider_message_id,
  left(q.title, 80) as title
from public.notification_external_queue q
where q.recipient_id = 'YOUR_PATIENT_USER_ID'::uuid
  and q.channel = 'sms'
  and q.created_at > now() - interval '30 days'
order by q.created_at desc
limit 20;

-- 3) SMS en attente (webhook / cron pas passé)
select id, created_at, event_type, destination_snapshot, status, last_error
from public.notification_external_queue
where channel = 'sms'
  and status in ('pending', 'processing')
order by created_at desc
limit 20;

-- 4) SMS échoués récents (Twilio, numéro bloqué, mauvais event_type, etc.)
select id, created_at, event_type, destination_snapshot, status, last_error
from public.notification_external_queue
where channel = 'sms'
  and status = 'failed'
  and created_at > now() - interval '7 days'
order by created_at desc
limit 20;

-- 5) Événements autorisés SMS patient (doit correspondre à event_type des lignes ci-dessus)
-- responded, treated, expired, post_confirm_product_arrived, market_shortage_product_available, responded_expiry_reminder
