-- Validation date/heure de passage patient vs horaires officine (+ délai 30 min)

create table if not exists public.morocco_public_holidays (
  date date primary key,
  label_fr text not null
);

insert into public.morocco_public_holidays (date, label_fr) values
  ('2025-01-01', 'Nouvel An'),
  ('2025-01-11', 'Manifeste de l''Indépendance'),
  ('2025-01-13', 'Nouvel An amazigh (Yennayer)'),
  ('2025-03-30', 'Aid al-Fitr'),
  ('2025-05-01', 'Fête du Travail'),
  ('2025-06-06', 'Aid al-Adha'),
  ('2025-07-05', 'Achoura'),
  ('2025-07-30', 'Fête du Trône'),
  ('2025-08-14', 'Récupération de Oued Ed-Dahab'),
  ('2025-08-20', 'Révolution du Roi et du Peuple'),
  ('2025-08-21', 'Fête de la Jeunesse'),
  ('2025-09-04', 'Mawlid'),
  ('2025-11-06', 'Marche Verte'),
  ('2025-11-18', 'Fête de l''Indépendance'),
  ('2026-01-01', 'Nouvel An'),
  ('2026-01-11', 'Manifeste de l''Indépendance'),
  ('2026-01-13', 'Nouvel An amazigh (Yennayer)'),
  ('2026-03-19', 'Aid al-Fitr'),
  ('2026-05-01', 'Fête du Travail'),
  ('2026-05-26', 'Aid al-Adha'),
  ('2026-06-25', 'Achoura'),
  ('2026-07-30', 'Fête du Trône'),
  ('2026-08-14', 'Récupération de Oued Ed-Dahab'),
  ('2026-08-20', 'Révolution du Roi et du Peuple'),
  ('2026-08-21', 'Fête de la Jeunesse'),
  ('2026-08-25', 'Mawlid'),
  ('2026-11-06', 'Marche Verte'),
  ('2026-11-18', 'Fête de l''Indépendance'),
  ('2027-01-01', 'Nouvel An'),
  ('2027-01-11', 'Manifeste de l''Indépendance'),
  ('2027-01-13', 'Nouvel An amazigh (Yennayer)'),
  ('2027-03-09', 'Aid al-Fitr'),
  ('2027-05-01', 'Fête du Travail'),
  ('2027-05-16', 'Aid al-Adha'),
  ('2027-06-15', 'Achoura'),
  ('2027-07-30', 'Fête du Trône'),
  ('2027-08-14', 'Récupération de Oued Ed-Dahab'),
  ('2027-08-20', 'Révolution du Roi et du Peuple'),
  ('2027-08-21', 'Fête de la Jeunesse'),
  ('2027-08-14', 'Mawlid'),
  ('2027-11-06', 'Marche Verte'),
  ('2027-11-18', 'Fête de l''Indépendance'),
  ('2028-01-01', 'Nouvel An'),
  ('2028-01-11', 'Manifeste de l''Indépendance'),
  ('2028-01-13', 'Nouvel An amazigh (Yennayer)'),
  ('2028-02-26', 'Aid al-Fitr'),
  ('2028-05-01', 'Fête du Travail'),
  ('2028-05-05', 'Aid al-Adha'),
  ('2028-07-30', 'Fête du Trône'),
  ('2028-08-14', 'Récupération de Oued Ed-Dahab'),
  ('2028-08-20', 'Révolution du Roi et du Peuple'),
  ('2028-08-21', 'Fête de la Jeunesse'),
  ('2028-11-06', 'Marche Verte'),
  ('2028-11-18', 'Fête de l''Indépendance')
on conflict (date) do nothing;

grant select on public.morocco_public_holidays to anon, authenticated;

create or replace function public._time_to_minutes(p_time time)
returns int
language sql
immutable
as $$
  select (extract(hour from p_time) * 60 + extract(minute from p_time))::int;
$$;

create or replace function public._casablanca_date_from_timestamptz(p_ts timestamptz)
returns date
language sql
stable
as $$
  select (timezone('Africa/Casablanca', p_ts))::date;
$$;

create or replace function public._casablanca_minutes_from_timestamptz(p_ts timestamptz)
returns int
language sql
stable
as $$
  select (
    extract(hour from timezone('Africa/Casablanca', p_ts)) * 60
    + extract(minute from timezone('Africa/Casablanca', p_ts))
  )::int;
$$;

create or replace function public._visit_timestamptz_casablanca(p_date date, p_minutes int)
returns timestamptz
language sql
immutable
as $$
  select timezone(
    'Africa/Casablanca',
    p_date::timestamp + make_interval(mins => p_minutes)
  );
$$;

create or replace function public._pharmacy_garde_full_display_day(
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_date date
)
returns boolean
language plpgsql
stable
as $$
declare
  v_start date;
  v_end date;
begin
  v_start := public._casablanca_date_from_timestamptz(p_starts_at);
  v_end := public._casablanca_date_from_timestamptz(p_ends_at);
  if p_date < v_start or p_date > v_end then
    return false;
  end if;
  if p_date = v_start then
    return true;
  end if;
  if p_date = v_end then
    return false;
  end if;
  return true;
end;
$$;

create or replace function public._pharmacy_on_call_at(
  p_pharmacy_id uuid,
  p_date date,
  p_minutes int
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.pharmacy_on_call_periods p
    where p.pharmacy_id = p_pharmacy_id
      and public._visit_timestamptz_casablanca(p_date, p_minutes) >= p.starts_at
      and public._visit_timestamptz_casablanca(p_date, p_minutes) < p.ends_at
  );
$$;

create or replace function public._pharmacy_garde_full_day(
  p_pharmacy_id uuid,
  p_date date
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.pharmacy_on_call_periods p
    where p.pharmacy_id = p_pharmacy_id
      and public._pharmacy_garde_full_display_day(p.starts_at, p.ends_at, p_date)
  );
$$;

create or replace function public._pharmacy_open_from_weekly_at(
  p_pharmacy_id uuid,
  p_date date,
  p_minutes int
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.pharmacy_weekly_hours h
    where h.pharmacy_id = p_pharmacy_id
      and h.weekday = extract(isodow from p_date)::smallint
      and not h.is_closed
      and h.opens_at is not null
      and h.closes_at is not null
      and p_minutes >= public._time_to_minutes(h.opens_at)
      and p_minutes < public._time_to_minutes(h.closes_at)
  );
$$;

create or replace function public._pharmacy_open_from_override_at(
  p_pharmacy_id uuid,
  p_date date,
  p_minutes int
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.pharmacy_day_overrides o
    where o.pharmacy_id = p_pharmacy_id
      and o.day_date = p_date
      and o.override_type = 'custom'
      and (
        (
          o.morning_opens_at is not null
          and o.morning_closes_at is not null
          and p_minutes >= public._time_to_minutes(o.morning_opens_at)
          and p_minutes < public._time_to_minutes(o.morning_closes_at)
        )
        or (
          o.afternoon_opens_at is not null
          and o.afternoon_closes_at is not null
          and p_minutes >= public._time_to_minutes(o.afternoon_opens_at)
          and p_minutes < public._time_to_minutes(o.afternoon_closes_at)
        )
      )
  );
$$;

create or replace function public._pharmacy_is_open_at_minute(
  p_pharmacy_id uuid,
  p_date date,
  p_minutes int
)
returns boolean
language plpgsql
stable
as $$
declare
  v_override record;
begin
  if public._pharmacy_garde_full_day(p_pharmacy_id, p_date) then
    return true;
  end if;

  if public._pharmacy_on_call_at(p_pharmacy_id, p_date, p_minutes) then
    return true;
  end if;

  select o.override_type
  into v_override
  from public.pharmacy_day_overrides o
  where o.pharmacy_id = p_pharmacy_id
    and o.day_date = p_date
  limit 1;

  if found then
    if v_override.override_type in ('closed', 'holiday') then
      return false;
    end if;
    return public._pharmacy_open_from_override_at(p_pharmacy_id, p_date, p_minutes);
  end if;

  if exists (select 1 from public.morocco_public_holidays h where h.date = p_date) then
    return false;
  end if;

  return public._pharmacy_open_from_weekly_at(p_pharmacy_id, p_date, p_minutes);
end;
$$;

create or replace function public._pharmacy_day_has_open_slot(
  p_pharmacy_id uuid,
  p_date date
)
returns boolean
language plpgsql
stable
as $$
declare
  v_minute int;
begin
  if public._pharmacy_garde_full_day(p_pharmacy_id, p_date) then
    return true;
  end if;

  for v_minute in 0..1439 by 15 loop
    if public._pharmacy_is_open_at_minute(p_pharmacy_id, p_date, v_minute) then
      return true;
    end if;
  end loop;

  return false;
end;
$$;

create or replace function public._assert_pharmacy_open_for_visit(
  p_pharmacy_id uuid,
  p_date date,
  p_time time
)
returns void
language plpgsql
stable
as $$
declare
  v_today date;
  v_now timestamptz;
  v_visit timestamptz;
  v_minutes int;
  v_holiday_label text;
begin
  if p_pharmacy_id is null then
    return;
  end if;

  v_today := (timezone('Africa/Casablanca', now()))::date;
  v_now := timezone('Africa/Casablanca', now());

  if not public._pharmacy_day_has_open_slot(p_pharmacy_id, p_date) then
    select h.label_fr into v_holiday_label
    from public.morocco_public_holidays h
    where h.date = p_date;

    if v_holiday_label is not null then
      raise exception 'Cette officine est fermée ce jour-là (%). Choisissez une autre date.', v_holiday_label;
    end if;

    raise exception 'Cette officine est fermée ce jour-là. Choisissez une autre date.';
  end if;

  if p_time is null then
    return;
  end if;

  v_minutes := public._time_to_minutes(p_time);
  v_visit := public._visit_timestamptz_casablanca(p_date, v_minutes);

  if p_date = v_today and v_visit < v_now + interval '30 minutes' then
    raise exception 'Choisissez une heure au moins 30 minutes à partir de maintenant.';
  end if;

  if not public._pharmacy_is_open_at_minute(p_pharmacy_id, p_date, v_minutes) then
    raise exception 'Cette officine est fermée à cette heure. Consultez les horaires de l''officine.';
  end if;
end;
$$;

-- patient_confirm_after_response : garde-fou horaires
create or replace function public.patient_confirm_after_response(
  p_request_id uuid,
  p_selections jsonb default '[]'::jsonb,
  p_planned_visit_date date default null,
  p_planned_visit_time text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_old public.request_status_enum;
  v_patient uuid;
  v_pharmacy uuid;
  v_sel jsonb;
  v_item_id uuid;
  v_is_selected boolean;
  v_qty int;
  v_row public.request_items%rowtype;
  v_alt_row public.request_item_alternatives%rowtype;
  v_chosen_alt uuid;
  v_max_qty int;
  v_any_selected boolean := false;
  v_item_count int;
  v_sel_count int;
  v_today date;
  v_any_to_order boolean := false;
  v_max_eta date;
  v_av public.availability_status_enum;
  v_exp date;
  v_visit_time time without time zone;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select status, patient_id, pharmacy_id into v_old, v_patient, v_pharmacy
  from public.requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found';
  end if;

  if v_patient <> v_uid then
    raise exception 'Forbidden';
  end if;

  if v_old <> 'responded' then
    raise exception 'Invalid status: expected responded, got %', v_old;
  end if;

  if p_selections is null or jsonb_typeof(p_selections) <> 'array' then
    raise exception 'p_selections must be a JSON array';
  end if;

  if p_planned_visit_date is null then
    raise exception 'Date de passage en pharmacie obligatoire';
  end if;

  if p_planned_visit_time is not null and nullif(trim(p_planned_visit_time), '') is not null then
    begin
      v_visit_time := nullif(trim(p_planned_visit_time), '')::time without time zone;
    exception
      when invalid_text_representation then
        raise exception 'Heure de passage invalide (format HH:MM attendu)';
    end;
  else
    v_visit_time := null;
  end if;

  select count(*)::int into v_item_count from public.request_items where request_id = p_request_id;
  v_sel_count := jsonb_array_length(p_selections);
  if v_item_count = 0 then
    raise exception 'No request items';
  end if;
  if v_item_count <> v_sel_count then
    raise exception 'p_selections must list exactly % item(s)', v_item_count;
  end if;

  for v_sel in select * from jsonb_array_elements(p_selections)
  loop
    v_item_id := (v_sel->>'request_item_id')::uuid;
    v_is_selected := coalesce((v_sel->>'is_selected')::boolean, false);
    v_qty := nullif(v_sel->>'selected_qty', '')::int;
    v_chosen_alt := null;
    if v_sel ? 'chosen_alternative_id' and nullif(trim(v_sel->>'chosen_alternative_id'), '') is not null then
      begin
        v_chosen_alt := (v_sel->>'chosen_alternative_id')::uuid;
      exception
        when invalid_text_representation then
          raise exception 'Invalid chosen_alternative_id for item %', v_item_id;
      end;
    end if;

    select * into v_row
    from public.request_items
    where id = v_item_id and request_id = p_request_id
    for update;

    if not found then
      raise exception 'Invalid request_item_id %', v_item_id;
    end if;

    if v_is_selected then
      if v_chosen_alt is not null then
        select * into v_alt_row
        from public.request_item_alternatives
        where id = v_chosen_alt
          and request_item_id = v_item_id;

        if not found then
          raise exception 'chosen_alternative_id does not belong to item %', v_item_id;
        end if;

        if v_alt_row.available_qty is not null then
          v_max_qty := greatest(1, v_alt_row.available_qty);
        else
          v_max_qty := v_row.requested_qty;
          if v_row.available_qty is not null then
            v_max_qty := least(v_max_qty, v_row.available_qty);
          end if;
        end if;

        v_av := v_alt_row.availability_status;
        v_exp := v_alt_row.expected_availability_date;
      else
        v_chosen_alt := null;
        v_max_qty := v_row.requested_qty;
        if v_row.available_qty is not null then
          v_max_qty := least(v_max_qty, v_row.available_qty);
        end if;

        v_av := v_row.availability_status;
        v_exp := v_row.expected_availability_date;
      end if;

      if v_av = 'to_order'::public.availability_status_enum then
        v_any_to_order := true;
        if v_exp is null then
          raise exception 'Produit à commander sans date de réception prévue (ligne %). Contacte la pharmacie.', v_item_id;
        end if;
        if v_max_eta is null or v_exp > v_max_eta then
          v_max_eta := v_exp;
        end if;
      end if;

      if v_max_qty < 1 then
        raise exception 'No quantity available on selected branch for item %', v_item_id;
      end if;

      if v_qty is null then
        v_qty := greatest(v_max_qty, 1);
      end if;
      if v_qty < 1 or v_qty > v_max_qty then
        raise exception 'Quantité invalide pour cette ligne (max. % unité(s) proposée(s) par la pharmacie).', v_max_qty;
      end if;

      update public.request_items
      set
        is_selected_by_patient = true,
        selected_qty = v_qty,
        patient_chosen_alternative_id = v_chosen_alt,
        counter_outcome = 'unset',
        updated_at = now()
      where id = v_item_id;
      v_any_selected := true;
    else
      update public.request_items
      set
        is_selected_by_patient = false,
        selected_qty = null,
        patient_chosen_alternative_id = null,
        counter_outcome = 'cancelled_at_counter',
        updated_at = now()
      where id = v_item_id;
    end if;
  end loop;

  if not v_any_selected then
    raise exception 'At least one line must stay selected to confirm';
  end if;

  v_today := (timezone('Africa/Casablanca', now()))::date;

  if p_planned_visit_date < v_today then
    raise exception 'La date de passage ne peut être antérieure à aujourd’hui.';
  end if;

  if not v_any_to_order then
    if p_planned_visit_date > v_today + 4 then
      raise exception 'Sans produit « à commander » dans ta sélection, choisis une date dans les 4 jours suivants.';
    end if;
  else
    if p_planned_visit_date > v_max_eta + 3 then
      raise exception 'Avec produit(s) à commander, la date de passage doit être au plus 3 jours après la dernière date de réception indiquée (%).', v_max_eta;
    end if;
  end if;

  perform public._assert_pharmacy_open_for_visit(v_pharmacy, p_planned_visit_date, v_visit_time);

  update public.requests
  set
    status = 'confirmed',
    confirmed_at = now(),
    patient_planned_visit_date = p_planned_visit_date,
    patient_planned_visit_time = v_visit_time,
    updated_at = now()
  where id = p_request_id;

  perform public._log_request_status_change(p_request_id, v_old, 'confirmed', v_uid, 'patient_confirm_after_response');
end;
$$;

create or replace function public.patient_update_planned_visit_after_confirmation(
  p_request_id uuid,
  p_planned_visit_date date,
  p_planned_visit_time text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_old public.request_status_enum;
  v_patient uuid;
  v_pharmacy uuid;
  v_today date;
  v_any_to_order boolean := false;
  v_max_eta date;
  v_row record;
  v_eff public.availability_status_enum;
  v_exp date;
  v_visit_time time without time zone;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select status, patient_id, pharmacy_id into v_old, v_patient, v_pharmacy
  from public.requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found';
  end if;

  if v_patient <> v_uid then
    raise exception 'Forbidden';
  end if;

  if v_old not in ('confirmed'::public.request_status_enum, 'treated'::public.request_status_enum) then
    raise exception 'Invalid status';
  end if;

  if p_planned_visit_date is null then
    raise exception 'Date de passage obligatoire';
  end if;

  if p_planned_visit_time is not null and nullif(trim(p_planned_visit_time), '') is not null then
    begin
      v_visit_time := nullif(trim(p_planned_visit_time), '')::time without time zone;
    exception
      when invalid_text_representation then
        raise exception 'Heure de passage invalide (format HH:MM attendu)';
    end;
  else
    v_visit_time := null;
  end if;

  for v_row in
    select
      ri.id as item_id,
      ri.is_selected_by_patient,
      ri.withdrawn_after_confirm,
      ri.patient_chosen_alternative_id,
      ri.availability_status as base_av,
      ri.expected_availability_date as base_exp
    from public.request_items ri
    where ri.request_id = p_request_id
  loop
    if not coalesce(v_row.is_selected_by_patient, false) then
      continue;
    end if;
    if coalesce(v_row.withdrawn_after_confirm, false) then
      continue;
    end if;

    v_eff := v_row.base_av;
    v_exp := v_row.base_exp;

    if v_row.patient_chosen_alternative_id is not null then
      select a.availability_status, a.expected_availability_date
      into v_eff, v_exp
      from public.request_item_alternatives a
      where a.id = v_row.patient_chosen_alternative_id and a.request_item_id = v_row.item_id;
      if not found then
        raise exception 'Alternative invalide pour une ligne sélectionnée';
      end if;
    end if;

    if v_eff = 'to_order'::public.availability_status_enum then
      v_any_to_order := true;
      if v_exp is null then
        raise exception 'Produit à commander sans date de réception prévue — contactez la pharmacie.';
      end if;
      if v_max_eta is null or v_exp > v_max_eta then
        v_max_eta := v_exp;
      end if;
    end if;
  end loop;

  v_today := (timezone('Africa/Casablanca', now()))::date;

  if p_planned_visit_date < v_today then
    raise exception 'La date de passage ne peut être antérieure à aujourd’hui.';
  end if;

  if not v_any_to_order then
    if p_planned_visit_date > v_today + 4 then
      raise exception 'Sans produit « à commander » dans votre sélection, choisissez une date dans les 4 jours suivants.';
    end if;
  else
    if p_planned_visit_date > v_max_eta + 3 then
      raise exception 'Avec produit(s) à commander, la date de passage doit être au plus 3 jours après la dernière date de réception indiquée (%).', v_max_eta;
    end if;
  end if;

  perform public._assert_pharmacy_open_for_visit(v_pharmacy, p_planned_visit_date, v_visit_time);

  update public.requests
  set patient_planned_visit_date = p_planned_visit_date, patient_planned_visit_time = v_visit_time, updated_at = now()
  where id = p_request_id;

  perform public._log_request_status_change(p_request_id, v_old, v_old, v_uid, 'patient_planned_visit_updated');
end;
$$;

comment on function public._assert_pharmacy_open_for_visit(uuid, date, time) is
  'Garde-fou passage patient : jour ouvert, délai 30 min si aujourd''hui, créneau horaire si heure renseignée.';
