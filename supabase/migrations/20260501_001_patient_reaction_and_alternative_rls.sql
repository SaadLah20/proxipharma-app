-- ProxiPharma: alternatives RLS (écriture pharmacien/admin seulement) + RPC réaction client
-- (responded -> confirmed -> partially_collected / fully_collected, abandoned, expired batch)
-- Idempotent.

-- ---------------------------------------------------------------------------
-- request_item_alternatives: lecture inchangée pour les acteurs de la demande,
-- écriture réservée au pharmacien de la pharmacie (ou admin).
-- ---------------------------------------------------------------------------
drop policy if exists "request_item_alternatives_access" on public.request_item_alternatives;

drop policy if exists "request_item_alternatives_select" on public.request_item_alternatives;
create policy "request_item_alternatives_select"
on public.request_item_alternatives
for select
to authenticated
using (
  exists (
    select 1
    from public.request_items ri
    join public.requests r on r.id = ri.request_id
    where ri.id = request_item_alternatives.request_item_id
      and (
        r.patient_id = auth.uid()
        or public.is_admin()
        or exists (
          select 1
          from public.pharmacy_staff ps
          join public.profiles p on p.id = ps.user_id
          where ps.pharmacy_id = r.pharmacy_id
            and ps.user_id = auth.uid()
            and p.role = 'pharmacien'
        )
      )
  )
);

drop policy if exists "request_item_alternatives_insert_pharmacien_admin" on public.request_item_alternatives;
create policy "request_item_alternatives_insert_pharmacien_admin"
on public.request_item_alternatives
for insert
to authenticated
with check (
  public.is_admin()
  or exists (
    select 1
    from public.request_items ri
    join public.requests r on r.id = ri.request_id
    join public.pharmacy_staff ps on ps.pharmacy_id = r.pharmacy_id
    join public.profiles p on p.id = ps.user_id
    where ri.id = request_item_alternatives.request_item_id
      and ps.user_id = auth.uid()
      and p.role = 'pharmacien'
  )
);

drop policy if exists "request_item_alternatives_update_pharmacien_admin" on public.request_item_alternatives;
create policy "request_item_alternatives_update_pharmacien_admin"
on public.request_item_alternatives
for update
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.request_items ri
    join public.requests r on r.id = ri.request_id
    join public.pharmacy_staff ps on ps.pharmacy_id = r.pharmacy_id
    join public.profiles p on p.id = ps.user_id
    where ri.id = request_item_alternatives.request_item_id
      and ps.user_id = auth.uid()
      and p.role = 'pharmacien'
  )
)
with check (
  public.is_admin()
  or exists (
    select 1
    from public.request_items ri
    join public.requests r on r.id = ri.request_id
    join public.pharmacy_staff ps on ps.pharmacy_id = r.pharmacy_id
    join public.profiles p on p.id = ps.user_id
    where ri.id = request_item_alternatives.request_item_id
      and ps.user_id = auth.uid()
      and p.role = 'pharmacien'
  )
);

drop policy if exists "request_item_alternatives_delete_pharmacien_admin" on public.request_item_alternatives;
create policy "request_item_alternatives_delete_pharmacien_admin"
on public.request_item_alternatives
for delete
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.request_items ri
    join public.requests r on r.id = ri.request_id
    join public.pharmacy_staff ps on ps.pharmacy_id = r.pharmacy_id
    join public.profiles p on p.id = ps.user_id
    where ri.id = request_item_alternatives.request_item_id
      and ps.user_id = auth.uid()
      and p.role = 'pharmacien'
  )
);

-- ---------------------------------------------------------------------------
-- Journal interne (non exposé aux clients)
-- ---------------------------------------------------------------------------
create or replace function public._log_request_status_change(
  p_request_id uuid,
  p_old public.request_status_enum,
  p_new public.request_status_enum,
  p_changed_by uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.request_status_history (request_id, old_status, new_status, changed_by, reason)
  values (p_request_id, p_old, p_new, p_changed_by, p_reason);
end;
$$;

revoke all on function public._log_request_status_change(uuid, public.request_status_enum, public.request_status_enum, uuid, text) from public;

-- ---------------------------------------------------------------------------
-- patient_confirm_after_response
-- responded -> confirmed
-- p_selections: [{ "request_item_id": "<uuid>", "is_selected": true, "selected_qty": 2 }, ...]
-- Au moins une ligne sélectionnée requise.
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
        updated_at = now()
      where id = v_item_id;
      v_any_selected := true;
    else
      update public.request_items
      set
        is_selected_by_patient = false,
        selected_qty = null,
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

revoke all on function public.patient_confirm_after_response(uuid, jsonb) from public;
grant execute on function public.patient_confirm_after_response(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- patient_mark_collected
-- confirmed -> partially_collected | fully_collected
-- p_scope: 'partial' | 'full'
-- ---------------------------------------------------------------------------
create or replace function public.patient_mark_collected(
  p_request_id uuid,
  p_scope text
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
  v_new public.request_status_enum;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_scope not in ('partial', 'full') then
    raise exception 'p_scope must be partial or full';
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

  if v_old <> 'confirmed' then
    raise exception 'Invalid status: expected confirmed, got %', v_old;
  end if;

  if p_scope = 'full' then
    v_new := 'fully_collected';
  else
    v_new := 'partially_collected';
  end if;

  update public.requests
  set status = v_new, updated_at = now()
  where id = p_request_id;

  perform public._log_request_status_change(p_request_id, v_old, v_new, v_uid, 'patient_mark_collected');
end;
$$;

revoke all on function public.patient_mark_collected(uuid, text) from public;
grant execute on function public.patient_mark_collected(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- patient_abandon_request
-- responded | confirmed -> abandoned
-- ---------------------------------------------------------------------------
create or replace function public.patient_abandon_request(
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
  v_patient uuid;
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

  if v_old not in ('responded', 'confirmed') then
    raise exception 'Cannot abandon from status %', v_old;
  end if;

  update public.requests
  set status = 'abandoned', updated_at = now()
  where id = p_request_id;

  perform public._log_request_status_change(p_request_id, v_old, 'abandoned', v_uid, p_reason);
end;
$$;

revoke all on function public.patient_abandon_request(uuid, text) from public;
grant execute on function public.patient_abandon_request(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- expire_overdue_requests
-- responded | confirmed avec expires_at dépassé -> expired
-- À appeler via pg_cron / Edge Function (service_role).
-- ---------------------------------------------------------------------------
create or replace function public.expire_overdue_requests()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  r record;
begin
  for r in
    select id, status
    from public.requests
    where
      status in ('responded', 'confirmed')
      and expires_at is not null
      and expires_at < now()
    for update
  loop
    update public.requests
    set status = 'expired', updated_at = now()
    where id = r.id;

    perform public._log_request_status_change(r.id, r.status, 'expired', null, 'expire_overdue_requests');
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.expire_overdue_requests() from public;
grant execute on function public.expire_overdue_requests() to service_role;
