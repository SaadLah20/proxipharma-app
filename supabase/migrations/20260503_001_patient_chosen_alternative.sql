-- ProxiPharma: choix patient « produit principal OU une alternative » à la confirmation (responded -> confirmed).
-- Colonne sur la ligne principale + extension de patient_confirm_after_response.
-- Idempotent.

alter table public.request_items
  add column if not exists patient_chosen_alternative_id uuid
  references public.request_item_alternatives (id)
  on delete set null;

create index if not exists request_items_patient_chosen_alt_idx
  on public.request_items (patient_chosen_alternative_id)
  where patient_chosen_alternative_id is not null;

comment on column public.request_items.patient_chosen_alternative_id is
'Si non null, le patient a validé cette alternative à la place du produit principal pour la ligne (RPC patient_confirm_after_response).';

-- ---------------------------------------------------------------------------
-- patient_confirm_after_response
-- p_selections: [{ "request_item_id", "is_selected", "selected_qty", "chosen_alternative_id": "<uuid>"|null }]
-- chosen_alternative_id null / absent = branche produit principal.
-- ---------------------------------------------------------------------------
create or replace function public.patient_confirm_after_response(
  p_request_id uuid,
  p_selections jsonb default '[]'::jsonb
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

        v_max_qty := v_row.requested_qty;
        if v_alt_row.available_qty is not null then
          v_max_qty := least(v_max_qty, v_alt_row.available_qty);
        end if;
      else
        v_chosen_alt := null;
        v_max_qty := v_row.requested_qty;
        if v_row.available_qty is not null then
          v_max_qty := least(v_max_qty, v_row.available_qty);
        end if;
      end if;

      if v_max_qty < 1 then
        raise exception 'No quantity available on selected branch for item %', v_item_id;
      end if;

      if v_qty is null then
        v_qty := greatest(v_max_qty, 1);
      end if;
      if v_qty < 1 or v_qty > v_max_qty then
        raise exception 'selected_qty out of range for item %', v_item_id;
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

  update public.requests
  set
    status = 'confirmed',
    confirmed_at = now(),
    updated_at = now()
  where id = p_request_id;

  perform public._log_request_status_change(p_request_id, v_old, 'confirmed', v_uid, 'patient_confirm_after_response');
end;
$$;

comment on function public.patient_confirm_after_response(uuid, jsonb) is
'responded -> confirmed. Selections: optional chosen_alternative_id per line (principal if null).';
