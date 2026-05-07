-- In-app notifications : distinguer nouvelle demande vs mise à jour patient,
-- enrichir annulation (motif pharmacien), notifier pharmacien sur expired / cancelled avec contexte.

-- Patient : motif si annulation par la pharmacie (reason pharmacist_cancel|...)
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
  v_motif text;
begin
  n_title :=
    case p_status
      when 'in_review' then 'Votre demande est en cours de traitement'
      when 'responded' then 'La pharmacie vous a répondu'
      when 'completed' then 'Votre demande est clôturée'
      when 'cancelled' then 'Votre demande a été annulée'
      when 'abandoned' then 'Votre demande a été abandonnée'
      when 'expired' then 'Votre demande a expiré'
      else 'Mise à jour de votre demande'
    end;

  v_motif := null;
  if p_history_reason is not null and p_history_reason like 'pharmacist_cancel|%' then
    v_motif := substring(p_history_reason from char_length('pharmacist_cancel|') + 1);
  end if;

  n_body :=
    'Pharmacie : ' || coalesce(p_pharma_nom, '—')
    || ' · ' || coalesce(p_pharma_ville, '—')
    || E'\nNature : ' || p_nature
    || E'\nMis à jour le : ' || p_when_fr
    || E'\n\n'
    || case p_status
      when 'in_review' then
        E'L’officine traite votre dossier. Vous recevrez une notification dès qu’une réponse sera disponible.'
      when 'responded' then
        E'Vous pouvez ouvrir la demande pour valider la proposition ou demander une modification.'
      when 'completed' then
        E'Merci d’avoir utilisé ProxiPharma. Conservez ce dossier pour votre suivi si besoin.'
      when 'cancelled' then
        case
          when v_motif is not null and btrim(v_motif) <> '' then
            E'La pharmacie a annulé cette demande.' || E'\n\nMotif : ' || btrim(v_motif)
          else
            E'La demande ne sera plus suivie. Vous pouvez en créer une nouvelle depuis l’annuaire si nécessaire.'
        end
      when 'abandoned' then
        E'Le dossier a été abandonné (délai ou autre motif). Contactez la pharmacie en cas de doute.'
      when 'expired' then
        E'Le délai de traitement est dépassé. Vous pouvez relancer une nouvelle demande.'
      else
        E'Consultez le détail de la demande pour plus d’informations.'
    end;

  return next;
end;
$$;

-- Pharmacien : nouvelle vs mise à jour (submitted depuis autre statut), expired, cancelled selon auteur
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
  v_ph_cancel_motif text;
begin
  v_is_update_submitted :=
    p_status = 'submitted'
    and p_old_status is not null
    and p_old_status <> 'draft';

  if p_history_reason is not null and p_history_reason like 'pharmacist_cancel|%' then
    v_ph_cancel_motif := substring(p_history_reason from char_length('pharmacist_cancel|') + 1);
  else
    v_ph_cancel_motif := null;
  end if;

  n_title :=
    case p_status
      when 'submitted' then
        case when v_is_update_submitted
          then 'Le patient a mis à jour sa demande'
          else 'Vous avez une nouvelle demande à traiter'
        end
      when 'confirmed' then 'Le patient a validé votre proposition'
      when 'cancelled' then
        case
          when v_ph_cancel_motif is not null and btrim(v_ph_cancel_motif) <> '' then
            'Demande annulée par l’officine'
          else
            'Une demande a été annulée'
        end
      when 'abandoned' then 'Une demande a été abandonnée'
      when 'expired' then 'Une demande a expiré (sans validation patient)'
      else 'Mise à jour d’une demande'
    end;

  n_body :=
    'Votre officine : ' || coalesce(p_pharma_nom, '—')
    || ' · ' || coalesce(p_pharma_ville, '—')
    || E'\nPatient : ' || coalesce(p_patient_nom, '—')
    || E'\nNature : ' || p_nature
    || E'\nÉvénement le : ' || p_when_fr
    || E'\n\n'
    || case p_status
      when 'submitted' then
        case when v_is_update_submitted
          then E'Le patient a renvoyé ou modifié sa liste. Ouvrez la demande pour traiter la version à jour.'
          else E'Ouvrez la demande pour préparer votre réponse et indiquer les produits disponibles ou les alternatives.'
        end
      when 'confirmed' then
        E'Le patient a confirmé la sélection. Vous pouvez poursuivre la préparation / le retrait au comptoir.'
      when 'cancelled' then
        case
          when v_ph_cancel_motif is not null and btrim(v_ph_cancel_motif) <> '' then
            E'Motif enregistré : ' || btrim(v_ph_cancel_motif)
          else
            E'La demande est passée en annulée. Vérifiez le dossier si vous aviez réservé du stock.'
        end
      when 'abandoned' then
        E'La demande a été abandonnée. Vérifiez le détail si vous devez libérer du stock réservé.'
      when 'expired' then
        E'Le délai après réponse pharmacie est dépassé sans action du patient. Aucune suite attendue sauf nouvelle demande.'
      else
        E'Consultez le dossier pour le contexte complet.'
    end;

  return next;
end;
$$;

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
  v_title_pat text;
  v_body_pat text;
  v_title_ph text;
  v_body_ph text;
begin
  if new.new_status not in (
    'submitted', 'in_review', 'responded', 'confirmed', 'completed',
    'cancelled', 'abandoned', 'expired'
  ) then
    return new;
  end if;

  select r.* into v_req
  from public.requests r
  where r.id = new.request_id;

  if not found then
    return new;
  end if;

  select ph.nom, ph.ville
  into v_pharma_nom, v_pharma_ville
  from public.pharmacies ph
  where ph.id = v_req.pharmacy_id;

  select coalesce(nullif(btrim(p.full_name::text), ''), 'Patient')
  into v_patient_nom
  from public.profiles p
  where p.id = v_req.patient_id;

  v_nature := public._request_type_label_fr(v_req.request_type);
  v_when_fr := to_char(
    new.created_at at time zone 'Africa/Casablanca',
    'DD/MM/YYYY à HH24:MI'
  );

  if new.new_status in ('in_review', 'responded', 'completed', 'cancelled', 'abandoned', 'expired') then
    select t.n_title, t.n_body
    into v_title_pat, v_body_pat
    from public._in_app_notification_patient(
      new.new_status,
      v_pharma_nom,
      v_pharma_ville,
      v_nature,
      v_when_fr,
      new.reason
    ) as t;

    insert into public.app_notifications (
      recipient_id, request_id, source_status_history_id, event_type, title, body
    )
    values (
      v_req.patient_id,
      new.request_id,
      new.id,
      'request_status:' || new.new_status::text,
      v_title_pat,
      v_body_pat
    )
    on conflict (source_status_history_id, recipient_id)
    do nothing;
  end if;

  if new.new_status in ('submitted', 'confirmed', 'abandoned', 'cancelled', 'expired') then
    select t.n_title, t.n_body
    into v_title_ph, v_body_ph
    from public._in_app_notification_pharmacist(
      new.new_status,
      new.old_status,
      v_pharma_nom,
      v_pharma_ville,
      v_patient_nom,
      v_nature,
      v_when_fr,
      new.reason
    ) as t;

    insert into public.app_notifications (
      recipient_id, request_id, source_status_history_id, event_type, title, body
    )
    select
      ps.user_id,
      new.request_id,
      new.id,
      'request_status:' || new.new_status::text,
      v_title_ph,
      v_body_ph
    from public.pharmacy_staff ps
    join public.profiles p on p.id = ps.user_id
    where ps.pharmacy_id = v_req.pharmacy_id
      and p.role = 'pharmacien'
    on conflict (source_status_history_id, recipient_id)
    do nothing;
  end if;

  return new;
end;
$$;

comment on function public._emit_in_app_notifications_for_status_history() is
  'Insère notifications patient/pharmacien ; motif annulation pharmacien ; submitted = mise à jour si ancien statut non draft.';
