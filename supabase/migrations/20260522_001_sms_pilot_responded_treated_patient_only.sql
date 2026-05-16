-- Q35 pilote SMS : uniquement patient, statuts répondu + traité (pas les autres alertes hors-app).

create or replace function public._enqueue_external_notifications_from_app_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefs public.notification_external_prefs%rowtype;
  v_email text;
  v_wa text;
  v_phone text;
  v_is_patient boolean;
begin
  if new.event_type not in (
    'request_status:submitted',
    'request_status:responded',
    'request_status:confirmed',
    'request_status:completed',
    'request_status:cancelled',
    'request_status:abandoned',
    'request_status:expired',
    'request_status:treated'
  ) then
    return new;
  end if;

  select p.email, p.whatsapp, (p.role = 'patient')
  into v_email, v_wa, v_is_patient
  from public.profiles p
  where p.id = new.recipient_id;

  select *
  into v_prefs
  from public.notification_external_prefs pref
  where pref.user_id = new.recipient_id;

  if not found then
    return new;
  end if;

  v_email := nullif(trim(both from coalesce(v_email, '')), '');
  v_wa := nullif(trim(both from coalesce(v_wa, '')), '');
  v_phone := v_wa;

  if v_prefs.email_enabled and v_email is not null then
    insert into public.notification_external_queue (
      recipient_id,
      request_id,
      app_notification_id,
      channel,
      event_type,
      title,
      body,
      destination_snapshot
    )
    values (
      new.recipient_id,
      new.request_id,
      new.id,
      'email'::public.notification_external_channel_enum,
      new.event_type,
      new.title,
      new.body,
      v_email
    )
    on conflict (app_notification_id, channel) do nothing;
  end if;

  if v_prefs.sms_enabled
     and v_phone is not null
     and v_is_patient
     and new.event_type in (
       'request_status:responded',
       'request_status:treated'
     )
  then
    insert into public.notification_external_queue (
      recipient_id,
      request_id,
      app_notification_id,
      channel,
      event_type,
      title,
      body,
      destination_snapshot
    )
    values (
      new.recipient_id,
      new.request_id,
      new.id,
      'sms'::public.notification_external_channel_enum,
      new.event_type,
      new.title,
      new.body,
      v_phone
    )
    on conflict (app_notification_id, channel) do nothing;
  end if;

  if v_prefs.whatsapp_enabled and v_phone is not null then
    insert into public.notification_external_queue (
      recipient_id,
      request_id,
      app_notification_id,
      channel,
      event_type,
      title,
      body,
      destination_snapshot
    )
    values (
      new.recipient_id,
      new.request_id,
      new.id,
      'whatsapp'::public.notification_external_channel_enum,
      new.event_type,
      new.title,
      new.body,
      v_phone
    )
    on conflict (app_notification_id, channel) do nothing;
  end if;

  return new;
end;
$$;

comment on function public._enqueue_external_notifications_from_app_row() is
'Alimente notification_external_queue : e-mail selon statuts pilote ; SMS patient uniquement (répondu, traité) ; WhatsApp selon prefs.';
