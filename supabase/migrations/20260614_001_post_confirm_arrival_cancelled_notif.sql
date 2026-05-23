-- Rétablir la notif patient « réception en officine annulée » (hub Produits commandés + détail demande).
-- Régression : 20260602 / 20260604 avaient retiré post_confirm_arrival_cancelled du trigger et du libellé.

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
  v_product_name text;
BEGIN
  IF p_history_reason = 'patient_planned_visit_updated' THEN
    n_title := 'Passage en pharmacie mis à jour';
    n_body := coalesce(p_pharma_nom, 'Pharmacie') || E'\n' || p_nature || E'\n' || p_when_fr;
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_history_reason IS NOT NULL AND (
    p_history_reason LIKE 'pharmacist_supply_amendments_saved|%'
    OR p_history_reason = 'pharmacist_adjustments_after_confirmation'
    OR p_history_reason LIKE 'audit_v1:%'
  ) THEN
    n_title := 'Demande validée mise à jour';
    n_body :=
      'La pharmacie ' || coalesce(p_pharma_nom, '—')
      || ' a mis à jour sa réponse sur votre '
      || coalesce(p_nature, 'demande')
      || E'.\n'
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

    n_title := 'Produit reçu en pharmacie';
    n_body :=
      coalesce(v_product_name, 'Produit')
      || ' commandé est arrivé à '
      || coalesce(p_pharma_nom, 'la pharmacie')
      || E'.\n'
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

    n_title := 'Réception en pharmacie annulée';
    n_body :=
      coalesce(v_product_name, 'Produit')
      || ' : l''officine a annulé la confirmation de réception à '
      || coalesce(p_pharma_nom, 'la pharmacie')
      || E'.\n'
      || p_when_fr;
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_status = 'responded'::public.request_status_enum
     AND p_history_reason IS NOT NULL
     AND p_history_reason = 'pharmacist_response_updated' THEN
    n_title := 'Réponse mise à jour';
    n_body :=
      'La pharmacie ' || coalesce(p_pharma_nom, '—')
      || ' a mis à jour sa réponse sur votre '
      || coalesce(p_nature, 'demande')
      || E'.\n'
      || p_when_fr;
    RETURN NEXT;
    RETURN;
  END IF;

  n_title :=
    CASE p_status
      WHEN 'responded' THEN 'Réponse de la pharmacie'
      WHEN 'treated' THEN 'Demande traitée'
      WHEN 'completed' THEN 'Demande clôturée'
      WHEN 'cancelled' THEN 'Demande annulée'
      WHEN 'abandoned' THEN 'Demande abandonnée'
      WHEN 'expired' THEN 'Demande expirée'
      ELSE 'Mise à jour'
    END;

  n_body :=
    CASE p_status
      WHEN 'responded' THEN
        'La pharmacie ' || coalesce(p_pharma_nom, '—')
        || ' vous a répondu sur votre '
        || coalesce(p_nature, 'demande')
        || E'.\n'
        || p_when_fr
      WHEN 'treated' THEN
        'La pharmacie ' || coalesce(p_pharma_nom, '—')
        || ' a traité votre '
        || coalesce(p_nature, 'demande')
        || E'.\n'
        || p_when_fr
      WHEN 'completed' THEN
        'Votre ' || lower(coalesce(p_nature, 'demande')) || ' est clôturée.'
        || E'\n'
        || p_when_fr
      WHEN 'cancelled' THEN
        'Votre ' || lower(coalesce(p_nature, 'demande')) || ' a été annulée.'
        || E'\n'
        || p_when_fr
      WHEN 'abandoned' THEN
        'Votre ' || lower(coalesce(p_nature, 'demande')) || ' a été abandonnée.'
        || E'\n'
        || p_when_fr
      WHEN 'expired' THEN
        'Votre ' || lower(coalesce(p_nature, 'demande')) || ' a expiré.'
        || E'\n'
        || p_when_fr
      ELSE
        coalesce(p_pharma_nom, 'Pharmacie') || E'\n' || coalesce(p_nature, 'demande') || E'\n' || p_when_fr
    END;

  RETURN NEXT;
END;
$$;

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

  IF new.reason = 'patient_prescription_updated' THEN
    SELECT t.n_title, t.n_body INTO v_title_ph, v_body_ph
    FROM public._in_app_notification_pharmacist(
      new.new_status, new.old_status, v_pharma_nom, v_pharma_ville, v_patient_nom, v_nature, v_when_fr, new.reason
    ) AS t;
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

  IF new.new_status IN ('responded', 'treated', 'completed', 'cancelled', 'abandoned', 'expired')
     OR new.reason = 'pharmacist_response_updated'
     OR (new.reason IS NOT NULL AND (
       new.reason LIKE 'post_confirm_product_arrived|%'
       OR new.reason LIKE 'post_confirm_arrival_cancelled|%'
     ))
     OR v_patient_supply_update
  THEN
    SELECT t.n_title, t.n_body INTO v_title_pat, v_body_pat
    FROM public._in_app_notification_patient(new.new_status, v_pharma_nom, v_pharma_ville, v_nature, v_when_fr, new.reason) AS t;

    v_event_pat := CASE
      WHEN new.reason = 'pharmacist_response_updated' THEN 'request_event:pharmacist_response_updated'
      WHEN new.reason LIKE 'post_confirm_product_arrived|%' THEN 'request_event:post_confirm_product_arrived'
      WHEN new.reason LIKE 'post_confirm_arrival_cancelled|%' THEN 'request_event:post_confirm_arrival_cancelled'
      WHEN new.reason LIKE 'pharmacist_supply_amendments_saved|%' THEN 'request_event:pharmacist_supply_amendments_saved'
      WHEN v_patient_supply_update THEN 'request_event:pharmacist_validated_request_updated'
      ELSE 'request_status:' || new.new_status::text
    END;

    INSERT INTO public.app_notifications (recipient_id, request_id, source_status_history_id, event_type, title, body)
    VALUES (v_req.patient_id, new.request_id, new.id, v_event_pat, v_title_pat, v_body_pat)
    ON CONFLICT (source_status_history_id, recipient_id) DO NOTHING;
  END IF;

  IF new.new_status IN ('submitted', 'confirmed', 'treated', 'abandoned', 'cancelled', 'expired')
     AND coalesce(new.reason, '') IS DISTINCT FROM 'patient_planned_visit_updated'
     AND coalesce(new.reason, '') NOT LIKE 'post_confirm_product_arrived|%'
     AND coalesce(new.reason, '') NOT LIKE 'post_confirm_arrival_cancelled|%'
     AND coalesce(new.reason, '') IS DISTINCT FROM 'pharmacist_response_updated'
     AND NOT v_patient_supply_update
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

COMMENT ON FUNCTION public._in_app_notification_patient IS
  'Libellés notif patient ; inclut post_confirm_product_arrived et post_confirm_arrival_cancelled (hub produits commandés).';
