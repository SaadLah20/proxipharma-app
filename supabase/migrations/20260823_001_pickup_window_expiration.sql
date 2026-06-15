-- Expiration passage traité + rappels patient/pharmacien (fenêtre 24 h après date de passage).

-- ---------------------------------------------------------------------------
-- Helpers : échéances passage / abandon (Africa/Casablanca)
-- ---------------------------------------------------------------------------
create or replace function public._planned_visit_passage_at(
  p_date date,
  p_time time without time zone
)
returns timestamptz
language sql
immutable
parallel safe
as $$
  select case
    when p_date is null then null::timestamptz
    when p_time is not null then
      (p_date + p_time) at time zone 'Africa/Casablanca'
    else
      (p_date + time '23:59:59') at time zone 'Africa/Casablanca'
  end;
$$;

create or replace function public._planned_visit_abandon_at(
  p_date date,
  p_time time without time zone
)
returns timestamptz
language sql
immutable
parallel safe
as $$
  select case
    when p_date is null then null::timestamptz
    when p_time is not null then
      public._planned_visit_passage_at(p_date, p_time) + interval '24 hours'
    else
      ((p_date + 1) + time '23:59:59') at time zone 'Africa/Casablanca'
  end;
$$;

create or replace function public._planned_visit_reason_suffix(
  p_date date,
  p_time time without time zone
)
returns text
language sql
immutable
parallel safe
as $$
  select case
    when p_date is null then ''
    when p_time is not null then
      '|' || p_date::text || '|' || to_char(p_time, 'HH24:MI:SS')
    else
      '|' || p_date::text
  end;
$$;

create or replace function public._request_has_any_pickup(p_request_id uuid)
returns boolean
language sql
stable
parallel safe
as $$
  select exists (
    select 1
    from public.request_items ri
    where ri.request_id = p_request_id
      and coalesce(ri.is_selected_by_patient, false)
      and not coalesce(ri.withdrawn_after_confirm, false)
      and ri.counter_outcome = 'picked_up'::public.counter_line_outcome_enum
  );
$$;

create or replace function public._request_has_active_retained_lines(p_request_id uuid)
returns boolean
language sql
stable
parallel safe
as $$
  select exists (
    select 1
    from public.request_items ri
    where ri.request_id = p_request_id
      and coalesce(ri.is_selected_by_patient, false)
      and not coalesce(ri.withdrawn_after_confirm, false)
  );
$$;

revoke all on function public._planned_visit_passage_at(date, time without time zone) from public;
revoke all on function public._planned_visit_abandon_at(date, time without time zone) from public;
revoke all on function public._planned_visit_reason_suffix(date, time without time zone) from public;
revoke all on function public._request_has_any_pickup(uuid) from public;
revoke all on function public._request_has_active_retained_lines(uuid) from public;

-- ---------------------------------------------------------------------------
-- Rappels patient : passage jour J (~10 h) ou T−2 h si heure saisie
-- ---------------------------------------------------------------------------
create or replace function public.remind_planned_visit_passage(
  p_day_reminder_hour int default 10
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hour int;
  v_today date;
  v_now_local timestamp;
  v_count int := 0;
  r record;
  v_reason text;
  v_passage_at timestamptz;
begin
  v_hour := greatest(0, least(coalesce(p_day_reminder_hour, 10), 23));
  v_now_local := now() at time zone 'Africa/Casablanca';
  v_today := v_now_local::date;

  -- Date seule : rappel le jour J à partir de l'heure configurée
  if v_now_local::time >= make_time(v_hour, 0, 0) then
    for r in
      select req.id, req.status, req.patient_planned_visit_date, req.patient_planned_visit_time
      from public.requests req
      where req.status = 'treated'::public.request_status_enum
        and req.request_type = 'product_request'::public.request_type_enum
        and req.patient_planned_visit_date is not null
        and req.patient_planned_visit_time is null
        and req.patient_planned_visit_date = v_today
        and public._request_has_active_retained_lines(req.id)
        and not public._request_has_any_pickup(req.id)
      for update
    loop
      v_reason := 'planned_visit_day_reminder' || public._planned_visit_reason_suffix(
        r.patient_planned_visit_date,
        r.patient_planned_visit_time
      );
      if exists (
        select 1
        from public.request_status_history h
        where h.request_id = r.id
          and h.reason = v_reason
      ) then
        continue;
      end if;

      perform public._log_request_status_change(
        r.id,
        r.status,
        r.status,
        null,
        v_reason
      );
      v_count := v_count + 1;
    end loop;
  end if;

  -- Date + heure : rappel entre T−2 h et T−30 min
  for r in
    select req.id, req.status, req.patient_planned_visit_date, req.patient_planned_visit_time
    from public.requests req
    where req.status = 'treated'::public.request_status_enum
      and req.request_type = 'product_request'::public.request_type_enum
      and req.patient_planned_visit_date is not null
      and req.patient_planned_visit_time is not null
      and public._request_has_active_retained_lines(req.id)
      and not public._request_has_any_pickup(req.id)
      and now() >= public._planned_visit_passage_at(req.patient_planned_visit_date, req.patient_planned_visit_time) - interval '2 hours'
      and now() < public._planned_visit_passage_at(req.patient_planned_visit_date, req.patient_planned_visit_time) - interval '30 minutes'
    for update
  loop
    v_reason := 'planned_visit_pre_passage_reminder' || public._planned_visit_reason_suffix(
      r.patient_planned_visit_date,
      r.patient_planned_visit_time
    );
    if exists (
      select 1
      from public.request_status_history h
      where h.request_id = r.id
        and h.reason = v_reason
    ) then
      continue;
    end if;

    perform public._log_request_status_change(
      r.id,
      r.status,
      r.status,
      null,
      v_reason
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.remind_planned_visit_passage(int) is
  'Cron service_role : rappel patient passage (jour J ~10 h sans heure, ou T−2 h avec heure).';

revoke all on function public.remind_planned_visit_passage(int) from public;
grant execute on function public.remind_planned_visit_passage(int) to service_role;

-- ---------------------------------------------------------------------------
-- Alerte pharmacien : passage dépassé sans retrait
-- ---------------------------------------------------------------------------
create or replace function public.alert_pharmacist_pickup_missed()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  r record;
  v_reason text;
begin
  for r in
    select req.id, req.status, req.patient_planned_visit_date, req.patient_planned_visit_time
    from public.requests req
    where req.status = 'treated'::public.request_status_enum
      and req.request_type = 'product_request'::public.request_type_enum
      and req.patient_planned_visit_date is not null
      and now() > public._planned_visit_passage_at(req.patient_planned_visit_date, req.patient_planned_visit_time)
      and public._request_has_active_retained_lines(req.id)
      and not public._request_has_any_pickup(req.id)
    for update
  loop
    v_reason := 'planned_visit_passed_no_pickup' || public._planned_visit_reason_suffix(
      r.patient_planned_visit_date,
      r.patient_planned_visit_time
    );
    if exists (
      select 1
      from public.request_status_history h
      where h.request_id = r.id
        and h.reason = v_reason
    ) then
      continue;
    end if;

    perform public._log_request_status_change(
      r.id,
      r.status,
      r.status,
      null,
      v_reason
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.alert_pharmacist_pickup_missed() is
  'Cron service_role : alerte pharmacien après date/heure de passage sans retrait comptoir.';

revoke all on function public.alert_pharmacist_pickup_missed() from public;
grant execute on function public.alert_pharmacist_pickup_missed() to service_role;

-- ---------------------------------------------------------------------------
-- Rappel pharmacien : validation patient imminente (T−1 h avant expiration 24 h)
-- ---------------------------------------------------------------------------
create or replace function public.remind_pharmacist_responded_expiry(
  p_responded_silence interval default interval '24 hours',
  p_reminder_before interval default interval '1 hour'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_silence interval;
  v_remind_after interval;
  v_count int := 0;
  r record;
begin
  v_silence := coalesce(nullif(p_responded_silence, interval '0'), interval '24 hours');
  v_remind_after := v_silence - coalesce(nullif(p_reminder_before, interval '0'), interval '1 hour');
  if v_remind_after <= interval '0' then
    v_remind_after := v_silence * 0.875;
  end if;

  for r in
    select id, status
    from public.requests
    where status = 'responded'::public.request_status_enum
      and responded_at is not null
      and responded_at <= (now() - v_remind_after)
      and responded_at > (now() - v_silence)
      and not exists (
        select 1
        from public.request_status_history h
        where h.request_id = requests.id
          and h.reason = 'responded_expiry_pharmacist_reminder'
      )
    for update
  loop
    perform public._log_request_status_change(
      r.id,
      r.status,
      r.status,
      null,
      'responded_expiry_pharmacist_reminder'
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.remind_pharmacist_responded_expiry(interval, interval) is
  'Cron service_role : alerte pharmacien ~1 h avant expiration d''une demande responded non validée.';

revoke all on function public.remind_pharmacist_responded_expiry(interval, interval) from public;
grant execute on function public.remind_pharmacist_responded_expiry(interval, interval) to service_role;

-- ---------------------------------------------------------------------------
-- Abandon auto : traité, passage + 24 h dépassé, aucun retrait
-- ---------------------------------------------------------------------------
create or replace function public.abandon_overdue_pickup_requests()
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
    select req.id, req.status, req.patient_planned_visit_date, req.patient_planned_visit_time
    from public.requests req
    where req.status = 'treated'::public.request_status_enum
      and req.request_type = 'product_request'::public.request_type_enum
      and req.patient_planned_visit_date is not null
      and now() > public._planned_visit_abandon_at(req.patient_planned_visit_date, req.patient_planned_visit_time)
      and public._request_has_active_retained_lines(req.id)
      and not public._request_has_any_pickup(req.id)
    for update
  loop
    update public.requests
    set status = 'abandoned'::public.request_status_enum, updated_at = now()
    where id = r.id;

    perform public._log_request_status_change(
      r.id,
      r.status,
      'abandoned'::public.request_status_enum,
      null,
      'auto_abandon_after_pickup_window'
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.abandon_overdue_pickup_requests() is
  'Cron service_role : treated -> abandoned si passage + 24 h dépassé sans retrait ni modification de date.';

revoke all on function public.abandon_overdue_pickup_requests() from public;
grant execute on function public.abandon_overdue_pickup_requests() to service_role;

-- ---------------------------------------------------------------------------
-- Libellés patient (rappels passage + abandon auto)
-- ---------------------------------------------------------------------------
create or replace function public._in_app_notification_patient(
  p_status public.request_status_enum,
  p_pharma_nom text,
  p_pharma_ville text,
  p_nature text,
  p_when_fr text,
  p_history_reason text default null
)
returns table (n_title text, n_body text)
language plpgsql
stable
as $$
declare
  v_item_id uuid;
  v_product_id uuid;
  v_request_id uuid;
  v_product_name text;
  v_had_alternative boolean;
begin
  if p_history_reason = 'patient_planned_visit_updated' then
    n_title := 'Passage en pharmacie mis à jour';
    n_body :=
      coalesce(p_pharma_nom, 'Votre pharmacie')
      || ' — votre date de passage a été modifiée.'
      || E'\n'
      || p_when_fr;
    return next;
    return;
  end if;

  if p_history_reason is not null and p_history_reason like 'planned_visit_day_reminder|%' then
    n_title := 'Rappel — passage prévu aujourd''hui';
    n_body :=
      'Votre passage est prévu aujourd''hui chez '
      || coalesce(p_pharma_nom, 'votre pharmacie')
      || '. Si vous ne pouvez pas venir, modifiez la date dans le dossier — sans changement, le dossier sera clos demain.'
      || E'\n'
      || p_when_fr;
    return next;
    return;
  end if;

  if p_history_reason is not null and p_history_reason like 'planned_visit_pre_passage_reminder|%' then
    n_title := 'Rappel — passage dans 2 h';
    n_body :=
      'Votre passage est prévu dans environ 2 h chez '
      || coalesce(p_pharma_nom, 'votre pharmacie')
      || '. Si vous ne pouvez pas venir, modifiez la date dans le dossier — sans changement, le dossier sera clos 24 h après l''heure prévue.'
      || E'\n'
      || p_when_fr;
    return next;
    return;
  end if;

  if p_history_reason = 'responded_expiry_reminder' then
    n_title := 'Rappel — validation en attente';
    n_body :=
      'Il reste peu de temps pour valider la réponse de '
      || coalesce(p_pharma_nom, 'votre pharmacie')
      || ' sur votre '
      || lower(coalesce(p_nature, 'demande'))
      || '. Ouvrez le dossier pour confirmer votre choix.'
      || E'\n'
      || p_when_fr;
    return next;
    return;
  end if;

  if p_history_reason is not null and (
    p_history_reason like 'pharmacist_supply_amendments_saved|%'
    or p_history_reason = 'pharmacist_adjustments_after_confirmation'
    or p_history_reason like 'audit_v1:%'
  ) then
    n_title := 'Mise à jour après validation';
    n_body :=
      coalesce(p_pharma_nom, 'Votre pharmacie')
      || ' a modifié des éléments de votre '
      || lower(coalesce(p_nature, 'demande'))
      || ' validée. Consultez le détail sur le dossier.'
      || E'\n'
      || p_when_fr;
    return next;
    return;
  end if;

  if p_history_reason is not null and p_history_reason like 'post_confirm_product_arrived|%' then
    v_item_id := nullif(split_part(p_history_reason, '|', 2), '')::uuid;
    select coalesce(nullif(btrim(pr.name), ''), 'Produit')
    into v_product_name
    from public.request_items ri
    left join public.products pr on pr.id = ri.product_id
    where ri.id = v_item_id;

    n_title := 'Produit reçu en officine';
    n_body :=
      coalesce(v_product_name, 'Un produit commandé')
      || ' est arrivé chez '
      || coalesce(p_pharma_nom, 'votre pharmacie')
      || '. Vous pouvez passer le retirer selon votre date de passage.'
      || E'\n'
      || p_when_fr;
    return next;
    return;
  end if;

  if p_history_reason is not null and p_history_reason like 'post_confirm_arrival_cancelled|%' then
    v_item_id := nullif(split_part(p_history_reason, '|', 2), '')::uuid;
    select coalesce(nullif(btrim(pr.name), ''), 'Produit')
    into v_product_name
    from public.request_items ri
    left join public.products pr on pr.id = ri.product_id
    where ri.id = v_item_id;

    n_title := 'Réception annulée en officine';
    n_body :=
      coalesce(p_pharma_nom, 'Votre pharmacie')
      || ' a annulé la confirmation de réception pour '
      || coalesce(v_product_name, 'un produit')
      || '. Consultez le dossier pour le suivi.'
      || E'\n'
      || p_when_fr;
    return next;
    return;
  end if;

  if p_history_reason is not null and p_history_reason like 'market_shortage_product_available|%' then
    v_product_id := nullif(split_part(p_history_reason, '|', 2), '')::uuid;
    v_request_id := nullif(split_part(p_history_reason, '|', 3), '')::uuid;
    select coalesce(nullif(btrim(pr.name), ''), 'Produit')
    into v_product_name
    from public.products pr
    where pr.id = v_product_id;

    v_had_alternative := false;
    if v_request_id is not null and v_product_id is not null then
      select exists (
        select 1
        from public.request_items ri
        where ri.request_id = v_request_id
          and ri.product_id = v_product_id
          and ri.patient_chosen_alternative_id is not null
      ) into v_had_alternative;
    end if;

    n_title := 'Produit de nouveau disponible';
    n_body :=
      coalesce(v_product_name, 'Un produit')
      || ' signalé en rupture est de nouveau disponible chez '
      || coalesce(p_pharma_nom, 'votre pharmacie')
      || '.';
    if v_had_alternative then
      n_body :=
        n_body
        || E'\n\nVous aviez validé une alternative : rouvrez le dossier si vous souhaitez ce produit.';
    end if;
    n_body := n_body || E'\n' || p_when_fr;
    return next;
    return;
  end if;

  if p_status = 'responded'::public.request_status_enum
     and p_history_reason is not null
     and p_history_reason = 'pharmacist_response_updated' then
    n_title := 'Réponse mise à jour';
    n_body :=
      coalesce(p_pharma_nom, 'Votre pharmacie')
      || ' a actualisé sa réponse sur votre '
      || lower(coalesce(p_nature, 'demande'))
      || '. Consultez les changements avant validation.'
      || E'\n'
      || p_when_fr;
    return next;
    return;
  end if;

  n_title :=
    case p_status
      when 'responded' then 'Réponse de la pharmacie'
      when 'treated' then 'Préparation terminée'
      when 'completed' then 'Dossier clôturé'
      when 'cancelled' then 'Demande annulée'
      when 'abandoned' then 'Demande abandonnée'
      when 'expired' then 'Demande expirée'
      else 'Mise à jour'
    end;

  n_body :=
    case p_status
      when 'responded' then
        coalesce(p_pharma_nom, 'Votre pharmacie')
        || ' a répondu à votre '
        || lower(coalesce(p_nature, 'demande'))
        || '. Validez votre choix sous 24 h.'
        || E'\n'
        || p_when_fr
      when 'treated' then
        coalesce(p_pharma_nom, 'Votre pharmacie')
        || ' a terminé la préparation. Consultez le détail de chaque produit avant votre passage.'
        || E'\n'
        || p_when_fr
      when 'completed' then
        'Votre '
        || lower(coalesce(p_nature, 'demande'))
        || ' est clôturée chez '
        || coalesce(p_pharma_nom, 'votre pharmacie')
        || '.'
        || E'\n'
        || p_when_fr
      when 'cancelled' then
        'Votre '
        || lower(coalesce(p_nature, 'demande'))
        || ' a été annulée.'
        || E'\n'
        || p_when_fr
      when 'abandoned' then
        case
          when p_history_reason = 'auto_abandon_after_pickup_window' then
            'Votre '
            || lower(coalesce(p_nature, 'demande'))
            || ' a été fermée automatiquement : la date de passage est dépassée depuis plus de 24 h sans retrait ni modification de date.'
          else
            'Votre '
            || lower(coalesce(p_nature, 'demande'))
            || ' a été abandonnée.'
        end
        || E'\n'
        || p_when_fr
      when 'expired' then
        'Le délai de validation est dépassé pour votre '
        || lower(coalesce(p_nature, 'demande'))
        || '.'
        || E'\n'
        || p_when_fr
      else
        coalesce(p_pharma_nom, 'Votre pharmacie')
        || ' — mise à jour sur votre '
        || lower(coalesce(p_nature, 'demande'))
        || '.'
        || E'\n'
        || p_when_fr
    end;

  if p_history_reason = 'auto_abandon_after_pickup_window' and p_status = 'abandoned'::public.request_status_enum then
    n_title := 'Dossier clos — passage non effectué';
  end if;

  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- Libellés pharmacien (rappels + abandon auto passage)
-- ---------------------------------------------------------------------------
create or replace function public._in_app_notification_pharmacist(
  p_status public.request_status_enum,
  p_old_status public.request_status_enum,
  p_pharma_nom text,
  p_pharma_ville text,
  p_patient_nom text,
  p_nature text,
  p_when_fr text,
  p_history_reason text default null
)
returns table (n_title text, n_body text)
language plpgsql
stable
as $$
declare
  v_is_update_submitted boolean := false;
begin
  if p_history_reason = 'patient_prescription_updated' then
    n_title := 'Ordonnance mise à jour';
    n_body :=
      coalesce(p_patient_nom, 'Un patient')
      || ' a modifié le scan ou une précision sur son '
      || lower(coalesce(p_nature, 'ordonnance'))
      || '.'
      || E'\n'
      || p_when_fr;
    return next;
    return;
  end if;

  if p_history_reason = 'patient_consultation_updated' then
    n_title := 'Consultation mise à jour';
    n_body :=
      coalesce(p_patient_nom, 'Un patient')
      || ' a modifié son message ou ses photos sur sa '
      || lower(coalesce(p_nature, 'consultation libre'))
      || '.'
      || E'\n'
      || p_when_fr;
    return next;
    return;
  end if;

  if p_history_reason = 'patient_planned_visit_updated' then
    n_title := 'Passage patient modifié';
    n_body :=
      coalesce(p_patient_nom, 'Un patient')
      || ' a modifié sa date de passage sur sa '
      || lower(coalesce(p_nature, 'demande'))
      || '.'
      || E'\n'
      || p_when_fr;
    return next;
    return;
  end if;

  if p_history_reason is not null and p_history_reason like 'planned_visit_passed_no_pickup|%' then
    n_title := 'Passage non effectué';
    n_body :=
      coalesce(p_patient_nom, 'Un patient')
      || ' ne s''est pas présenté à la date de passage prévue. Le dossier sera clos automatiquement 24 h après le passage si aucun retrait.'
      || E'\n'
      || p_when_fr;
    return next;
    return;
  end if;

  if p_history_reason = 'responded_expiry_pharmacist_reminder' then
    n_title := 'Validation patient imminente';
    n_body :=
      'La '
      || lower(coalesce(p_nature, 'demande'))
      || ' de '
      || coalesce(p_patient_nom, 'un patient')
      || ' expire dans environ 1 h faute de validation.'
      || E'\n'
      || p_when_fr;
    return next;
    return;
  end if;

  v_is_update_submitted :=
    p_status = 'submitted'
    and p_old_status is not null
    and p_old_status <> 'draft';

  n_title :=
    case p_status
      when 'submitted' then
        case when v_is_update_submitted then 'Demande mise à jour' else 'Nouvelle demande' end
      when 'confirmed' then 'Demande validée par le patient'
      when 'treated' then 'Demande marquée traitée'
      when 'completed' then 'Dossier clôturé au comptoir'
      when 'cancelled' then 'Demande annulée'
      when 'abandoned' then 'Demande abandonnée'
      when 'expired' then 'Demande expirée'
      else 'Mise à jour dossier'
    end;

  n_body :=
    case p_status
      when 'submitted' then
        case
          when v_is_update_submitted then
            coalesce(p_patient_nom, 'Un patient')
            || ' a renvoyé ou modifié sa '
            || lower(coalesce(p_nature, 'demande'))
            || '.'
          else
            coalesce(p_patient_nom, 'Un patient')
            || ' — '
            || coalesce(p_nature, 'Demande')
            || ' à traiter.'
        end
      when 'confirmed' then
        coalesce(p_patient_nom, 'Un patient')
        || ' a validé sa '
        || lower(coalesce(p_nature, 'demande'))
        || '. Préparez les produits retenus.'
      when 'treated' then
        'La '
        || lower(coalesce(p_nature, 'demande'))
        || ' de '
        || coalesce(p_patient_nom, 'un patient')
        || ' est prête pour le comptoir.'
      when 'completed' then
        'Le dossier '
        || lower(coalesce(p_nature, 'demande'))
        || ' de '
        || coalesce(p_patient_nom, 'un patient')
        || ' a été clôturé après passage.'
      when 'cancelled' then
        'Une '
        || lower(coalesce(p_nature, 'demande'))
        || ' a été annulée.'
      when 'abandoned' then
        case
          when p_history_reason = 'auto_abandon_after_pickup_window' then
            'La '
            || lower(coalesce(p_nature, 'demande'))
            || ' de '
            || coalesce(p_patient_nom, 'un patient')
            || ' a été fermée automatiquement : passage non effectué dans les délais.'
          else
            'Une '
            || lower(coalesce(p_nature, 'demande'))
            || ' a été abandonnée.'
        end
      when 'expired' then
        'Une '
        || lower(coalesce(p_nature, 'demande'))
        || ' a expiré faute de validation patient.'
      else
        coalesce(p_patient_nom, '—') || ' — ' || coalesce(p_nature, 'demande')
    end
    || E'\n'
    || p_when_fr;

  if p_history_reason = 'auto_abandon_after_pickup_window' and p_status = 'abandoned'::public.request_status_enum then
    n_title := 'Dossier clos — passage non effectué';
  end if;

  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- Émission in-app : rappels passage + alertes pharmacien
-- ---------------------------------------------------------------------------
create or replace function public._emit_in_app_notifications_for_status_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.requests%rowtype;
  v_pharma_nom text;
  v_pharma_ville text;
  v_patient_nom text;
  v_nature text;
  v_when_fr text;
  v_dossier_ref text;
  v_title_pat text;
  v_body_pat text;
  v_title_ph text;
  v_body_ph text;
  v_event_pat text;
  v_event_ph text;
  v_patient_supply_update boolean;
begin
  if new.reason = 'counter_outcome:picked_up' then
    return new;
  end if;

  select r.* into v_req from public.requests r where r.id = new.request_id;
  if not found then return new; end if;

  select ph.nom, ph.ville into v_pharma_nom, v_pharma_ville from public.pharmacies ph where ph.id = v_req.pharmacy_id;
  select coalesce(nullif(btrim(p.full_name::text), ''), 'Patient') into v_patient_nom from public.profiles p where p.id = v_req.patient_id;
  v_nature := public._request_type_label_fr(v_req.request_type);
  v_when_fr := to_char(new.created_at at time zone 'Africa/Casablanca', 'DD/MM/YYYY à HH24:MI');
  v_dossier_ref := nullif(btrim(v_req.request_public_ref), '');

  v_patient_supply_update :=
    new.reason is not null
    and (
      new.reason like 'pharmacist_supply_amendments_saved|%'
      or new.reason = 'pharmacist_adjustments_after_confirmation'
      or new.reason like 'audit_v1:%'
    );

  -- Rappels patient passage (sans changement de statut)
  if new.reason is not null and (
    new.reason like 'planned_visit_day_reminder|%'
    or new.reason like 'planned_visit_pre_passage_reminder|%'
  ) then
    select t.n_title, t.n_body into v_title_pat, v_body_pat
    from public._in_app_notification_patient(new.new_status, v_pharma_nom, v_pharma_ville, v_nature, v_when_fr, new.reason) as t;
    v_event_pat := case
      when new.reason like 'planned_visit_day_reminder|%' then 'request_event:planned_visit_day_reminder'
      else 'request_event:planned_visit_pre_passage_reminder'
    end;
    if v_dossier_ref is not null then
      v_body_pat := v_body_pat || E'\nRéf. dossier ' || v_dossier_ref;
    end if;
    insert into public.app_notifications (recipient_id, request_id, source_status_history_id, event_type, title, body)
    values (v_req.patient_id, new.request_id, new.id, v_event_pat, v_title_pat, v_body_pat)
    on conflict (source_status_history_id, recipient_id) do nothing;
    return new;
  end if;

  -- Alertes pharmacien passage / validation (sans changement de statut)
  if new.reason is not null and (
    new.reason like 'planned_visit_passed_no_pickup|%'
    or new.reason = 'responded_expiry_pharmacist_reminder'
  ) then
    select t.n_title, t.n_body into v_title_ph, v_body_ph
    from public._in_app_notification_pharmacist(
      new.new_status, new.old_status, v_pharma_nom, v_pharma_ville, v_patient_nom, v_nature, v_when_fr, new.reason
    ) as t;
    v_event_ph := case
      when new.reason like 'planned_visit_passed_no_pickup|%' then 'request_event:planned_visit_passed_no_pickup'
      else 'request_event:responded_expiry_pharmacist_reminder'
    end;
    if v_dossier_ref is not null then
      v_body_ph := v_body_ph || E'\nRéf. dossier ' || v_dossier_ref;
    end if;
    insert into public.app_notifications (recipient_id, request_id, source_status_history_id, event_type, title, body)
    select ps.user_id, new.request_id, new.id, v_event_ph, v_title_ph, v_body_ph
    from public.pharmacy_staff ps
    join public.profiles p on p.id = ps.user_id
    where ps.pharmacy_id = v_req.pharmacy_id and p.role = 'pharmacien'
      and (new.changed_by is null or ps.user_id is distinct from new.changed_by)
    on conflict (source_status_history_id, recipient_id) do nothing;
    return new;
  end if;

  if new.reason = 'patient_planned_visit_updated' then
    select t.n_title, t.n_body into v_title_pat, v_body_pat
    from public._in_app_notification_patient(new.new_status, v_pharma_nom, v_pharma_ville, v_nature, v_when_fr, new.reason) as t;
    if v_dossier_ref is not null then
      v_body_pat := v_body_pat || E'\nRéf. dossier ' || v_dossier_ref;
    end if;
    insert into public.app_notifications (recipient_id, request_id, source_status_history_id, event_type, title, body)
    values (v_req.patient_id, new.request_id, new.id, 'request_event:patient_planned_visit_updated', v_title_pat, v_body_pat)
    on conflict (source_status_history_id, recipient_id) do nothing;

    select t.n_title, t.n_body into v_title_ph, v_body_ph
    from public._in_app_notification_pharmacist(
      new.new_status, new.old_status, v_pharma_nom, v_pharma_ville, v_patient_nom, v_nature, v_when_fr, new.reason
    ) as t;
    if v_dossier_ref is not null then
      v_body_ph := v_body_ph || E'\nRéf. dossier ' || v_dossier_ref;
    end if;
    insert into public.app_notifications (recipient_id, request_id, source_status_history_id, event_type, title, body)
    select ps.user_id, new.request_id, new.id, 'request_event:patient_planned_visit_updated', v_title_ph, v_body_ph
    from public.pharmacy_staff ps
    join public.profiles p on p.id = ps.user_id
    where ps.pharmacy_id = v_req.pharmacy_id and p.role = 'pharmacien'
      and (new.changed_by is null or ps.user_id is distinct from new.changed_by)
    on conflict (source_status_history_id, recipient_id) do nothing;
    return new;
  end if;

  if new.reason = 'patient_prescription_updated' then
    select t.n_title, t.n_body into v_title_ph, v_body_ph
    from public._in_app_notification_pharmacist(
      new.new_status, new.old_status, v_pharma_nom, v_pharma_ville, v_patient_nom, v_nature, v_when_fr, new.reason
    ) as t;
    if v_dossier_ref is not null then
      v_body_ph := v_body_ph || E'\nRéf. dossier ' || v_dossier_ref;
    end if;
    insert into public.app_notifications (recipient_id, request_id, source_status_history_id, event_type, title, body)
    select ps.user_id, new.request_id, new.id, 'request_status:patient_prescription_updated', v_title_ph, v_body_ph
    from public.pharmacy_staff ps
    join public.profiles p on p.id = ps.user_id
    where ps.pharmacy_id = v_req.pharmacy_id and p.role = 'pharmacien'
      and (new.changed_by is null or ps.user_id is distinct from new.changed_by)
    on conflict (source_status_history_id, recipient_id) do nothing;
    return new;
  end if;

  if new.reason = 'patient_consultation_updated' then
    select t.n_title, t.n_body into v_title_ph, v_body_ph
    from public._in_app_notification_pharmacist(
      new.new_status, new.old_status, v_pharma_nom, v_pharma_ville, v_patient_nom, v_nature, v_when_fr, new.reason
    ) as t;
    if v_dossier_ref is not null then
      v_body_ph := v_body_ph || E'\nRéf. dossier ' || v_dossier_ref;
    end if;
    insert into public.app_notifications (recipient_id, request_id, source_status_history_id, event_type, title, body)
    select ps.user_id, new.request_id, new.id, 'request_status:patient_consultation_updated', v_title_ph, v_body_ph
    from public.pharmacy_staff ps
    join public.profiles p on p.id = ps.user_id
    where ps.pharmacy_id = v_req.pharmacy_id and p.role = 'pharmacien'
      and (new.changed_by is null or ps.user_id is distinct from new.changed_by)
    on conflict (source_status_history_id, recipient_id) do nothing;
    return new;
  end if;

  if new.new_status not in (
    'submitted', 'in_review', 'responded', 'confirmed', 'completed',
    'cancelled', 'abandoned', 'expired', 'treated'
  ) then
    return new;
  end if;

  if (
       (new.new_status in ('responded', 'treated', 'completed', 'cancelled', 'abandoned', 'expired')
         and new.new_status is distinct from new.old_status)
       or new.reason = 'pharmacist_response_updated'
       or new.reason = 'responded_expiry_reminder'
       or (new.reason is not null and (
         new.reason like 'post_confirm_product_arrived|%'
         or new.reason like 'post_confirm_arrival_cancelled|%'
         or new.reason like 'market_shortage_product_available|%'
       ))
       or v_patient_supply_update
     )
  then
    select t.n_title, t.n_body into v_title_pat, v_body_pat
    from public._in_app_notification_patient(new.new_status, v_pharma_nom, v_pharma_ville, v_nature, v_when_fr, new.reason) as t;

    v_event_pat := case
      when new.reason = 'pharmacist_response_updated' then 'request_event:pharmacist_response_updated'
      when new.reason = 'responded_expiry_reminder' then 'request_event:responded_expiry_reminder'
      when new.reason like 'post_confirm_product_arrived|%' then 'request_event:post_confirm_product_arrived'
      when new.reason like 'post_confirm_arrival_cancelled|%' then 'request_event:post_confirm_arrival_cancelled'
      when new.reason like 'market_shortage_product_available|%' then 'request_event:market_shortage_product_available'
      when new.reason like 'pharmacist_supply_amendments_saved|%' then 'request_event:pharmacist_supply_amendments_saved'
      when v_patient_supply_update then 'request_event:pharmacist_validated_request_updated'
      else 'request_status:' || new.new_status::text
    end;

    if v_dossier_ref is not null then
      v_body_pat := v_body_pat || E'\nRéf. dossier ' || v_dossier_ref;
    end if;

    insert into public.app_notifications (recipient_id, request_id, source_status_history_id, event_type, title, body)
    values (v_req.patient_id, new.request_id, new.id, v_event_pat, v_title_pat, v_body_pat)
    on conflict (source_status_history_id, recipient_id) do nothing;
  end if;

  if new.new_status in ('submitted', 'confirmed', 'treated', 'completed', 'abandoned', 'cancelled', 'expired')
     and new.new_status is distinct from new.old_status
     and coalesce(new.reason, '') is distinct from 'patient_planned_visit_updated'
     and coalesce(new.reason, '') not like 'post_confirm_product_arrived|%'
     and coalesce(new.reason, '') not like 'post_confirm_arrival_cancelled|%'
     and coalesce(new.reason, '') not like 'market_shortage_product_available|%'
     and coalesce(new.reason, '') is distinct from 'pharmacist_response_updated'
     and coalesce(new.reason, '') is distinct from 'responded_expiry_reminder'
     and not v_patient_supply_update
  then
    select t.n_title, t.n_body into v_title_ph, v_body_ph
    from public._in_app_notification_pharmacist(
      new.new_status, new.old_status, v_pharma_nom, v_pharma_ville, v_patient_nom, v_nature, v_when_fr, new.reason
    ) as t;

    if v_dossier_ref is not null then
      v_body_ph := v_body_ph || E'\nRéf. dossier ' || v_dossier_ref;
    end if;

    insert into public.app_notifications (recipient_id, request_id, source_status_history_id, event_type, title, body)
    select ps.user_id, new.request_id, new.id, 'request_status:' || new.new_status::text, v_title_ph, v_body_ph
    from public.pharmacy_staff ps
    join public.profiles p on p.id = ps.user_id
    where ps.pharmacy_id = v_req.pharmacy_id and p.role = 'pharmacien'
      and (new.changed_by is null or ps.user_id is distinct from new.changed_by)
    on conflict (source_status_history_id, recipient_id) do nothing;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Enqueue externe (e-mail ; WhatsApp phase 2 quand templates approuvés)
-- ---------------------------------------------------------------------------
create or replace function public._enqueue_external_notifications_from_app_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefs public.notification_external_prefs%rowtype;
  v_email text;
  v_wa text;
  v_phone text;
  v_is_patient boolean;
  v_phone_channel_allowed boolean;
begin
  if new.event_type not in (
    'request_status:submitted',
    'request_status:responded',
    'request_status:confirmed',
    'request_status:completed',
    'request_status:cancelled',
    'request_status:abandoned',
    'request_status:expired',
    'request_status:treated',
    'request_event:post_confirm_product_arrived',
    'request_event:market_shortage_product_available',
    'request_event:responded_expiry_reminder',
    'request_event:planned_visit_day_reminder',
    'request_event:planned_visit_pre_passage_reminder',
    'request_event:planned_visit_passed_no_pickup',
    'request_event:responded_expiry_pharmacist_reminder'
  ) then
    return new;
  end if;

  select p.email, p.whatsapp, (p.role = 'patient')
  into v_email, v_wa, v_is_patient
  from public.profiles p
  where p.id = new.recipient_id;

  select *
  into v_prefs
  from public.notification_external_prefs pref
  where pref.user_id = new.recipient_id;

  if not found then
    return new;
  end if;

  v_email := nullif(trim(both from coalesce(v_email, '')), '');
  v_wa := nullif(trim(both from coalesce(v_wa, '')), '');
  v_phone := v_wa;

  v_phone_channel_allowed :=
    (v_is_patient and new.event_type in (
      'request_status:responded',
      'request_status:treated',
      'request_status:expired',
      'request_event:post_confirm_product_arrived',
      'request_event:market_shortage_product_available',
      'request_event:responded_expiry_reminder',
      'request_event:planned_visit_day_reminder',
      'request_event:planned_visit_pre_passage_reminder'
    ))
    or (not v_is_patient and new.event_type in (
      'request_status:submitted',
      'request_event:planned_visit_passed_no_pickup',
      'request_event:responded_expiry_pharmacist_reminder'
    ));

  if v_prefs.email_enabled and v_email is not null then
    insert into public.notification_external_queue (
      recipient_id, request_id, app_notification_id, channel, event_type, title, body, destination_snapshot
    )
    values (
      new.recipient_id, new.request_id, new.id, 'email'::public.notification_external_channel_enum,
      new.event_type, new.title, new.body, v_email
    )
    on conflict (app_notification_id, channel) do nothing;
  end if;

  if v_prefs.whatsapp_enabled and v_phone is not null and v_phone_channel_allowed then
    insert into public.notification_external_queue (
      recipient_id, request_id, app_notification_id, channel, event_type, title, body, destination_snapshot
    )
    values (
      new.recipient_id, new.request_id, new.id, 'whatsapp'::public.notification_external_channel_enum,
      new.event_type, new.title, new.body, v_phone
    )
    on conflict (app_notification_id, channel) do nothing;
  end if;

  return new;
end;
$$;

comment on function public._enqueue_external_notifications_from_app_row() is
  'File externe : e-mail + WhatsApp. Rappels passage patient et alertes pharmacien (pickup / validation).';
