-- Mise à jour date de passage (confirmed / treated) : +2 j si ≤ 1 j restant sur la borne normale (4 j ou ETA+3 j).

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
  v_max_normal date;
  v_max_allowed date;
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
    v_max_normal := v_today + 4;
  else
    v_max_normal := v_max_eta + 3;
  end if;

  if (v_max_normal - v_today) >= 2 then
    v_max_allowed := v_max_normal;
  else
    v_max_allowed := v_max_normal + 2;
  end if;

  if p_planned_visit_date > v_max_allowed then
    if not v_any_to_order then
      raise exception 'Sans produit « à commander » dans votre sélection, choisissez une date au plus tard le %.', v_max_allowed;
    end if;
    raise exception 'Avec produit(s) à commander, la date de passage doit être au plus tard le % (selon les dates de réception).', v_max_allowed;
  end if;

  perform public._assert_pharmacy_open_for_visit(v_pharmacy, p_planned_visit_date, v_visit_time);

  update public.requests
  set patient_planned_visit_date = p_planned_visit_date, patient_planned_visit_time = v_visit_time, updated_at = now()
  where id = p_request_id;

  perform public._log_request_status_change(p_request_id, v_old, v_old, v_uid, 'patient_planned_visit_updated');
end;
$$;

comment on function public.patient_update_planned_visit_after_confirmation(uuid, date, text) is
  'Patient confirmed/treated : mise à jour passage. Borne normale 4 j ou ETA+3 j ; +2 j si ≤ 1 j restant sur la borne normale.';
