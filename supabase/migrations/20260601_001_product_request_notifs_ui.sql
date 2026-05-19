-- Demandes produits : libellés notif traitée, passage patient, amendements post-validation, réception en officine.

-- ---------------------------------------------------------------------------
-- Libellés patient (traitée ≠ « prête » ; amendements ; réception produit)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._in_app_notification_patient(
  p_status public.request_status_enum,
  p_pharma_nom text,
  p_pharma_ville text,
  p_nature text,
  p_when_fr text,
  p_history_reason text DEFAULT NULL
)
RETURNS TABLE (n_title text, n_body text)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_motif text;
  v_item_id uuid;
  v_product_name text;
BEGIN
  IF p_history_reason = 'patient_planned_visit_updated' THEN
    n_title := 'Passage en pharmacie mis à jour';
    n_body :=
      'Pharmacie : ' || coalesce(p_pharma_nom, '—')
      || ' · ' || coalesce(p_pharma_ville, '—')
      || E'\nDossier : ' || p_nature
      || E'\nMis à jour le : ' || p_when_fr
      || E'\n\n'
      || E'Votre créneau de passage prévu a été modifié. Ouvrez la demande pour voir le détail.';
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_history_reason IS NOT NULL AND p_history_reason LIKE 'pharmacist_supply_amendments_saved|%' THEN
    n_title := 'La pharmacie a mis à jour votre demande validée';
    n_body :=
      'Pharmacie : ' || coalesce(p_pharma_nom, '—')
      || ' · ' || coalesce(p_pharma_ville, '—')
      || E'\nDossier : ' || p_nature
      || E'\nMis à jour le : ' || p_when_fr
      || E'\n\n'
      || E'L''officine a modifié le suivi (disponibilité, réservation, commande, etc.). Ouvrez la demande pour le détail.';
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_history_reason IS NOT NULL AND p_history_reason LIKE 'post_confirm_product_arrived|%' THEN
    v_item_id := nullif(split_part(p_history_reason, '|', 2), '')::uuid;
    SELECT coalesce(nullif(btrim(pr.name), ''), 'Produit')
    INTO v_product_name
    FROM public.request_items ri
    LEFT JOIN public.products pr ON pr.id = ri.product_id
    WHERE ri.id = v_item_id;

    n_title := 'Produit reçu en pharmacie';
    n_body :=
      'Pharmacie : ' || coalesce(p_pharma_nom, '—')
      || ' · ' || coalesce(p_pharma_ville, '—')
      || E'\nDossier : ' || p_nature
      || E'\nMis à jour le : ' || p_when_fr
      || E'\n\n'
      || coalesce(v_product_name, 'Produit')
      || E' (commandé) est arrivé en officine. Ouvrez la demande pour le suivi.';
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_history_reason IS NOT NULL AND p_history_reason LIKE 'post_confirm_arrival_cancelled|%' THEN
    v_item_id := nullif(split_part(p_history_reason, '|', 2), '')::uuid;
    SELECT coalesce(nullif(btrim(pr.name), ''), 'Produit')
    INTO v_product_name
    FROM public.request_items ri
    LEFT JOIN public.products pr ON pr.id = ri.product_id
    WHERE ri.id = v_item_id;

    n_title := 'Réception en pharmacie annulée';
    n_body :=
      'Pharmacie : ' || coalesce(p_pharma_nom, '—')
      || ' · ' || coalesce(p_pharma_ville, '—')
      || E'\nDossier : ' || p_nature
      || E'\nMis à jour le : ' || p_when_fr
      || E'\n\n'
      || E'L''officine a annulé la confirmation de réception pour '
      || coalesce(v_product_name, 'un produit commandé')
      || E'. Consultez le suivi dans la demande.';
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_status = 'responded'::public.request_status_enum
     AND p_history_reason IS NOT NULL
     AND p_history_reason = 'pharmacist_response_updated' THEN
    n_title := 'La pharmacie a mis à jour sa réponse';
    n_body :=
      'Pharmacie : ' || coalesce(p_pharma_nom, '—')
      || ' · ' || coalesce(p_pharma_ville, '—')
      || E'\nDossier : ' || p_nature
      || E'\nMis à jour le : ' || p_when_fr
      || E'\n\n'
      || E'Ouvrez la demande pour voir ce qui a changé et ajuster votre choix si besoin.';
    RETURN NEXT;
    RETURN;
  END IF;

  n_title :=
    CASE p_status
      WHEN 'in_review' THEN 'Votre demande est en cours de traitement'
      WHEN 'responded' THEN 'La pharmacie vous a répondu'
      WHEN 'treated' THEN 'Votre demande est traitée par la pharmacie'
      WHEN 'completed' THEN 'Votre demande est clôturée'
      WHEN 'cancelled' THEN 'Votre demande a été annulée'
      WHEN 'abandoned' THEN 'Votre demande a été abandonnée'
      WHEN 'expired' THEN 'Votre demande a expiré'
      ELSE 'Mise à jour de votre demande'
    END;

  v_motif := NULL;
  IF p_history_reason IS NOT NULL AND p_history_reason LIKE 'pharmacist_cancel|%' THEN
    v_motif := substring(p_history_reason FROM char_length('pharmacist_cancel|') + 1);
  END IF;

  n_body :=
    'Pharmacie : ' || coalesce(p_pharma_nom, '—')
    || ' · ' || coalesce(p_pharma_ville, '—')
    || E'\nDossier : ' || p_nature
    || E'\nMis à jour le : ' || p_when_fr
    || E'\n\n'
    || CASE p_status
      WHEN 'in_review' THEN
        E'L''officine traite votre dossier. Vous recevrez une notification dès qu''une réponse sera disponible.'
      WHEN 'responded' THEN
        E'Ouvrez la demande pour valider la proposition ou demander une modification avant expiration.'
      WHEN 'treated' THEN
        E'La pharmacie a déclaré votre demande traitée. Ouvrez le dossier : suivi des lignes (réservation, commande, passage au comptoir) — tous les produits ne sont pas forcément déjà en officine.'
      WHEN 'completed' THEN
        E'Merci d''avoir utilisé ProxiPharma. Conservez ce dossier pour votre suivi si besoin.'
      WHEN 'cancelled' THEN
        CASE
          WHEN v_motif IS NOT NULL AND btrim(v_motif) <> '' THEN
            E'La pharmacie a annulé cette demande.' || E'\n\nPrécision : ' || btrim(v_motif)
          ELSE
            E'La demande ne sera plus suivie.'
        END
      WHEN 'abandoned' THEN
        E'Ce dossier est fermé. Pour la suite, rapprochez-vous directement de votre pharmacie si besoin.'
      WHEN 'expired' THEN
        E'Le délai de traitement est dépassé. Vous pouvez créer une nouvelle demande si nécessaire.'
      ELSE
        E'Consultez le détail de la demande pour plus d''informations.'
    END;

  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- Emit : notifs patient traitée + amendements ; pharmacien passage (sans « dossier prêt »)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._emit_in_app_notifications_for_status_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
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
  v_event_pat text;
BEGIN
  IF new.reason = 'patient_prescription_updated' THEN
    SELECT r.* INTO v_req FROM public.requests r WHERE r.id = new.request_id;
    IF NOT FOUND THEN RETURN new; END IF;

    SELECT ph.nom, ph.ville INTO v_pharma_nom, v_pharma_ville FROM public.pharmacies ph WHERE ph.id = v_req.pharmacy_id;
    SELECT coalesce(nullif(btrim(p.full_name::text), ''), 'Patient') INTO v_patient_nom FROM public.profiles p WHERE p.id = v_req.patient_id;
    v_nature := public._request_type_label_fr(v_req.request_type);
    v_when_fr := to_char(new.created_at AT TIME ZONE 'Africa/Casablanca', 'DD/MM/YYYY à HH24:MI');

    SELECT t.n_title, t.n_body INTO v_title_ph, v_body_ph
    FROM public._in_app_notification_pharmacist(
      new.new_status, new.old_status, v_pharma_nom, v_pharma_ville, v_patient_nom, v_nature, v_when_fr, new.reason
    ) AS t;

    INSERT INTO public.app_notifications (recipient_id, request_id, source_status_history_id, event_type, title, body)
    SELECT ps.user_id, new.request_id, new.id, 'request_status:patient_prescription_updated', v_title_ph, v_body_ph
    FROM public.pharmacy_staff ps
    JOIN public.profiles p ON p.id = ps.user_id
    WHERE ps.pharmacy_id = v_req.pharmacy_id AND p.role = 'pharmacien'
    ON CONFLICT (source_status_history_id, recipient_id) DO NOTHING;

    RETURN new;
  END IF;

  IF new.reason = 'patient_planned_visit_updated' THEN
    SELECT r.* INTO v_req FROM public.requests r WHERE r.id = new.request_id;
    IF NOT FOUND THEN RETURN new; END IF;

    SELECT ph.nom, ph.ville INTO v_pharma_nom, v_pharma_ville FROM public.pharmacies ph WHERE ph.id = v_req.pharmacy_id;
    SELECT coalesce(nullif(btrim(p.full_name::text), ''), 'Patient') INTO v_patient_nom FROM public.profiles p WHERE p.id = v_req.patient_id;
    v_nature := public._request_type_label_fr(v_req.request_type);
    v_when_fr := to_char(new.created_at AT TIME ZONE 'Africa/Casablanca', 'DD/MM/YYYY à HH24:MI');

    SELECT t.n_title, t.n_body INTO v_title_pat, v_body_pat
    FROM public._in_app_notification_patient(new.new_status, v_pharma_nom, v_pharma_ville, v_nature, v_when_fr, new.reason) AS t;

    INSERT INTO public.app_notifications (recipient_id, request_id, source_status_history_id, event_type, title, body)
    VALUES (v_req.patient_id, new.request_id, new.id, 'request_event:patient_planned_visit_updated', v_title_pat, v_body_pat)
    ON CONFLICT (source_status_history_id, recipient_id) DO NOTHING;

    SELECT t.n_title, t.n_body INTO v_title_ph, v_body_ph
    FROM public._in_app_notification_pharmacist(
      new.new_status, new.old_status, v_pharma_nom, v_pharma_ville, v_patient_nom, v_nature, v_when_fr, new.reason
    ) AS t;

    INSERT INTO public.app_notifications (recipient_id, request_id, source_status_history_id, event_type, title, body)
    SELECT ps.user_id, new.request_id, new.id, 'request_event:patient_planned_visit_updated', v_title_ph, v_body_ph
    FROM public.pharmacy_staff ps
    JOIN public.profiles p ON p.id = ps.user_id
    WHERE ps.pharmacy_id = v_req.pharmacy_id AND p.role = 'pharmacien'
      AND (new.changed_by IS NULL OR ps.user_id IS DISTINCT FROM new.changed_by)
    ON CONFLICT (source_status_history_id, recipient_id) DO NOTHING;

    RETURN new;
  END IF;

  IF new.new_status NOT IN (
    'submitted', 'in_review', 'responded', 'confirmed', 'completed',
    'cancelled', 'abandoned', 'expired', 'treated'
  ) THEN
    RETURN new;
  END IF;

  IF new.reason = 'counter_outcome:picked_up' THEN
    RETURN new;
  END IF;

  SELECT r.* INTO v_req FROM public.requests r WHERE r.id = new.request_id;
  IF NOT FOUND THEN RETURN new; END IF;

  SELECT ph.nom, ph.ville INTO v_pharma_nom, v_pharma_ville FROM public.pharmacies ph WHERE ph.id = v_req.pharmacy_id;
  SELECT coalesce(nullif(btrim(p.full_name::text), ''), 'Patient') INTO v_patient_nom FROM public.profiles p WHERE p.id = v_req.patient_id;
  v_nature := public._request_type_label_fr(v_req.request_type);
  v_when_fr := to_char(new.created_at AT TIME ZONE 'Africa/Casablanca', 'DD/MM/YYYY à HH24:MI');

  IF new.new_status IN ('in_review', 'responded', 'completed', 'cancelled', 'abandoned', 'expired', 'treated')
     OR new.reason = 'patient_planned_visit_updated'
     OR (new.reason IS NOT NULL AND (
       new.reason LIKE 'pharmacist_supply_amendments_saved|%'
       OR new.reason LIKE 'post_confirm_product_arrived|%'
       OR new.reason LIKE 'post_confirm_arrival_cancelled|%'
     ))
  THEN
    SELECT t.n_title, t.n_body INTO v_title_pat, v_body_pat
    FROM public._in_app_notification_patient(new.new_status, v_pharma_nom, v_pharma_ville, v_nature, v_when_fr, new.reason) AS t;

    v_event_pat := CASE
      WHEN new.reason = 'patient_planned_visit_updated' THEN 'request_event:patient_planned_visit_updated'
      WHEN new.reason LIKE 'pharmacist_supply_amendments_saved|%' THEN 'request_event:pharmacist_supply_amendments_saved'
      WHEN new.reason LIKE 'post_confirm_product_arrived|%' THEN 'request_event:post_confirm_product_arrived'
      WHEN new.reason LIKE 'post_confirm_arrival_cancelled|%' THEN 'request_event:post_confirm_arrival_cancelled'
      ELSE 'request_status:' || new.new_status::text
    END;

    INSERT INTO public.app_notifications (recipient_id, request_id, source_status_history_id, event_type, title, body)
    VALUES (v_req.patient_id, new.request_id, new.id, v_event_pat, v_title_pat, v_body_pat)
    ON CONFLICT (source_status_history_id, recipient_id) DO NOTHING;
  END IF;

  IF new.new_status IN ('submitted', 'confirmed', 'treated', 'abandoned', 'cancelled', 'expired')
     AND coalesce(new.reason, '') IS DISTINCT FROM 'patient_planned_visit_updated'
     AND coalesce(new.reason, '') NOT LIKE 'pharmacist_supply_amendments_saved|%'
     AND coalesce(new.reason, '') NOT LIKE 'post_confirm_product_arrived|%'
     AND coalesce(new.reason, '') NOT LIKE 'post_confirm_arrival_cancelled|%'
  THEN
    SELECT t.n_title, t.n_body INTO v_title_ph, v_body_ph
    FROM public._in_app_notification_pharmacist(
      new.new_status, new.old_status, v_pharma_nom, v_pharma_ville, v_patient_nom, v_nature, v_when_fr, new.reason
    ) AS t;

    INSERT INTO public.app_notifications (recipient_id, request_id, source_status_history_id, event_type, title, body)
    SELECT ps.user_id, new.request_id, new.id, 'request_status:' || new.new_status::text, v_title_ph, v_body_ph
    FROM public.pharmacy_staff ps
    JOIN public.profiles p ON p.id = ps.user_id
    WHERE ps.pharmacy_id = v_req.pharmacy_id AND p.role = 'pharmacien'
      AND (new.changed_by IS NULL OR ps.user_id IS DISTINCT FROM new.changed_by)
    ON CONFLICT (source_status_history_id, recipient_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$;

-- ---------------------------------------------------------------------------
-- Amendements post-validation → journal + notif patient
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pharmacist_record_supply_amendments(
  p_request_id uuid,
  p_amendments jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old public.request_status_enum;
  v_pharmacy uuid;
  v_type public.request_type_enum;
  elem jsonb;
  v_ch text;
  v_n int;
  i int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_amendments IS NULL OR jsonb_typeof(p_amendments) <> 'array' OR jsonb_array_length(p_amendments) < 1 THEN
    RAISE EXCEPTION 'Liste d''entrées vide ou invalide.';
  END IF;

  SELECT status, pharmacy_id, request_type
  INTO v_old, v_pharmacy, v_type
  FROM public.requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_type <> 'product_request' THEN
    RAISE EXCEPTION 'Only product_request';
  END IF;

  IF v_old NOT IN ('confirmed'::public.request_status_enum, 'treated'::public.request_status_enum) THEN
    RAISE EXCEPTION 'Amendements autorisés seulement en confirmed ou treated (statut courant %).', v_old;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.pharmacy_staff ps
    JOIN public.profiles p ON p.id = ps.user_id
    WHERE ps.pharmacy_id = v_pharmacy AND ps.user_id = v_uid AND p.role = 'pharmacien'
  ) THEN
    RAISE EXCEPTION 'Accès pharmacien requis';
  END IF;

  v_n := jsonb_array_length(p_amendments);
  FOR i IN 0..(v_n - 1) LOOP
    elem := p_amendments -> i;
    v_ch := nullif(trim(coalesce(elem->>'client_confirmation_channel', '')), '');
    IF v_ch IS NULL OR length(v_ch) < 2 THEN
      RAISE EXCEPTION 'Canal client obligatoire sur chaque entrée (entrée %).', i + 1;
    END IF;
    IF length(v_ch) > 80 THEN
      RAISE EXCEPTION 'Canal client trop long (80 car max).';
    END IF;
  END LOOP;

  INSERT INTO public.request_supply_amendments (request_id, created_by, amendments)
  VALUES (p_request_id, v_uid, p_amendments);

  PERFORM public._log_request_status_change(
    p_request_id,
    v_old,
    v_old,
    v_uid,
    'pharmacist_supply_amendments_saved|' || p_request_id::text
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Réception en officine (arrived_reserved) → notif patient ; annulation → notif
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pharmacist_set_post_confirm_fulfillment(
  p_request_item_id uuid,
  p_fulfillment public.post_confirm_fulfillment_enum
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req_id uuid;
  v_status public.request_status_enum;
  v_pharmacy uuid;
  v_selected boolean;
  v_chosen_alt uuid;
  v_eff public.availability_status_enum;
  v_exp date;
  v_cur public.post_confirm_fulfillment_enum;
  v_uid uuid := auth.uid();
  v_reason text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT
    ri.request_id,
    ri.is_selected_by_patient,
    ri.patient_chosen_alternative_id,
    coalesce(ria.availability_status, ri.availability_status) AS eff_av,
    CASE
      WHEN ri.patient_chosen_alternative_id IS NOT NULL THEN ria.expected_availability_date
      ELSE ri.expected_availability_date
    END AS eff_exp,
    ri.post_confirm_fulfillment
  INTO v_req_id, v_selected, v_chosen_alt, v_eff, v_exp, v_cur
  FROM public.request_items ri
  LEFT JOIN public.request_item_alternatives ria
    ON ria.id = ri.patient_chosen_alternative_id AND ria.request_item_id = ri.id
  WHERE ri.id = p_request_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ligne introuvable';
  END IF;

  IF NOT coalesce(v_selected, false) THEN
    RAISE EXCEPTION 'Ligne non retenue par le patient';
  END IF;

  SELECT r.status, r.pharmacy_id INTO v_status, v_pharmacy
  FROM public.requests r WHERE r.id = v_req_id;

  IF v_status NOT IN ('confirmed'::public.request_status_enum, 'treated'::public.request_status_enum) THEN
    RAISE EXCEPTION 'Statut demande incompatible';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.pharmacy_staff ps
    JOIN public.profiles p ON p.id = ps.user_id
    WHERE ps.pharmacy_id = v_pharmacy AND ps.user_id = v_uid AND p.role = 'pharmacien'
  ) THEN
    RAISE EXCEPTION 'Accès pharmacien requis';
  END IF;

  IF p_fulfillment = 'reserved'::public.post_confirm_fulfillment_enum THEN
    IF v_eff IS NULL OR v_eff NOT IN ('available'::public.availability_status_enum, 'partially_available'::public.availability_status_enum) THEN
      RAISE EXCEPTION '« Réservé » uniquement pour une ligne disponible ou partiellement disponible sur la branche choisie.';
    END IF;
  ELSIF p_fulfillment = 'ordered'::public.post_confirm_fulfillment_enum THEN
    IF v_eff IS DISTINCT FROM 'to_order'::public.availability_status_enum THEN
      RAISE EXCEPTION '« Commandé » uniquement pour une ligne « à commander » sur la branche choisie.';
    END IF;
    IF v_exp IS NULL THEN
      RAISE EXCEPTION 'Date de réception prévue obligatoire pour une ligne à commander.';
    END IF;
  ELSIF p_fulfillment = 'arrived_reserved'::public.post_confirm_fulfillment_enum THEN
    IF v_eff IS DISTINCT FROM 'to_order'::public.availability_status_enum THEN
      RAISE EXCEPTION '« Arrivé en officine » uniquement pour une ligne à commander.';
    END IF;
    IF v_cur IS DISTINCT FROM 'ordered'::public.post_confirm_fulfillment_enum THEN
      RAISE EXCEPTION 'Indiquez d''abord « Commandé », puis « Arrivé · prêt au comptoir ».';
    END IF;
  END IF;

  UPDATE public.request_items
  SET post_confirm_fulfillment = p_fulfillment, updated_at = now()
  WHERE id = p_request_item_id;

  IF p_fulfillment = 'arrived_reserved'::public.post_confirm_fulfillment_enum
     AND v_cur IS DISTINCT FROM 'arrived_reserved'::public.post_confirm_fulfillment_enum
  THEN
    v_reason := 'post_confirm_product_arrived|' || p_request_item_id::text;
    PERFORM public._log_request_status_change(v_req_id, v_status, v_status, v_uid, v_reason);
  ELSIF v_cur = 'arrived_reserved'::public.post_confirm_fulfillment_enum
     AND p_fulfillment = 'ordered'::public.post_confirm_fulfillment_enum
  THEN
    v_reason := 'post_confirm_arrival_cancelled|' || p_request_item_id::text;
    PERFORM public._log_request_status_change(v_req_id, v_status, v_status, v_uid, v_reason);
  END IF;
END;
$$;
