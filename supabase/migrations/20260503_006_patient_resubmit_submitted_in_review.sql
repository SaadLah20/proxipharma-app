-- Permet au patient de remplacer les lignes et renvoyer aussi depuis submitted / in_review
-- (même corps que responded/confirmed : repasse en submitted, purge alternatives + lignes).

create or replace function public.patient_resubmit_product_request_after_response(
  p_request_id uuid,
  p_patient_note text,
  p_items jsonb
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
  v_type public.request_type_enum;
  v_el jsonb;
  v_pid uuid;
  v_qty int;
  v_seen uuid[] := array[]::uuid[];
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select status, patient_id, request_type
  into v_old, v_patient, v_type
  from public.requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found';
  end if;

  if v_patient <> v_uid then
    raise exception 'Forbidden';
  end if;

  if v_type <> 'product_request' then
    raise exception 'Only product_request is supported';
  end if;

  if v_old not in ('responded', 'confirmed', 'submitted', 'in_review') then
    raise exception 'Cannot resubmit from status %', v_old;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'p_items must be a non-empty JSON array';
  end if;

  delete from public.request_item_alternatives a
  using public.request_items ri
  where a.request_item_id = ri.id
    and ri.request_id = p_request_id;

  delete from public.request_items
  where request_id = p_request_id;

  for v_el in select * from jsonb_array_elements(p_items)
  loop
    v_pid := (v_el->>'product_id')::uuid;
    v_qty := coalesce(nullif(v_el->>'requested_qty', '')::int, 0);

    if v_pid is null then
      raise exception 'Each item needs product_id';
    end if;

    if v_pid = any(v_seen) then
      raise exception 'Chaque produit ne peut figurer qu’une fois dans la liste.';
    end if;
    v_seen := array_append(v_seen, v_pid);

    if v_qty < 1 or v_qty > 10 then
      raise exception 'Quantité doit être entre 1 et 10.';
    end if;

    if not exists (select 1 from public.products pr where pr.id = v_pid and pr.is_active = true) then
      raise exception 'Invalid or inactive product_id %', v_pid;
    end if;

    insert into public.request_items (
      request_id,
      product_id,
      requested_qty,
      is_selected_by_patient,
      counter_outcome
    ) values (
      p_request_id,
      v_pid,
      v_qty,
      true,
      'unset'
    );
  end loop;

  update public.product_requests
  set patient_note = case
    when p_patient_note is null then patient_note
    else nullif(trim(p_patient_note), '')
  end
  where request_id = p_request_id;

  update public.requests
  set
    status = 'submitted',
    responded_at = null,
    confirmed_at = null,
    submitted_at = now(),
    patient_planned_visit_date = null,
    patient_planned_visit_time = null,
    expires_at = null,
    updated_at = now()
  where id = p_request_id;

  perform public._log_request_status_change(p_request_id, v_old, 'submitted', v_uid, 'patient_resubmit_product_request_after_response');
end;
$$;

comment on function public.patient_resubmit_product_request_after_response(uuid, text, jsonb) is
'Remplace les lignes (sans doublon, qté 1–10) depuis responded, confirmed, submitted ou in_review ; repasse en submitted.';
