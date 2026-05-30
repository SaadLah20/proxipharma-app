-- Notifications : corrections (rupture marché), rappel validation, libellés pro, promos multi-staff,
-- canaux externes élargis (e-mail + SMS patient), rappel avant expiration.

-- Realtime cloche header (Supabase)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.app_notifications;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.promo_in_app_notifications;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Libellés patient (copie professionnelle + rappel expiration)
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
  v_item_id uuid;
  v_product_id uuid;
  v_request_id uuid;
  v_product_name text;
  v_had_alternative boolean;
BEGIN
  IF p_history_reason = 'patient_planned_visit_updated' THEN
    n_title := 'Passage en pharmacie mis à jour';
    n_body :=
      coalesce(p_pharma_nom, 'Votre pharmacie')
      || ' — votre date de passage a été modifiée.'
      || E'\n'
      || p_when_fr;
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_history_reason = 'responded_expiry_reminder' THEN
    n_title := 'Rappel — validation en attente';
    n_body :=
      'Il reste peu de temps pour valider la réponse de '
      || coalesce(p_pharma_nom, 'votre pharmacie')
      || ' sur votre '
      || lower(coalesce(p_nature, 'demande'))
      || '. Ouvrez le dossier pour confirmer votre choix.'
      || E'\n'
      || p_when_fr;
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_history_reason IS NOT NULL AND (
    p_history_reason LIKE 'pharmacist_supply_amendments_saved|%'
    OR p_history_reason = 'pharmacist_adjustments_after_confirmation'
    OR p_history_reason LIKE 'audit_v1:%'
  ) THEN
    n_title := 'Mise à jour après validation';
    n_body :=
      coalesce(p_pharma_nom, 'Votre pharmacie')
      || ' a modifié des éléments de votre '
      || lower(coalesce(p_nature, 'demande'))
      || ' validée. Consultez le détail sur le dossier.'
      || E'\n'
      || p_when_fr;
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

    n_title := 'Produit reçu en officine';
    n_body :=
      coalesce(v_product_name, 'Un produit commandé')
      || ' est arrivé chez '
      || coalesce(p_pharma_nom, 'votre pharmacie')
      || '. Vous pouvez passer le retirer selon votre date de passage.'
      || E'\n'
      || p_when_fr;
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

    n_title := 'Réception annulée en officine';
    n_body :=
      coalesce(p_pharma_nom, 'Votre pharmacie')
      || ' a annulé la confirmation de réception pour '
      || coalesce(v_product_name, 'un produit')
      || '. Consultez le dossier pour le suivi.'
      || E'\n'
      || p_when_fr;
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_history_reason IS NOT NULL AND p_history_reason LIKE 'market_shortage_product_available|%' THEN
    v_product_id := nullif(split_part(p_history_reason, '|', 2), '')::uuid;
    v_request_id := nullif(split_part(p_history_reason, '|', 3), '')::uuid;
    SELECT coalesce(nullif(btrim(pr.name), ''), 'Produit')
    INTO v_product_name
    FROM public.products pr
    WHERE pr.id = v_product_id;

    v_had_alternative := false;
    IF v_request_id IS NOT NULL AND v_product_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.request_items ri
        WHERE ri.request_id = v_request_id
          AND ri.product_id = v_product_id
          AND ri.patient_chosen_alternative_id IS NOT NULL
      ) INTO v_had_alternative;
    END IF;

    n_title := 'Produit de nouveau disponible';
    n_body :=
      coalesce(v_product_name, 'Un produit')
      || ' signalé en rupture est de nouveau disponible chez '
      || coalesce(p_pharma_nom, 'votre pharmacie')
      || '.';
    IF v_had_alternative THEN
      n_body :=
        n_body
        || E'\n\nVous aviez validé une alternative : rouvrez le dossier si vous souhaitez ce produit.';
    END IF;
    n_body := n_body || E'\n' || p_when_fr;
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_status = 'responded'::public.request_status_enum
     AND p_history_reason IS NOT NULL
     AND p_history_reason = 'pharmacist_response_updated' THEN
    n_title := 'Réponse mise à jour';
    n_body :=
      coalesce(p_pharma_nom, 'Votre pharmacie')
      || ' a actualisé sa réponse sur votre '
      || lower(coalesce(p_nature, 'demande'))
      || '. Consultez les changements avant validation.'
      || E'\n'
      || p_when_fr;
    RETURN NEXT;
    RETURN;
  END IF;

  n_title :=
    CASE p_status
      WHEN 'responded' THEN 'Réponse de la pharmacie'
      WHEN 'treated' THEN 'Préparation terminée'
      WHEN 'completed' THEN 'Dossier clôturé'
      WHEN 'cancelled' THEN 'Demande annulée'
      WHEN 'abandoned' THEN 'Demande abandonnée'
      WHEN 'expired' THEN 'Demande expirée'
      ELSE 'Mise à jour'
    END;

  n_body :=
    CASE p_status
      WHEN 'responded' THEN
        coalesce(p_pharma_nom, 'Votre pharmacie')
        || ' a répondu à votre '
        || lower(coalesce(p_nature, 'demande'))
        || '. Validez votre choix sous 24 h.'
        || E'\n'
        || p_when_fr
      WHEN 'treated' THEN
        coalesce(p_pharma_nom, 'Votre pharmacie')
        || ' a terminé la préparation. Consultez le détail de chaque produit avant votre passage.'
        || E'\n'
        || p_when_fr
      WHEN 'completed' THEN
        'Votre '
        || lower(coalesce(p_nature, 'demande'))
        || ' est clôturée chez '
        || coalesce(p_pharma_nom, 'votre pharmacie')
        || '.'
        || E'\n'
        || p_when_fr
      WHEN 'cancelled' THEN
        'Votre '
        || lower(coalesce(p_nature, 'demande'))
        || ' a été annulée.'
        || E'\n'
        || p_when_fr
      WHEN 'abandoned' THEN
        'Votre '
        || lower(coalesce(p_nature, 'demande'))
        || ' a été abandonnée.'
        || E'\n'
        || p_when_fr
      WHEN 'expired' THEN
        'Le délai de validation est dépassé pour votre '
        || lower(coalesce(p_nature, 'demande'))
        || '. Vous pouvez renvoyer une nouvelle demande.'
        || E'\n'
        || p_when_fr
      ELSE
        coalesce(p_pharma_nom, 'Pharmacie') || E'\n' || coalesce(p_nature, 'demande') || E'\n' || p_when_fr
    END;

  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- Libellés pharmacien (+ traitée / clôturée)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._in_app_notification_pharmacist(
  p_status public.request_status_enum,
  p_old_status public.request_status_enum,
  p_pharma_nom text,
  p_pharma_ville text,
  p_patient_nom text,
  p_nature text,
  p_when_fr text,
  p_history_reason text DEFAULT NULL
)
RETURNS TABLE (n_title text, n_body text)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_is_update_submitted boolean := false;
BEGIN
  IF p_history_reason = 'patient_prescription_updated' THEN
    n_title := 'Ordonnance mise à jour';
    n_body :=
      coalesce(p_patient_nom, 'Un patient')
      || ' a modifié le scan ou une précision sur son '
      || lower(coalesce(p_nature, 'ordonnance'))
      || '.'
      || E'\n'
      || p_when_fr;
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_history_reason = 'patient_planned_visit_updated' THEN
    n_title := 'Passage patient modifié';
    n_body :=
      coalesce(p_patient_nom, 'Un patient')
      || ' a modifié sa date de passage sur sa '
      || lower(coalesce(p_nature, 'demande'))
      || '.'
      || E'\n'
      || p_when_fr;
    RETURN NEXT;
    RETURN;
  END IF;

  v_is_update_submitted :=
    p_status = 'submitted'
    AND p_old_status IS NOT NULL
    AND p_old_status <> 'draft';

  n_title :=
    CASE p_status
      WHEN 'submitted' THEN
        CASE WHEN v_is_update_submitted THEN 'Demande mise à jour' ELSE 'Nouvelle demande' END
      WHEN 'confirmed' THEN 'Demande validée par le patient'
      WHEN 'treated' THEN 'Demande marquée traitée'
      WHEN 'completed' THEN 'Dossier clôturé au comptoir'
      WHEN 'cancelled' THEN 'Demande annulée'
      WHEN 'abandoned' THEN 'Demande abandonnée'
      WHEN 'expired' THEN 'Demande expirée'
      ELSE 'Mise à jour dossier'
    END;

  n_body :=
    CASE p_status
      WHEN 'submitted' THEN
        CASE
          WHEN v_is_update_submitted THEN
            coalesce(p_patient_nom, 'Un patient')
            || ' a renvoyé ou modifié sa '
            || lower(coalesce(p_nature, 'demande'))
            || '.'
          ELSE
            coalesce(p_patient_nom, 'Un patient')
            || ' — '
            || coalesce(p_nature, 'Demande')
            || ' à traiter.'
        END
      WHEN 'confirmed' THEN
        coalesce(p_patient_nom, 'Un patient')
        || ' a validé sa '
        || lower(coalesce(p_nature, 'demande'))
        || '. Préparez les produits retenus.'
      WHEN 'treated' THEN
        'La '
        || lower(coalesce(p_nature, 'demande'))
        || ' de '
        || coalesce(p_patient_nom, 'un patient')
        || ' est prête pour le comptoir.'
      WHEN 'completed' THEN
        'Le dossier '
        || lower(coalesce(p_nature, 'demande'))
        || ' de '
        || coalesce(p_patient_nom, 'un patient')
        || ' a été clôturé après passage.'
      WHEN 'cancelled' THEN
        'Une '
        || lower(coalesce(p_nature, 'demande'))
        || ' a été annulée.'
      WHEN 'abandoned' THEN
        'Une '
        || lower(coalesce(p_nature, 'demande'))
        || ' a été abandonnée.'
      WHEN 'expired' THEN
        'Une '
        || lower(coalesce(p_nature, 'demande'))
        || ' a expiré faute de validation patient.'
      ELSE
        coalesce(p_patient_nom, '—') || ' — ' || coalesce(p_nature, 'demande')
    END
    || E'\n'
    || p_when_fr;

  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- Émission in-app (fix rupture marché + rappel + clôture pharmacien)
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
  v_dossier_ref text;
  v_title_pat text;
  v_body_pat text;
  v_title_ph text;
  v_body_ph text;
  v_event_pat text;
  v_patient_supply_update boolean;
BEGIN
  IF new.reason = 'counter_outcome:picked_up' THEN
    RETURN new;
  END IF;

  SELECT r.* INTO v_req FROM public.requests r WHERE r.id = new.request_id;
  IF NOT FOUND THEN RETURN new; END IF;

  SELECT ph.nom, ph.ville INTO v_pharma_nom, v_pharma_ville FROM public.pharmacies ph WHERE ph.id = v_req.pharmacy_id;
  SELECT coalesce(nullif(btrim(p.full_name::text), ''), 'Patient') INTO v_patient_nom FROM public.profiles p WHERE p.id = v_req.patient_id;
  v_nature := public._request_type_label_fr(v_req.request_type);
  v_when_fr := to_char(new.created_at AT TIME ZONE 'Africa/Casablanca', 'DD/MM/YYYY à HH24:MI');
  v_dossier_ref := nullif(btrim(v_req.request_public_ref), '');

  v_patient_supply_update :=
    new.reason IS NOT NULL
    AND (
      new.reason LIKE 'pharmacist_supply_amendments_saved|%'
      OR new.reason = 'pharmacist_adjustments_after_confirmation'
      OR new.reason LIKE 'audit_v1:%'
    );

  IF new.reason = 'patient_planned_visit_updated' THEN
    SELECT t.n_title, t.n_body INTO v_title_pat, v_body_pat
    FROM public._in_app_notification_patient(new.new_status, v_pharma_nom, v_pharma_ville, v_nature, v_when_fr, new.reason) AS t;
    IF v_dossier_ref IS NOT NULL THEN
      v_body_pat := v_body_pat || E'\nRéf. dossier ' || v_dossier_ref;
    END IF;
    INSERT INTO public.app_notifications (recipient_id, request_id, source_status_history_id, event_type, title, body)
    VALUES (v_req.patient_id, new.request_id, new.id, 'request_event:patient_planned_visit_updated', v_title_pat, v_body_pat)
    ON CONFLICT (source_status_history_id, recipient_id) DO NOTHING;

    SELECT t.n_title, t.n_body INTO v_title_ph, v_body_ph
    FROM public._in_app_notification_pharmacist(
      new.new_status, new.old_status, v_pharma_nom, v_pharma_ville, v_patient_nom, v_nature, v_when_fr, new.reason
    ) AS t;
    IF v_dossier_ref IS NOT NULL THEN
      v_body_ph := v_body_ph || E'\nRéf. dossier ' || v_dossier_ref;
    END IF;
    INSERT INTO public.app_notifications (recipient_id, request_id, source_status_history_id, event_type, title, body)
    SELECT ps.user_id, new.request_id, new.id, 'request_event:patient_planned_visit_updated', v_title_ph, v_body_ph
    FROM public.pharmacy_staff ps
    JOIN public.profiles p ON p.id = ps.user_id
    WHERE ps.pharmacy_id = v_req.pharmacy_id AND p.role = 'pharmacien'
      AND (new.changed_by IS NULL OR ps.user_id IS DISTINCT FROM new.changed_by)
    ON CONFLICT (source_status_history_id, recipient_id) DO NOTHING;
    RETURN new;
  END IF;

  IF new.reason = 'patient_prescription_updated' THEN
    SELECT t.n_title, t.n_body INTO v_title_ph, v_body_ph
    FROM public._in_app_notification_pharmacist(
      new.new_status, new.old_status, v_pharma_nom, v_pharma_ville, v_patient_nom, v_nature, v_when_fr, new.reason
    ) AS t;
    IF v_dossier_ref IS NOT NULL THEN
      v_body_ph := v_body_ph || E'\nRéf. dossier ' || v_dossier_ref;
    END IF;
    INSERT INTO public.app_notifications (recipient_id, request_id, source_status_history_id, event_type, title, body)
    SELECT ps.user_id, new.request_id, new.id, 'request_status:patient_prescription_updated', v_title_ph, v_body_ph
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

  IF (
       (new.new_status IN ('responded', 'treated', 'completed', 'cancelled', 'abandoned', 'expired')
         AND new.new_status IS DISTINCT FROM new.old_status)
       OR new.reason = 'pharmacist_response_updated'
       OR new.reason = 'responded_expiry_reminder'
       OR (new.reason IS NOT NULL AND (
         new.reason LIKE 'post_confirm_product_arrived|%'
         OR new.reason LIKE 'post_confirm_arrival_cancelled|%'
         OR new.reason LIKE 'market_shortage_product_available|%'
       ))
       OR v_patient_supply_update
     )
  THEN
    SELECT t.n_title, t.n_body INTO v_title_pat, v_body_pat
    FROM public._in_app_notification_patient(new.new_status, v_pharma_nom, v_pharma_ville, v_nature, v_when_fr, new.reason) AS t;

    v_event_pat := CASE
      WHEN new.reason = 'pharmacist_response_updated' THEN 'request_event:pharmacist_response_updated'
      WHEN new.reason = 'responded_expiry_reminder' THEN 'request_event:responded_expiry_reminder'
      WHEN new.reason LIKE 'post_confirm_product_arrived|%' THEN 'request_event:post_confirm_product_arrived'
      WHEN new.reason LIKE 'post_confirm_arrival_cancelled|%' THEN 'request_event:post_confirm_arrival_cancelled'
      WHEN new.reason LIKE 'market_shortage_product_available|%' THEN 'request_event:market_shortage_product_available'
      WHEN new.reason LIKE 'pharmacist_supply_amendments_saved|%' THEN 'request_event:pharmacist_supply_amendments_saved'
      WHEN v_patient_supply_update THEN 'request_event:pharmacist_validated_request_updated'
      ELSE 'request_status:' || new.new_status::text
    END;

    IF v_dossier_ref IS NOT NULL THEN
      v_body_pat := v_body_pat || E'\nRéf. dossier ' || v_dossier_ref;
    END IF;

    INSERT INTO public.app_notifications (recipient_id, request_id, source_status_history_id, event_type, title, body)
    VALUES (v_req.patient_id, new.request_id, new.id, v_event_pat, v_title_pat, v_body_pat)
    ON CONFLICT (source_status_history_id, recipient_id) DO NOTHING;
  END IF;

  IF new.new_status IN ('submitted', 'confirmed', 'treated', 'completed', 'abandoned', 'cancelled', 'expired')
     AND new.new_status IS DISTINCT FROM new.old_status
     AND coalesce(new.reason, '') IS DISTINCT FROM 'patient_planned_visit_updated'
     AND coalesce(new.reason, '') NOT LIKE 'post_confirm_product_arrived|%'
     AND coalesce(new.reason, '') NOT LIKE 'post_confirm_arrival_cancelled|%'
     AND coalesce(new.reason, '') NOT LIKE 'market_shortage_product_available|%'
     AND coalesce(new.reason, '') IS DISTINCT FROM 'pharmacist_response_updated'
     AND coalesce(new.reason, '') IS DISTINCT FROM 'responded_expiry_reminder'
     AND NOT v_patient_supply_update
  THEN
    SELECT t.n_title, t.n_body INTO v_title_ph, v_body_ph
    FROM public._in_app_notification_pharmacist(
      new.new_status, new.old_status, v_pharma_nom, v_pharma_ville, v_patient_nom, v_nature, v_when_fr, new.reason
    ) AS t;

    IF v_dossier_ref IS NOT NULL THEN
      v_body_ph := v_body_ph || E'\nRéf. dossier ' || v_dossier_ref;
    END IF;

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
-- Rappel patient avant expiration (4 h avant la fin du délai responded)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remind_unvalidated_responded_requests(
  p_responded_silence interval DEFAULT interval '24 hours',
  p_reminder_before interval DEFAULT interval '4 hours'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_silence interval;
  v_remind_after interval;
  v_count int := 0;
  r record;
BEGIN
  v_silence := coalesce(nullif(p_responded_silence, interval '0'), interval '24 hours');
  v_remind_after := v_silence - coalesce(nullif(p_reminder_before, interval '0'), interval '4 hours');
  IF v_remind_after <= interval '0' THEN
    v_remind_after := v_silence * 0.5;
  END IF;

  FOR r IN
    SELECT id, status
    FROM public.requests
    WHERE status = 'responded'::public.request_status_enum
      AND responded_at IS NOT NULL
      AND responded_at <= (now() - v_remind_after)
      AND responded_at > (now() - v_silence)
      AND NOT EXISTS (
        SELECT 1
        FROM public.request_status_history h
        WHERE h.request_id = requests.id
          AND h.reason = 'responded_expiry_reminder'
      )
    FOR UPDATE
  LOOP
    PERFORM public._log_request_status_change(
      r.id,
      r.status,
      r.status,
      NULL,
      'responded_expiry_reminder'
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.remind_unvalidated_responded_requests(interval, interval) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remind_unvalidated_responded_requests(interval, interval) TO service_role;

COMMENT ON FUNCTION public.remind_unvalidated_responded_requests(interval, interval) IS
  'Cron service_role : rappel patient si responded non validé (défaut 4 h avant expiration 24 h).';

-- ---------------------------------------------------------------------------
-- Conversation : libellés + réf. dossier
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._emit_in_app_notifications_for_request_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.requests%rowtype;
  v_pharma_nom text;
  v_title text;
  v_body text;
  v_ref text;
  v_skip_submission_message boolean := false;
BEGIN
  IF tg_op <> 'INSERT' THEN
    RETURN new;
  END IF;

  IF new.is_internal IS TRUE OR new.deleted_at IS NOT NULL THEN
    RETURN new;
  END IF;

  IF new.author_role NOT IN ('patient', 'pharmacien') THEN
    RETURN new;
  END IF;

  SELECT * INTO v_req FROM public.requests r WHERE r.id = new.request_id;
  IF NOT FOUND THEN
    RETURN new;
  END IF;

  SELECT coalesce(nullif(btrim(ph.nom::text), ''), 'Pharmacie') INTO v_pharma_nom
  FROM public.pharmacies ph
  WHERE ph.id = v_req.pharmacy_id;

  v_ref := nullif(btrim(v_req.request_public_ref), '');

  IF new.author_role = 'patient' THEN
    SELECT (
      NOT EXISTS (
        SELECT 1
        FROM public.request_comments c
        WHERE c.request_id = new.request_id
          AND c.id IS DISTINCT FROM new.id
          AND c.author_role = 'patient'
          AND c.is_internal IS NOT TRUE
          AND c.deleted_at IS NULL
      )
      AND new.created_at <= v_req.created_at + interval '15 minutes'
    ) INTO v_skip_submission_message;

    IF v_skip_submission_message THEN
      RETURN new;
    END IF;

    v_title := 'Nouveau message patient';
    v_body := coalesce(v_pharma_nom, 'Officine') || ' — ' || left(btrim(new.comment_text), 360);
    IF v_ref IS NOT NULL THEN
      v_body := v_body || E'\nRéf. dossier ' || v_ref;
    END IF;

    INSERT INTO public.app_notifications (
      recipient_id, request_id, source_status_history_id, event_type, title, body
    )
    SELECT
      ps.user_id,
      new.request_id,
      NULL,
      'request_conversation:message',
      v_title,
      v_body
    FROM public.pharmacy_staff ps
    JOIN public.profiles p ON p.id = ps.user_id
    WHERE ps.pharmacy_id = v_req.pharmacy_id
      AND p.role = 'pharmacien'
      AND ps.user_id IS DISTINCT FROM new.author_id;
  ELSIF new.author_role = 'pharmacien' THEN
    v_title := 'Message de votre pharmacie';
    v_body := left(btrim(new.comment_text), 360);
    IF v_ref IS NOT NULL THEN
      v_body := v_body || E'\nRéf. dossier ' || v_ref;
    END IF;

    INSERT INTO public.app_notifications (
      recipient_id, request_id, source_status_history_id, event_type, title, body
    )
    VALUES (
      v_req.patient_id,
      new.request_id,
      NULL,
      'request_conversation:message',
      v_title,
      v_body
    );
  END IF;

  RETURN new;
END;
$$;

-- ---------------------------------------------------------------------------
-- Promo : notifier tous les pharmaciens de l'officine
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._promo_reservation_log_status(
  p_reservation_id uuid,
  p_old public.promo_reservation_status_enum,
  p_new public.promo_reservation_status_enum,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hist_id uuid;
  v_res public.pharmacy_promo_reservations%rowtype;
  v_pharmacy_name text;
  v_patient_name text;
  v_title text;
  v_body text;
BEGIN
  INSERT INTO public.pharmacy_promo_reservation_status_history (
    reservation_id, old_status, new_status, actor_id, note
  )
  VALUES (p_reservation_id, p_old, p_new, auth.uid(), nullif(btrim(p_note), ''))
  RETURNING id INTO v_hist_id;

  SELECT r.* INTO v_res FROM public.pharmacy_promo_reservations r WHERE r.id = p_reservation_id;
  SELECT ph.nom INTO v_pharmacy_name FROM public.pharmacies ph WHERE ph.id = v_res.pharmacy_id;
  SELECT coalesce(nullif(btrim(p.full_name), ''), 'Patient') INTO v_patient_name
  FROM public.profiles p WHERE p.id = v_res.patient_id;

  IF p_new = 'submitted' THEN
    v_title := 'Nouvelle réservation pack promo';
    v_body := v_patient_name || ' — ' || coalesce(v_res.public_ref, 'réf. pack');

    INSERT INTO public.promo_in_app_notifications (
      recipient_id, reservation_id, source_history_id, event_type, title, body
    )
    SELECT
      ps.user_id,
      p_reservation_id,
      v_hist_id,
      'promo_reservation:submitted',
      v_title,
      v_body
    FROM public.pharmacy_staff ps
    JOIN public.profiles p ON p.id = ps.user_id
    WHERE ps.pharmacy_id = v_res.pharmacy_id
      AND p.role = 'pharmacien'
      AND ps.user_id IS DISTINCT FROM auth.uid()
    ON CONFLICT (source_history_id, recipient_id) WHERE source_history_id IS NOT NULL DO NOTHING;

  ELSIF p_new IN ('confirmed', 'unavailable', 'collected') THEN
    v_title := CASE p_new
      WHEN 'confirmed' THEN 'Votre pack est confirmé'
      WHEN 'unavailable' THEN 'Pack non disponible'
      ELSE 'Pack récupéré'
    END;
    v_body := coalesce(v_pharmacy_name, 'Votre pharmacie') || ' — ' || coalesce(v_res.public_ref, '');
    IF p_new IN ('confirmed', 'unavailable') AND nullif(btrim(p_note), '') IS NOT NULL THEN
      v_body := v_body || '. ' || btrim(p_note);
    END IF;

    IF v_res.patient_id IS DISTINCT FROM auth.uid() THEN
      INSERT INTO public.promo_in_app_notifications (
        recipient_id, reservation_id, source_history_id, event_type, title, body
      )
      VALUES (
        v_res.patient_id,
        p_reservation_id,
        v_hist_id,
        'promo_reservation:' || p_new::text,
        v_title,
        v_body
      )
      ON CONFLICT (source_history_id, recipient_id) WHERE source_history_id IS NOT NULL DO NOTHING;
    END IF;

  ELSIF p_new = 'cancelled' THEN
    IF auth.uid() = v_res.patient_id THEN
      v_title := 'Réservation pack annulée';
      v_body := v_patient_name || ' a annulé ' || coalesce(v_res.public_ref, 'sa demande');

      INSERT INTO public.promo_in_app_notifications (
        recipient_id, reservation_id, source_history_id, event_type, title, body
      )
      SELECT
        ps.user_id,
        p_reservation_id,
        v_hist_id,
        'promo_reservation:cancelled',
        v_title,
        v_body
      FROM public.pharmacy_staff ps
      JOIN public.profiles p ON p.id = ps.user_id
      WHERE ps.pharmacy_id = v_res.pharmacy_id
        AND p.role = 'pharmacien'
        AND ps.user_id IS DISTINCT FROM auth.uid()
      ON CONFLICT (source_history_id, recipient_id) WHERE source_history_id IS NOT NULL DO NOTHING;
    ELSE
      v_title := 'Réservation annulée par l''officine';
      v_body := coalesce(v_pharmacy_name, 'L''officine') || ' a annulé ' || coalesce(v_res.public_ref, 'votre demande');
      IF nullif(btrim(p_note), '') IS NOT NULL THEN
        v_body := v_body || '. ' || btrim(p_note);
      END IF;

      IF v_res.patient_id IS DISTINCT FROM auth.uid() THEN
        INSERT INTO public.promo_in_app_notifications (
          recipient_id, reservation_id, source_history_id, event_type, title, body
        )
        VALUES (
          v_res.patient_id,
          p_reservation_id,
          v_hist_id,
          'promo_reservation:cancelled',
          v_title,
          v_body
        )
        ON CONFLICT (source_history_id, recipient_id) WHERE source_history_id IS NOT NULL DO NOTHING;
      END IF;
    END IF;
  END IF;

  RETURN v_hist_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Canaux externes : événements patient pertinents (e-mail + SMS)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._enqueue_external_notifications_from_app_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefs public.notification_external_prefs%rowtype;
  v_email text;
  v_wa text;
  v_phone text;
  v_is_patient boolean;
  v_sms_allowed boolean;
BEGIN
  IF new.event_type NOT IN (
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
    'request_event:responded_expiry_reminder'
  ) THEN
    RETURN new;
  END IF;

  SELECT p.email, p.whatsapp, (p.role = 'patient')
  INTO v_email, v_wa, v_is_patient
  FROM public.profiles p
  WHERE p.id = new.recipient_id;

  SELECT *
  INTO v_prefs
  FROM public.notification_external_prefs pref
  WHERE pref.user_id = new.recipient_id;

  IF NOT FOUND THEN
    RETURN new;
  END IF;

  v_email := nullif(trim(both from coalesce(v_email, '')), '');
  v_wa := nullif(trim(both from coalesce(v_wa, '')), '');
  v_phone := v_wa;

  v_sms_allowed := v_is_patient
    AND new.event_type IN (
      'request_status:responded',
      'request_status:treated',
      'request_status:expired',
      'request_event:post_confirm_product_arrived',
      'request_event:market_shortage_product_available',
      'request_event:responded_expiry_reminder'
    );

  IF v_prefs.email_enabled AND v_email IS NOT NULL THEN
    INSERT INTO public.notification_external_queue (
      recipient_id, request_id, app_notification_id, channel, event_type, title, body, destination_snapshot
    )
    VALUES (
      new.recipient_id, new.request_id, new.id, 'email'::public.notification_external_channel_enum,
      new.event_type, new.title, new.body, v_email
    )
    ON CONFLICT (app_notification_id, channel) DO NOTHING;
  END IF;

  IF v_prefs.sms_enabled AND v_phone IS NOT NULL AND v_sms_allowed THEN
    INSERT INTO public.notification_external_queue (
      recipient_id, request_id, app_notification_id, channel, event_type, title, body, destination_snapshot
    )
    VALUES (
      new.recipient_id, new.request_id, new.id, 'sms'::public.notification_external_channel_enum,
      new.event_type, new.title, new.body, v_phone
    )
    ON CONFLICT (app_notification_id, channel) DO NOTHING;
  END IF;

  IF v_prefs.whatsapp_enabled AND v_phone IS NOT NULL AND v_sms_allowed THEN
    INSERT INTO public.notification_external_queue (
      recipient_id, request_id, app_notification_id, channel, event_type, title, body, destination_snapshot
    )
    VALUES (
      new.recipient_id, new.request_id, new.id, 'whatsapp'::public.notification_external_channel_enum,
      new.event_type, new.title, new.body, v_phone
    )
    ON CONFLICT (app_notification_id, channel) DO NOTHING;
  END IF;

  RETURN new;
END;
$$;

COMMENT ON FUNCTION public._enqueue_external_notifications_from_app_row() IS
  'File externe : e-mail selon prefs ; SMS/WhatsApp patient (répondu, traité, expiré, rappel, produit reçu, rupture disponible).';
