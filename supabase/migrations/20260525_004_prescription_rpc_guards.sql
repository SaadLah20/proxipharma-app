-- Élargir les gardes RPC post-validation / annulation aux ordonnances.

create or replace function public.pharmacist_cancel_request(
  p_request_id uuid,
  p_reason_text text
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
  v_type public.request_type_enum;
  v_reason text := nullif(trim(p_reason_text), '');
  v_is_staff boolean := false;
  v_log text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if v_reason is null or length(v_reason) < 5 then
    raise exception 'Motif d''annulation obligatoire (5 caractères minimum).';
  end if;

  if length(v_reason) > 2000 then
    raise exception 'Motif d''annulation trop long.';
  end if;

  select status, pharmacy_id, request_type
  into v_old, v_pharmacy, v_type
  from public.requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found';
  end if;

  if not public._request_uses_product_line_workflow(v_type) then
    raise exception 'Unsupported request type';
  end if;

  if v_old not in ('submitted', 'in_review', 'responded', 'confirmed') then
    raise exception 'Cannot cancel from status %', v_old;
  end if;

  select exists(
    select 1
    from public.pharmacy_staff ps
    where ps.user_id = v_uid
      and ps.pharmacy_id = v_pharmacy
  )
  into v_is_staff;

  if not v_is_staff then
    raise exception 'Forbidden';
  end if;

  v_log := format('pharmacist_cancel|%s', v_reason);

  update public.requests
  set
    status = 'cancelled',
    cancelled_at = now(),
    updated_at = now()
  where id = p_request_id;

  perform public._log_request_status_change(p_request_id, v_old, 'cancelled', v_uid, v_log);
end;
$$;

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

  if not public._request_uses_product_line_workflow(v_type) then
    raise exception 'Unsupported request type';
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

create or replace function public.pharmacist_record_supply_amendments(
  p_request_id uuid,
  p_amendments jsonb
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
  v_type public.request_type_enum;
  elem jsonb;
  v_ch text;
  v_n int;
  i int;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_amendments is null or jsonb_typeof(p_amendments) <> 'array' or jsonb_array_length(p_amendments) < 1 then
    raise exception 'Liste d''entrées vide ou invalide.';
  end if;

  select status, pharmacy_id, request_type
  into v_old, v_pharmacy, v_type
  from public.requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found';
  end if;

  if not public._request_uses_product_line_workflow(v_type) then
    raise exception 'Unsupported request type';
  end if;

  if v_old not in ('confirmed', 'treated') then
    raise exception 'Amendements autorisés seulement en confirmed ou treated (statut courant %).', v_old;
  end if;

  if not exists (
    select 1 from public.pharmacy_staff ps
    join public.profiles p on p.id = ps.user_id
    where ps.pharmacy_id = v_pharmacy
      and ps.user_id = v_uid
      and p.role = 'pharmacien'
  ) then
    raise exception 'Accès pharmacien requis';
  end if;

  v_n := jsonb_array_length(p_amendments);
  for i in 0..(v_n - 1) loop
    elem := p_amendments -> i;
    v_ch := nullif(trim(coalesce(elem->>'client_confirmation_channel', '')), '');
    if v_ch is null or length(v_ch) < 2 then
      raise exception 'Canal client obligatoire sur chaque entrée (entrée %).', i + 1;
    end if;
    if length(v_ch) > 80 then
      raise exception 'Canal client trop long (80 car max).';
    end if;
  end loop;

  insert into public.request_supply_amendments (request_id, created_by, amendments)
  values (p_request_id, v_uid, p_amendments);
end;
$$;

create or replace function public.pharmacist_mark_request_treated(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_old public.request_status_enum;
  v_pharmacy uuid;
  v_type public.request_type_enum;
  v_row record;
  v_eff public.availability_status_enum;
  v_pcf public.post_confirm_fulfillment_enum;
  v_bad int := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select status, pharmacy_id, request_type
  into v_old, v_pharmacy, v_type
  from public.requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found';
  end if;

  if not public._request_uses_product_line_workflow(v_type) then
    raise exception 'Unsupported request type';
  end if;

  if v_old is distinct from 'confirmed' then
    raise exception 'Statut % : impossible de passer en traitée', v_old;
  end if;

  if not exists (
    select 1 from public.pharmacy_staff ps
    join public.profiles p on p.id = ps.user_id
    where ps.pharmacy_id = v_pharmacy
      and ps.user_id = v_uid
      and p.role = 'pharmacien'
  ) then
    raise exception 'Accès pharmacien requis';
  end if;

  for v_row in
    select
      ri.id,
      ri.is_selected_by_patient,
      ri.withdrawn_after_confirm,
      ri.patient_chosen_alternative_id,
      coalesce(ria.availability_status, ri.availability_status) as eff_av,
      ri.post_confirm_fulfillment
    from public.request_items ri
    left join public.request_item_alternatives ria
      on ria.id = ri.patient_chosen_alternative_id and ria.request_item_id = ri.id
    where ri.request_id = p_request_id
  loop
    if not coalesce(v_row.is_selected_by_patient, false) then
      continue;
    end if;

    if coalesce(v_row.withdrawn_after_confirm, false) then
      continue;
    end if;

    v_eff := v_row.eff_av;
    v_pcf := v_row.post_confirm_fulfillment;

    if v_eff in ('available', 'partially_available') then
      if v_pcf is distinct from 'reserved' then
        v_bad := v_bad + 1;
      end if;
    elsif v_eff = 'to_order' then
      if v_pcf is distinct from 'ordered' and v_pcf is distinct from 'arrived_reserved' then
        v_bad := v_bad + 1;
      end if;
    else
      v_bad := v_bad + 1;
    end if;
  end loop;

  if v_bad > 0 then
    raise exception 'Toutes les lignes retenues non retirées doivent être « réservé » ou « commandé » (ou arrivé en officine) selon la voie officine/commande.';
  end if;

  update public.requests set status = 'treated', updated_at = now() where id = p_request_id;

  perform public._log_request_status_change(
    p_request_id,
    v_old,
    'treated',
    v_uid,
    'pharmacist_mark_request_treated'
  );
end;
$$;
