-- WhatsApp M2 lot 3 pharmacien : passage modifié, ordonnance mise à jour, message patient.

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
  v_phone_channel_allowed boolean;
begin
  if new.event_type not in (
    'request_status:submitted',
    'request_status:responded',
    'request_status:confirmed',
    'request_status:completed',
    'request_status:cancelled',
    'request_status:abandoned',
    'request_status:expired',
    'request_status:treated',
    'request_status:patient_prescription_updated',
    'request_event:post_confirm_product_arrived',
    'request_event:market_shortage_product_available',
    'request_event:responded_expiry_reminder',
    'request_event:planned_visit_day_reminder',
    'request_event:planned_visit_pre_passage_reminder',
    'request_event:planned_visit_passed_no_pickup',
    'request_event:responded_expiry_pharmacist_reminder',
    'request_event:patient_planned_visit_updated',
    'request_conversation:message'
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

  v_phone_channel_allowed :=
    (v_is_patient and new.event_type in (
      'request_status:responded',
      'request_status:treated',
      'request_status:expired',
      'request_event:post_confirm_product_arrived',
      'request_event:market_shortage_product_available',
      'request_event:responded_expiry_reminder',
      'request_event:planned_visit_day_reminder',
      'request_event:planned_visit_pre_passage_reminder'
    ))
    or (not v_is_patient and new.event_type in (
      'request_status:submitted',
      'request_status:confirmed',
      'request_event:planned_visit_passed_no_pickup',
      'request_event:responded_expiry_pharmacist_reminder',
      'request_event:patient_planned_visit_updated',
      'request_status:patient_prescription_updated',
      'request_conversation:message'
    ));

  if v_prefs.email_enabled and v_email is not null then
    insert into public.notification_external_queue (
      recipient_id, request_id, app_notification_id, channel, event_type, title, body, destination_snapshot
    )
    values (
      new.recipient_id, new.request_id, new.id, 'email'::public.notification_external_channel_enum,
      new.event_type, new.title, new.body, v_email
    )
    on conflict (app_notification_id, channel) do nothing;
  end if;

  if v_prefs.whatsapp_enabled and v_phone is not null and v_phone_channel_allowed then
    insert into public.notification_external_queue (
      recipient_id, request_id, app_notification_id, channel, event_type, title, body, destination_snapshot
    )
    values (
      new.recipient_id, new.request_id, new.id, 'whatsapp'::public.notification_external_channel_enum,
      new.event_type, new.title, new.body, v_phone
    )
    on conflict (app_notification_id, channel) do nothing;
  end if;

  return new;
end;
$$;

comment on function public._enqueue_external_notifications_from_app_row() is
  'File externe : e-mail + WhatsApp. M2 lot 3 : passage / ordonnance / message patient (pharmacien).';
