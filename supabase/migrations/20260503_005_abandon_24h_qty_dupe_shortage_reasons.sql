-- Pilote mai 2026 : Q12–Q13 (qté ≤ 10, pas de doublon produit par demande), Q16 (motifs),
-- Q6 (abandon auto 24 h si toujours en responded) vs Q38 (pas d’expiration +7 j pilotée depuis la réponse).

-- ---------------------------------------------------------------------------
-- Contraintes lignes demande
-- ---------------------------------------------------------------------------
alter table public.request_items
  drop constraint if exists request_items_requested_qty_check;

alter table public.request_items
  add constraint request_items_requested_qty_check
  check (requested_qty >= 1 and requested_qty <= 10);

create unique index if not exists request_items_unique_product_per_request_idx
  on public.request_items (request_id, product_id);

-- ---------------------------------------------------------------------------
-- Trigger : rupture marché -> market_shortages (pharmacien / RPC seulement côté app)
-- ---------------------------------------------------------------------------
create or replace function public._sync_market_shortage_from_request_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ph uuid;
begin
  if NEW.availability_status is distinct from 'market_shortage' then
    return NEW;
  end if;

  select r.pharmacy_id into v_ph
  from public.requests r
  where r.id = NEW.request_id;

  if v_ph is null then
    return NEW;
  end if;

  if exists (
    select 1 from public.market_shortages ms
    where ms.pharmacy_id = v_ph
      and ms.product_id = NEW.product_id
      and ms.is_active = true
  ) then
    return NEW;
  end if;

  insert into public.market_shortages (
    pharmacy_id,
    product_id,
    source_request_item_id,
    declared_by,
    note,
    is_active
  ) values (
    v_ph,
    NEW.product_id,
    NEW.id,
    null,
    nullif(trim(NEW.pharmacist_comment), ''),
    true
  );

  return NEW;
end;
$$;

drop trigger if exists trg_request_items_market_shortage_aiu on public.request_items;
create trigger trg_request_items_market_shortage_aiu
after insert or update of availability_status on public.request_items
for each row
execute function public._sync_market_shortage_from_request_item();

drop function if exists public.patient_abandon_request(uuid, text);

-- ---------------------------------------------------------------------------
-- Abandon patient : motifs (après responded / confirmed)
-- ---------------------------------------------------------------------------
create or replace function public.patient_abandon_request(
  p_request_id uuid,
  p_reason_code text,
  p_reason_other text default null
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
  v_log text;
  v_other text := nullif(trim(p_reason_other), '');
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_reason_code not in ('no_longer_needed', 'found_elsewhere', 'price', 'delay', 'mistake', 'other') then
    raise exception 'Motif inconnu.';
  end if;

  if p_reason_code = 'other' then
    if v_other is null or length(v_other) < 8 then
      raise exception 'Précise le motif (« autre ») en au moins 8 caractères.';
    end if;
    if length(v_other) > 2000 then
      raise exception 'Texte trop long.';
    end if;
  else
    if v_other is not null and length(v_other) > 2000 then
      raise exception 'Texte trop long.';
    end if;
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

  v_log := format('patient_abandon|%s|%s', p_reason_code, coalesce(v_other, ''));

  update public.requests
  set status = 'abandoned', updated_at = now()
  where id = p_request_id;

  perform public._log_request_status_change(p_request_id, v_old, 'abandoned', v_uid, v_log);
end;
$$;

revoke all on function public.patient_abandon_request(uuid, text, text) from public;
grant execute on function public.patient_abandon_request(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Annulation avant réponse (submitted | in_review) — même motifs
-- ---------------------------------------------------------------------------
create or replace function public.patient_cancel_product_request_before_response(
  p_request_id uuid,
  p_reason_code text,
  p_reason_other text default null
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
  v_log text;
  v_other text := nullif(trim(p_reason_other), '');
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_reason_code not in ('no_longer_needed', 'found_elsewhere', 'price', 'delay', 'mistake', 'other') then
    raise exception 'Motif inconnu.';
  end if;

  if p_reason_code = 'other' then
    if v_other is null or length(v_other) < 8 then
      raise exception 'Précise le motif (« autre ») en au moins 8 caractères.';
    end if;
    if length(v_other) > 2000 then
      raise exception 'Texte trop long.';
    end if;
  elsif v_other is not null and length(v_other) > 2000 then
    raise exception 'Texte trop long.';
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
    raise exception 'Only product_request';
  end if;

  if v_old not in ('submitted', 'in_review') then
    raise exception 'Cannot cancel before response from status %', v_old;
  end if;

  v_log := format('patient_cancel|%s|%s', p_reason_code, coalesce(v_other, ''));

  update public.requests
  set
    status = 'cancelled',
    cancelled_at = now(),
    updated_at = now()
  where id = p_request_id;

  perform public._log_request_status_change(p_request_id, v_old, 'cancelled', v_uid, v_log);
end;
$$;

revoke all on function public.patient_cancel_product_request_before_response(uuid, text, text) from public;
grant execute on function public.patient_cancel_product_request_before_response(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Resubmit : pas de doublon + qté bornée (aligné CHECK)
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
'Après responded/confirmed: remplace lignes sans doublon produit ; qté 1–10 ; repasse en submitted ; vide expires_at et passage.';

-- ---------------------------------------------------------------------------
-- Abandon automatique Q6 — responded sans confirmation après 24 h
-- À planifier comme expire_overdue_requests (cron service_role).
-- ---------------------------------------------------------------------------
create or replace function public.abandon_unconfirmed_responded_requests()
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
      status = 'responded'
      and responded_at is not null
      and responded_at < (now() - interval '24 hours')
    for update
  loop
    update public.requests
    set status = 'abandoned', updated_at = now()
    where id = r.id;

    perform public._log_request_status_change(r.id, r.status, 'abandoned', null, 'auto_abandon_24h_after_response');

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.abandon_unconfirmed_responded_requests() is
'Batch service_role : responded sans action patient (> 24 h) -> abandoned — Q6 pilote ; ne touche pas à confirmed / expires_at désactivée côté app.';

revoke all on function public.abandon_unconfirmed_responded_requests() from public;
grant execute on function public.abandon_unconfirmed_responded_requests() to service_role;
