-- Phase B : lignes manuelles patient + liaison pharmacien + resubmit étendu.

-- Conserver patient_requested_label en historique après liaison (plus obligatoire null sur global/pharmacy).
alter table public.request_items drop constraint if exists request_items_line_product_source_check;
alter table public.request_items add constraint request_items_line_product_source_check check (
  (
    line_product_kind = 'global'
    and product_id is not null
    and pharmacy_product_id is null
  )
  or (
    line_product_kind = 'pharmacy'
    and pharmacy_product_id is not null
    and product_id is null
  )
  or (
    line_product_kind = 'patient_manual'
    and patient_requested_label is not null
    and char_length(trim(patient_requested_label)) >= 1
    and product_id is null
    and pharmacy_product_id is null
    and manual_resolved_at is null
  )
);

create or replace function public.pharmacist_link_manual_line_to_product(
  p_request_item_id uuid,
  p_product_id uuid default null,
  p_pharmacy_product_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.request_items%rowtype;
  v_pharmacy uuid;
  v_kind public.request_line_product_kind;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select ri.*
  into v_row
  from public.request_items ri
  where ri.id = p_request_item_id
  for update;

  if not found then
    raise exception 'Request item not found';
  end if;

  select req.pharmacy_id into v_pharmacy
  from public.requests req
  where req.id = v_row.request_id;

  if not public._user_is_pharmacy_staff(v_pharmacy) then
    raise exception 'Forbidden';
  end if;

  if v_row.line_product_kind <> 'patient_manual' or v_row.manual_resolved_at is not null then
    raise exception 'Line is not an unresolved manual patient request';
  end if;

  if (p_product_id is null and p_pharmacy_product_id is null)
     or (p_product_id is not null and p_pharmacy_product_id is not null) then
    raise exception 'Provide exactly one of product_id or pharmacy_product_id';
  end if;

  if p_product_id is not null then
    if not exists (
      select 1 from public.products pr
      where pr.id = p_product_id and pr.is_active = true
    ) then
      raise exception 'Invalid or inactive product_id';
    end if;
    v_kind := 'global';
    update public.request_items
    set
      line_product_kind = v_kind,
      product_id = p_product_id,
      pharmacy_product_id = null,
      manual_resolved_at = now(),
      updated_at = now()
    where id = p_request_item_id;
  else
    if not exists (
      select 1
      from public.pharmacy_catalog_products cp
      where cp.id = p_pharmacy_product_id
        and cp.pharmacy_id = v_pharmacy
        and cp.status in ('active', 'unpublished', 'archived_published')
    ) then
      raise exception 'Invalid pharmacy product for this officine';
    end if;
    v_kind := 'pharmacy';
    update public.request_items
    set
      line_product_kind = v_kind,
      product_id = null,
      pharmacy_product_id = p_pharmacy_product_id,
      manual_resolved_at = now(),
      updated_at = now()
    where id = p_request_item_id;
  end if;
end;
$$;

comment on function public.pharmacist_link_manual_line_to_product(uuid, uuid, uuid) is
'Lie une ligne patient_manual à un produit global ou privé officine ; conserve patient_requested_label en historique.';

grant execute on function public.pharmacist_link_manual_line_to_product(uuid, uuid, uuid) to authenticated;

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
  v_pharmacy uuid;
  v_el jsonb;
  v_kind text;
  v_pid uuid;
  v_pharmacy_pid uuid;
  v_label text;
  v_qty int;
  v_cc text;
  v_seen_product uuid[] := array[]::uuid[];
  v_seen_pharmacy uuid[] := array[]::uuid[];
  v_seen_manual text[] := array[]::text[];
  v_preserve_submitted boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select status, patient_id, request_type, pharmacy_id, submitted_at
  into v_old, v_patient, v_type, v_pharmacy, v_preserve_submitted
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
    v_kind := coalesce(nullif(trim(v_el->>'line_product_kind'), ''), 'global');
    v_qty := coalesce(nullif(v_el->>'requested_qty', '')::int, 0);
    v_cc := nullif(trim(v_el->>'client_comment'), '');

    if v_qty < 1 or v_qty > 10 then
      raise exception 'Quantité doit être entre 1 et 10.';
    end if;

    if v_cc is not null and char_length(v_cc) > 500 then
      raise exception 'Commentaire ligne trop long (500 caractères max).';
    end if;

    if v_kind = 'patient_manual' then
      v_label := nullif(trim(v_el->>'patient_requested_label'), '');
      if v_label is null or char_length(v_label) < 1 then
        raise exception 'Chaque ligne manuelle doit avoir un nom.';
      end if;
      if lower(trim(v_label)) = any(v_seen_manual) then
        raise exception 'Chaque produit ne peut figurer qu''une fois dans la liste.';
      end if;
      v_seen_manual := array_append(v_seen_manual, lower(trim(v_label)));

      insert into public.request_items (
        request_id,
        line_product_kind,
        patient_requested_label,
        requested_qty,
        is_selected_by_patient,
        counter_outcome,
        client_comment,
        line_source
      ) values (
        p_request_id,
        'patient_manual',
        v_label,
        v_qty,
        true,
        'unset',
        v_cc,
        'patient_request'::public.request_item_line_source_enum
      );
    elsif v_kind = 'pharmacy' then
      v_pharmacy_pid := (v_el->>'pharmacy_product_id')::uuid;
      if v_pharmacy_pid is null then
        raise exception 'Each pharmacy item needs pharmacy_product_id';
      end if;
      if v_pharmacy_pid = any(v_seen_pharmacy) then
        raise exception 'Chaque produit ne peut figurer qu''une fois dans la liste.';
      end if;
      v_seen_pharmacy := array_append(v_seen_pharmacy, v_pharmacy_pid);

      if not exists (
        select 1
        from public.pharmacy_catalog_products cp
        where cp.id = v_pharmacy_pid
          and cp.pharmacy_id = v_pharmacy
          and cp.status = 'active'
      ) then
        raise exception 'Invalid or inactive pharmacy product';
      end if;

      insert into public.request_items (
        request_id,
        line_product_kind,
        pharmacy_product_id,
        requested_qty,
        is_selected_by_patient,
        counter_outcome,
        client_comment,
        line_source
      ) values (
        p_request_id,
        'pharmacy',
        v_pharmacy_pid,
        v_qty,
        true,
        'unset',
        v_cc,
        'patient_request'::public.request_item_line_source_enum
      );
    else
      v_pid := (v_el->>'product_id')::uuid;
      if v_pid is null then
        raise exception 'Each item needs product_id';
      end if;
      if v_pid = any(v_seen_product) then
        raise exception 'Chaque produit ne peut figurer qu''une fois dans la liste.';
      end if;
      v_seen_product := array_append(v_seen_product, v_pid);

      if not exists (select 1 from public.products pr where pr.id = v_pid and pr.is_active = true) then
        raise exception 'Invalid or inactive product_id %', v_pid;
      end if;

      insert into public.request_items (
        request_id,
        line_product_kind,
        product_id,
        requested_qty,
        is_selected_by_patient,
        counter_outcome,
        client_comment,
        line_source
      ) values (
        p_request_id,
        'global',
        v_pid,
        v_qty,
        true,
        'unset',
        v_cc,
        'patient_request'::public.request_item_line_source_enum
      );
    end if;
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
    submitted_at = case
      when v_old in ('submitted', 'in_review') then submitted_at
      else now()
    end,
    patient_planned_visit_date = null,
    patient_planned_visit_time = null,
    expires_at = null,
    updated_at = now()
  where id = p_request_id;

  perform public._log_request_status_change(p_request_id, v_old, 'submitted', v_uid, 'patient_resubmit_product_request_after_response');
end;
$$;
