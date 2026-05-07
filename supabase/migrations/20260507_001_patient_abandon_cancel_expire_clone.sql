-- Règles métier demandes produits (patient) :
-- - Annulation avant réponse : cancelled (inchangé, RPC séparée).
-- - Abandon après réponse sans validation : cancelled (via patient_abandon_request depuis responded).
-- - Abandon après validation sans aucune récupération (ligne retenue + picked_up) : abandoned.
-- - Abandon après validation avec au moins une récupération : completed (clôturée).
-- - Silence 24 h après réponse pharmacien : expired (remplace l’ancien auto abandoned).
-- - Nouvelle demande depuis une demande expirée : RPC dédiée (lignes patient_request copiées).

-- ---------------------------------------------------------------------------
-- Batch service_role : responded sans action > 24 h -> expired
-- (nom de fonction conservé pour les crons existants)
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
    set status = 'expired', updated_at = now()
    where id = r.id;

    perform public._log_request_status_change(r.id, r.status, 'expired', null, 'auto_expire_24h_after_response');

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.abandon_unconfirmed_responded_requests() is
'Batch service_role : responded sans action patient (> 24 h) -> expired (cron).';

-- ---------------------------------------------------------------------------
-- Abandon patient : responded -> cancelled ; confirmed sans pickup -> abandoned ;
-- confirmed avec au moins une ligne retenue récupérée -> completed.
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
  v_has_pickup boolean;
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

  if v_old = 'responded' then
    update public.requests
    set
      status = 'cancelled',
      cancelled_at = now(),
      updated_at = now()
    where id = p_request_id;

    perform public._log_request_status_change(p_request_id, v_old, 'cancelled', v_uid, v_log);
    return;
  end if;

  -- confirmed
  select exists (
    select 1
    from public.request_items ri
    where ri.request_id = p_request_id
      and ri.is_selected_by_patient = true
      and ri.counter_outcome = 'picked_up'::public.counter_line_outcome_enum
  ) into v_has_pickup;

  if v_has_pickup then
    update public.requests
    set status = 'completed', updated_at = now()
    where id = p_request_id;

    perform public._log_request_status_change(p_request_id, v_old, 'completed', v_uid, v_log || '|after_pickup');
    return;
  end if;

  update public.requests
  set status = 'abandoned', updated_at = now()
  where id = p_request_id;

  perform public._log_request_status_change(p_request_id, v_old, 'abandoned', v_uid, v_log);
end;
$$;

revoke all on function public.patient_abandon_request(uuid, text, text) from public;
grant execute on function public.patient_abandon_request(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Nouvelle demande (submitted) depuis une demande expirée — lignes patient uniquement.
-- ---------------------------------------------------------------------------
create or replace function public.patient_create_followup_from_expired_product_request(
  p_expired_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pat uuid;
  v_ph uuid;
  v_type public.request_type_enum;
  v_st public.request_status_enum;
  v_new uuid;
  v_note text;
  v_n int := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select patient_id, pharmacy_id, request_type, status
  into v_pat, v_ph, v_type, v_st
  from public.requests
  where id = p_expired_request_id
  for update;

  if not found then
    raise exception 'Request not found';
  end if;

  if v_pat <> v_uid then
    raise exception 'Forbidden';
  end if;

  if v_type <> 'product_request' then
    raise exception 'Only product_request';
  end if;

  if v_st <> 'expired' then
    raise exception 'Expected status expired, got %', v_st;
  end if;

  select count(*)::int into v_n
  from public.request_items ri
  where ri.request_id = p_expired_request_id
    and ri.line_source = 'patient_request'::public.request_item_line_source_enum;

  if v_n < 1 then
    raise exception 'Aucune ligne « demandée par vous » à recopier sur cette demande.';
  end if;

  select pr.patient_note into v_note
  from public.product_requests pr
  where pr.request_id = p_expired_request_id;

  insert into public.requests (
    patient_id,
    pharmacy_id,
    request_type,
    status,
    submitted_at
  ) values (
    v_pat,
    v_ph,
    'product_request',
    'submitted',
    now()
  )
  returning id into v_new;

  insert into public.product_requests (request_id, patient_note)
  values (v_new, v_note);

  insert into public.request_items (
    request_id,
    product_id,
    requested_qty,
    is_selected_by_patient,
    counter_outcome,
    client_comment,
    line_source
  )
  select
    v_new,
    ri.product_id,
    ri.requested_qty,
    true,
    'unset'::public.counter_line_outcome_enum,
    ri.client_comment,
    'patient_request'::public.request_item_line_source_enum
  from public.request_items ri
  where ri.request_id = p_expired_request_id
    and ri.line_source = 'patient_request'::public.request_item_line_source_enum
  order by ri.created_at asc;

  return v_new;
end;
$$;

revoke all on function public.patient_create_followup_from_expired_product_request(uuid) from public;
grant execute on function public.patient_create_followup_from_expired_product_request(uuid) to authenticated;

comment on function public.patient_create_followup_from_expired_product_request(uuid) is
'Patient : depuis une demande product_request expirée, crée une nouvelle demande submitted avec les lignes line_source=patient_request.';

-- Données historiques : ancien auto abandon -> expired (statut + entrée d’historique)
do $$
declare
  r record;
begin
  for r in
    select x.id as rid
    from public.requests x
    where x.status = 'abandoned'
      and exists (
        select 1
        from public.request_status_history h
        where h.request_id = x.id
          and h.new_status = 'abandoned'
          and h.reason = 'auto_abandon_24h_after_response'
      )
  loop
    update public.requests
    set status = 'expired', updated_at = now()
    where id = r.rid;

    perform public._log_request_status_change(
      r.rid,
      'abandoned'::public.request_status_enum,
      'expired'::public.request_status_enum,
      null,
      'data_migration_auto_abandon_to_expire'
    );
  end loop;
end $$;
