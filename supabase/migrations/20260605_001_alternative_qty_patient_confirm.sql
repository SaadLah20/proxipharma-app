-- Alternatives : plafond patient = available_qty de l'alternative (pas min avec requested_qty principal).
-- Le pharmacien fixe librement la qté proposée (1–10) ; le patient peut diminuer, pas augmenter.

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

  select status, patient_id into v_old, v_patient
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

        -- Alternative : plafond = qté proposée par l'officine (pas le prescrit / principal).
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

comment on function public.patient_confirm_after_response(uuid, jsonb, date, text) is
'responded -> confirmed. Alternative : plafond patient = available_qty alternative (sans lien prescrit).';
