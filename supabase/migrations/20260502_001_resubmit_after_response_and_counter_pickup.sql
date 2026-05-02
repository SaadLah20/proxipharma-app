-- ProxiPharma: révision patient après réponse (renvoi en traitement + reset préparation pharma)
-- + suivi au comptoir par ligne (outcome pharmacien) + clôture `completed`.
-- Ancien flux patient_mark_collected (partially/full) désactivé côté app (revoke EXECUTE au patient).
-- Idempotent.

-- Statut terminal après passage en officine traité jusqu'au bout.
do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    where t.typname = 'request_status_enum'
      and e.enumlabel = 'completed'
  ) then
    alter type public.request_status_enum add value 'completed';
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'counter_line_outcome_enum') then
    create type public.counter_line_outcome_enum as enum (
      'unset',
      'picked_up',
      'cancelled_at_counter',
      'deferred_next_visit'
    );
  end if;
end $$;

alter table public.request_items
  add column if not exists counter_outcome public.counter_line_outcome_enum not null default 'unset'::public.counter_line_outcome_enum;

create index if not exists request_items_counter_outcome_idx
  on public.request_items (counter_outcome)
  where counter_outcome <> 'unset'::public.counter_line_outcome_enum;

-- ---------------------------------------------------------------------------
-- patient_resubmit_product_request_after_response
-- Dépose une nouvelle liste produits après `responded` ou `confirmed` -> `submitted`
-- (alternatives + données pharmacien effacées, lignes régénérées).
-- ---------------------------------------------------------------------------
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

  if v_old not in ('responded', 'confirmed') then
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

    if v_qty < 1 then
      raise exception 'Each item must have requested_qty >= 1';
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
    updated_at = now()
  where id = p_request_id;

  perform public._log_request_status_change(p_request_id, v_old, 'submitted', v_uid, 'patient_resubmit_product_request_after_response');
end;
$$;

revoke all on function public.patient_resubmit_product_request_after_response(uuid, text, jsonb) from public;
grant execute on function public.patient_resubmit_product_request_after_response(uuid, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Réinitialise l outcome comptoir quand le client confirme sa sélection en ligne
-- (nouveau passage en officine à tracer).
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

    select * into v_row
    from public.request_items
    where id = v_item_id and request_id = p_request_id
    for update;

    if not found then
      raise exception 'Invalid request_item_id %', v_item_id;
    end if;

    if v_is_selected then
      v_max_qty := v_row.requested_qty;
      if v_row.available_qty is not null then
        v_max_qty := least(v_max_qty, v_row.available_qty);
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
        counter_outcome = 'unset',
        updated_at = now()
      where id = v_item_id;
      v_any_selected := true;
    else
      update public.request_items
      set
        is_selected_by_patient = false,
        selected_qty = null,
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

-- ---------------------------------------------------------------------------
-- pharmacien: statut par ligne au comptoir
-- ---------------------------------------------------------------------------
create or replace function public.pharmacist_set_item_counter_outcome(
  p_request_item_id uuid,
  p_outcome text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_new public.counter_line_outcome_enum;
  v_req_id uuid;
  v_st public.request_status_enum;
  v_pharmacy uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  begin
    v_new := p_outcome::public.counter_line_outcome_enum;
  exception
    when invalid_text_representation then
      raise exception 'Invalid outcome %', p_outcome;
  end;

  select ri.request_id, r.status, r.pharmacy_id
  into v_req_id, v_st, v_pharmacy
  from public.request_items ri
  join public.requests r on r.id = ri.request_id
  where ri.id = p_request_item_id;

  if v_req_id is null then
    raise exception 'Request item not found';
  end if;

  if not public.is_admin() and not exists (
    select 1 from public.pharmacy_staff ps
    join public.profiles p on p.id = ps.user_id
    where ps.pharmacy_id = v_pharmacy
      and ps.user_id = v_uid
      and p.role = 'pharmacien'
  ) then
    raise exception 'Forbidden';
  end if;

  if v_st not in ('responded', 'confirmed') then
    raise exception 'Counter updates only allowed for responded or confirmed, got %', v_st;
  end if;

  update public.request_items
  set
    counter_outcome = v_new,
    updated_at = now()
  where id = p_request_item_id;
end;
$$;

revoke all on function public.pharmacist_set_item_counter_outcome(uuid, text) from public;
grant execute on function public.pharmacist_set_item_counter_outcome(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- pharmacien: clôture dossier après comptoir
-- Exige aucune ligne en `unset` ni `deferred_next_visit` (réserver / annuler avant de clôturer).
-- ---------------------------------------------------------------------------
create or replace function public.pharmacist_complete_request_after_counter(
  p_request_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_old public.request_status_enum;
  v_pharmacy uuid;
  v_bad int;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select status, pharmacy_id into v_old, v_pharmacy
  from public.requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found';
  end if;

  if not public.is_admin() and not exists (
    select 1 from public.pharmacy_staff ps
    join public.profiles p on p.id = ps.user_id
    where ps.pharmacy_id = v_pharmacy
      and ps.user_id = v_uid
      and p.role = 'pharmacien'
  ) then
    raise exception 'Forbidden';
  end if;

  if v_old not in ('responded', 'confirmed') then
    raise exception 'Cannot complete from status %', v_old;
  end if;

  select count(*)::int into v_bad
  from public.request_items
  where request_id = p_request_id
    and is_selected_by_patient = true
    and counter_outcome in (
      'unset'::public.counter_line_outcome_enum,
      'deferred_next_visit'::public.counter_line_outcome_enum
    );

  if v_bad > 0 then
    raise exception 'Réglage comptoir requis: lignes encore « non traitées » ou « plus tard », ou lignes désactivées.';
  end if;

  update public.requests
  set status = 'completed'::public.request_status_enum, updated_at = now()
  where id = p_request_id;

  perform public._log_request_status_change(
    p_request_id,
    v_old,
    'completed'::public.request_status_enum,
    v_uid,
    coalesce(p_reason, 'pharmacist_complete_request_after_counter')
  );
end;
$$;

revoke all on function public.pharmacist_complete_request_after_counter(uuid, text) from public;
grant execute on function public.pharmacist_complete_request_after_counter(uuid, text) to authenticated;

comment on function public.pharmacist_set_item_counter_outcome(uuid, text) is
'Comptoir: unset | picked_up | cancelled_at_counter | deferred_next_visit.';

comment on function public.pharmacist_complete_request_after_counter(uuid, text) is
'Clôture: toutes lignes picked_up ou cancelled_at_counter uniquement (plus de déféré ni ligne non traitée).';

comment on function public.patient_resubmit_product_request_after_response(uuid, text, jsonb) is
'Après responded/confirmed: remplace les lignes produits et repasse la demande en submitted.';

-- ---------------------------------------------------------------------------
-- Désactivation du clic patient "partiel/complet livré"
-- ---------------------------------------------------------------------------
revoke execute on function public.patient_mark_collected(uuid, text) from authenticated;

comment on function public.patient_mark_collected(uuid, text) is
'DEPRECATED: retrait physique tracé par pharmacien_set_item_counter_outcome + pharmacist_complete_request_after_counter.';
