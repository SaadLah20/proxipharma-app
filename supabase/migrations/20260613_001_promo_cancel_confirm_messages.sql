-- Promo : motif obligatoire si annulation officine ; message pharmacien à la confirmation ; notifs enrichies.

create or replace function public._promo_reservation_log_status(
  p_reservation_id uuid,
  p_old public.promo_reservation_status_enum,
  p_new public.promo_reservation_status_enum,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hist_id uuid;
  v_res public.pharmacy_promo_reservations%rowtype;
  v_pharmacy_name text;
  v_patient_name text;
  v_recipient uuid;
  v_title text;
  v_body text;
begin
  insert into public.pharmacy_promo_reservation_status_history (
    reservation_id, old_status, new_status, actor_id, note
  )
  values (p_reservation_id, p_old, p_new, auth.uid(), nullif(btrim(p_note), ''))
  returning id into v_hist_id;

  select r.* into v_res from public.pharmacy_promo_reservations r where r.id = p_reservation_id;
  select ph.nom into v_pharmacy_name from public.pharmacies ph where ph.id = v_res.pharmacy_id;
  select coalesce(nullif(btrim(p.full_name), ''), 'Patient') into v_patient_name
  from public.profiles p where p.id = v_res.patient_id;

  if p_new = 'submitted' then
    select ps.user_id into v_recipient
    from public.pharmacy_staff ps where ps.pharmacy_id = v_res.pharmacy_id limit 1;
    v_title := 'Nouvelle réservation pack promo';
    v_body := v_patient_name || ' — ' || coalesce(v_res.public_ref, 'réf. pack');
  elsif p_new in ('confirmed', 'unavailable', 'collected') then
    v_recipient := v_res.patient_id;
    v_title := case p_new
      when 'confirmed' then 'Votre pack est confirmé'
      when 'unavailable' then 'Pack non disponible'
      else 'Pack récupéré'
    end;
    v_body := coalesce(v_pharmacy_name, 'Votre pharmacie') || ' — ' || coalesce(v_res.public_ref, '');
    if p_new in ('confirmed', 'unavailable') and nullif(btrim(p_note), '') is not null then
      v_body := v_body || '. ' || btrim(p_note);
    end if;
  elsif p_new = 'cancelled' then
    if auth.uid() = v_res.patient_id then
      select ps.user_id into v_recipient from public.pharmacy_staff ps where ps.pharmacy_id = v_res.pharmacy_id limit 1;
      v_title := 'Réservation pack annulée';
      v_body := v_patient_name || ' a annulé ' || coalesce(v_res.public_ref, 'sa demande');
    else
      v_recipient := v_res.patient_id;
      v_title := 'Réservation annulée par l''officine';
      v_body := coalesce(v_pharmacy_name, 'L''officine') || ' a annulé ' || coalesce(v_res.public_ref, 'votre demande');
      if nullif(btrim(p_note), '') is not null then
        v_body := v_body || '. ' || btrim(p_note);
      end if;
    end if;
  end if;

  if v_recipient is not null and v_recipient <> auth.uid() then
    insert into public.promo_in_app_notifications (
      recipient_id, reservation_id, source_history_id, event_type, title, body
    )
    values (
      v_recipient,
      p_reservation_id,
      v_hist_id,
      'promo_reservation:' || p_new::text,
      v_title,
      v_body
    )
    on conflict (source_history_id, recipient_id) where source_history_id is not null do nothing;
  end if;

  return v_hist_id;
end;
$$;

drop function if exists public.pharmacist_confirm_promo_reservation(uuid);

create or replace function public.pharmacist_confirm_promo_reservation(
  p_reservation_id uuid,
  p_pharmacist_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res public.pharmacy_promo_reservations%rowtype;
  v_note text := nullif(btrim(coalesce(p_pharmacist_note, '')), '');
begin
  v_res := public._promo_reservation_require_pharmacist(p_reservation_id);
  if v_res.status <> 'submitted' then
    raise exception 'Statut incompatible.';
  end if;
  update public.pharmacy_promo_reservations
  set
    status = 'confirmed',
    pharmacist_note = v_note
  where id = p_reservation_id;
  perform public._promo_reservation_log_status(p_reservation_id, 'submitted', 'confirmed', v_note);
end;
$$;

create or replace function public.cancel_promo_reservation(
  p_reservation_id uuid,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res public.pharmacy_promo_reservations%rowtype;
  v_old public.promo_reservation_status_enum;
  v_is_pharmacist boolean;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  select * into v_res from public.pharmacy_promo_reservations where id = p_reservation_id;
  if not found then
    raise exception 'Réservation introuvable.';
  end if;
  if v_res.status in ('collected', 'cancelled') then
    raise exception 'Cette réservation est déjà terminée.';
  end if;

  v_is_pharmacist := exists (
    select 1 from public.pharmacy_staff ps
    where ps.pharmacy_id = v_res.pharmacy_id and ps.user_id = auth.uid()
  );

  if auth.uid() = v_res.patient_id then
    null;
  elsif v_is_pharmacist then
    if v_note is null then
      raise exception 'Merci d''indiquer un motif visible par le patient.';
    end if;
  else
    raise exception 'Non autorisé.';
  end if;

  v_old := v_res.status;
  update public.pharmacy_promo_reservations
  set
    status = 'cancelled',
    pharmacist_note = case when v_is_pharmacist then v_note else pharmacist_note end
  where id = p_reservation_id;
  perform public._promo_reservation_log_status(p_reservation_id, v_old, 'cancelled', v_note);
end;
$$;

comment on function public.pharmacist_confirm_promo_reservation(uuid, text) is
  'Confirme une réservation pack ; message optionnel enregistré dans pharmacist_note et notif patient.';

comment on function public.cancel_promo_reservation(uuid, text) is
  'Annulation patient (note facultative) ou officine (motif obligatoire → pharmacist_note + notif).';

grant execute on function public.pharmacist_confirm_promo_reservation(uuid, text) to authenticated;
