-- Aucun SMS pour les pharmaciens : prefs off + annulation file en attente.

update public.notification_external_prefs pref
set sms_enabled = false
from public.profiles p
where p.id = pref.user_id
  and p.role = 'pharmacien'
  and pref.sms_enabled = true;

update public.notification_external_queue q
set
  status = 'failed',
  attempt_count = 1,
  last_error = 'skipped: SMS réservé aux patients (pharmacien)'
from public.profiles p
where p.id = q.recipient_id
  and p.role = 'pharmacien'
  and q.channel = 'sms'
  and q.status in ('pending', 'processing');
