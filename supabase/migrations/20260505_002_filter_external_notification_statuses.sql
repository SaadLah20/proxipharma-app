-- Q35 (ajustement) — limiter les canaux externes aux statuts vraiment utiles
-- pour éviter les doublons « en traitement » + « répondu » côté email/SMS/WhatsApp.
-- On garde toutes les notifications in-app, mais on ne push hors-app
-- que certains event_type de app_notifications.

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
begin
  -- Filtre : on ignore les notifications qui ne doivent pas sortir hors de l'app.
  if new.event_type not in (
    'request_status:submitted',
    'request_status:responded',
    'request_status:confirmed',
    'request_status:completed',
    'request_status:cancelled',
    'request_status:abandoned',
    'request_status:expired'
  ) then
    return new;
  end if;

  select p.email, p.whatsapp
  into v_email, v_wa
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

  if v_prefs.sms_enabled and v_phone is not null then
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
'Alimente notification_external_queue pour certains statuts (submitted/responded/confirmed/...) selon préférences externes.';

