-- Notifications in-app : libellés courts et publics (3 types de demande). SMS inchangé (répondu / traité patient).

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

  IF p_history_reason IS NOT NULL AND p_history_reason LIKE 'pharmacist_supply_amendments_saved|%' THEN
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
      'Le patient ' || coalesce(p_patient_nom, '—')
      || ' a mis à jour son '
      || lower(coalesce(p_nature, 'ordonnance'))
      || E'.\n'
      || p_when_fr;
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_history_reason = 'patient_planned_visit_updated' THEN
    n_title := 'Passage patient modifié';
    n_body :=
      'Le patient ' || coalesce(p_patient_nom, '—')
      || ' a mis à jour sa date de passage sur sa '
      || lower(coalesce(p_nature, 'demande'))
      || E'.\n'
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
      WHEN 'confirmed' THEN 'Demande validée'
      WHEN 'cancelled' THEN 'Demande annulée'
      WHEN 'abandoned' THEN 'Demande abandonnée'
      WHEN 'expired' THEN 'Demande expirée'
      ELSE 'Mise à jour'
    END;

  n_body :=
    CASE p_status
      WHEN 'submitted' THEN
        CASE
          WHEN v_is_update_submitted THEN
            'Le patient ' || coalesce(p_patient_nom, '—')
            || ' a mis à jour sa '
            || lower(coalesce(p_nature, 'demande'))
            || ' le '
            || p_when_fr
          ELSE
            coalesce(p_patient_nom, '—')
            || E'\n'
            || coalesce(p_nature, 'Demande')
            || E'\n'
            || p_when_fr
        END
      WHEN 'confirmed' THEN
        'Le patient ' || coalesce(p_patient_nom, '—')
        || ' a validé sa '
        || lower(coalesce(p_nature, 'demande'))
        || E'.\n'
        || p_when_fr
      WHEN 'cancelled' THEN
        'Une ' || lower(coalesce(p_nature, 'demande')) || ' a été annulée.'
        || E'\n'
        || p_when_fr
      WHEN 'abandoned' THEN
        'Une ' || lower(coalesce(p_nature, 'demande')) || ' a été abandonnée.'
        || E'\n'
        || p_when_fr
      WHEN 'expired' THEN
        'Une ' || lower(coalesce(p_nature, 'demande')) || ' a expiré.'
        || E'\n'
        || p_when_fr
      ELSE
        coalesce(p_patient_nom, '—') || E'\n' || coalesce(p_nature, 'demande') || E'\n' || p_when_fr
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

  -- Patient : passage modifié (info seulement patient — pas de doublon pharmacien ici si géré ailleurs)
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

  -- Notifications patient
  IF new.new_status IN ('responded', 'treated', 'completed', 'cancelled', 'abandoned', 'expired')
     OR new.reason = 'pharmacist_response_updated'
     OR (new.reason IS NOT NULL AND (
       new.reason LIKE 'pharmacist_supply_amendments_saved|%'
       OR new.reason LIKE 'post_confirm_product_arrived|%'
     ))
  THEN
    SELECT t.n_title, t.n_body INTO v_title_pat, v_body_pat
    FROM public._in_app_notification_patient(new.new_status, v_pharma_nom, v_pharma_ville, v_nature, v_when_fr, new.reason) AS t;

    v_event_pat := CASE
      WHEN new.reason = 'pharmacist_response_updated' THEN 'request_event:pharmacist_response_updated'
      WHEN new.reason LIKE 'pharmacist_supply_amendments_saved|%' THEN 'request_event:pharmacist_supply_amendments_saved'
      WHEN new.reason LIKE 'post_confirm_product_arrived|%' THEN 'request_event:post_confirm_product_arrived'
      ELSE 'request_status:' || new.new_status::text
    END;

    INSERT INTO public.app_notifications (recipient_id, request_id, source_status_history_id, event_type, title, body)
    VALUES (v_req.patient_id, new.request_id, new.id, v_event_pat, v_title_pat, v_body_pat)
    ON CONFLICT (source_status_history_id, recipient_id) DO NOTHING;
  END IF;

  -- Notifications pharmacien (pas l'auteur de l'action)
  IF new.new_status IN ('submitted', 'confirmed', 'cancelled', 'abandoned', 'expired')
     AND coalesce(new.reason, '') IS DISTINCT FROM 'patient_planned_visit_updated'
     AND coalesce(new.reason, '') NOT LIKE 'pharmacist_supply_amendments_saved|%'
     AND coalesce(new.reason, '') NOT LIKE 'post_confirm_product_arrived|%'
     AND coalesce(new.reason, '') IS DISTINCT FROM 'pharmacist_response_updated'
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
