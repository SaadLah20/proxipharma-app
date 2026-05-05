-- Notifs pharmacien : titre/corps utilisent v_patient_nom depuis profiles.
-- Fallback email / WhatsApp quand full_name est vide (cas fréquent).

create or replace function public._emit_in_app_notifications_for_status_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.requests%rowtype;
  v_pharma_nom text;
  v_pharma_ville text;
  v_patient_nom text;
  v_nature text;
  v_when_fr text;
  v_title_pat text;
  v_body_pat text;
  v_title_ph text;
  v_body_ph text;
begin
  if new.new_status not in (
    'submitted', 'in_review', 'responded', 'confirmed', 'completed',
    'cancelled', 'abandoned', 'expired'
  ) then
    return new;
  end if;

  select r.* into v_req
  from public.requests r
  where r.id = new.request_id;

  if not found then
    return new;
  end if;

  select ph.nom, ph.ville
  into v_pharma_nom, v_pharma_ville
  from public.pharmacies ph
  where ph.id = v_req.pharmacy_id;

  select
    coalesce(
      nullif(btrim(p.full_name::text), ''),
      nullif(btrim(p.email::text), ''),
      nullif(btrim(p.whatsapp::text), ''),
      'Client'
    )
  into v_patient_nom
  from public.profiles p
  where p.id = v_req.patient_id;

  if v_patient_nom is null then
    v_patient_nom := 'Client';
  end if;

  v_nature := public._request_type_label_fr(v_req.request_type);
  v_when_fr := to_char(
    new.created_at at time zone 'Africa/Casablanca',
    'DD/MM/YYYY à HH24:MI'
  );

  if new.new_status in ('in_review', 'responded', 'completed', 'cancelled', 'abandoned', 'expired') then
    select t.n_title, t.n_body
    into v_title_pat, v_body_pat
    from public._in_app_notification_patient(
      new.new_status,
      v_pharma_nom,
      v_pharma_ville,
      v_nature,
      v_when_fr
    ) as t;

    insert into public.app_notifications (
      recipient_id, request_id, source_status_history_id, event_type, title, body
    )
    values (
      v_req.patient_id,
      new.request_id,
      new.id,
      'request_status:' || new.new_status::text,
      v_title_pat,
      v_body_pat
    )
    on conflict (source_status_history_id, recipient_id)
    do nothing;
  end if;

  if new.new_status in ('submitted', 'confirmed', 'abandoned', 'cancelled') then
    select t.n_title, t.n_body
    into v_title_ph, v_body_ph
    from public._in_app_notification_pharmacist(
      new.new_status,
      v_pharma_nom,
      v_pharma_ville,
      v_patient_nom,
      v_nature,
      v_when_fr
    ) as t;

    insert into public.app_notifications (
      recipient_id, request_id, source_status_history_id, event_type, title, body
    )
    select
      ps.user_id,
      new.request_id,
      new.id,
      'request_status:' || new.new_status::text,
      v_title_ph,
      v_body_ph
    from public.pharmacy_staff ps
    join public.profiles p on p.id = ps.user_id
    where ps.pharmacy_id = v_req.pharmacy_id
      and p.role = 'pharmacien'
    on conflict (source_status_history_id, recipient_id)
    do nothing;
  end if;

  return new;
end;
$$;

comment on function public._emit_in_app_notifications_for_status_history() is
  'Insère des notifications lisibles (vous / votre officine, contexte pharmacie + nature + date) pour patient et pharmacien. Nom patient : full_name, puis email, puis whatsapp, puis Client.';
