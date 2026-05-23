-- Notif « produit de nouveau disponible » : inclure les patients ayant validé une alternative
-- sur une ligne dont le produit demandé était en rupture (ri.availability_status reste market_shortage).

CREATE OR REPLACE FUNCTION public.pharmacist_market_shortage_hub_lines()
RETURNS TABLE (
  market_shortage_id uuid,
  product_id uuid,
  product_name text,
  product_photo_url text,
  shortage_since timestamptz,
  request_item_id uuid,
  request_id uuid,
  request_public_ref text,
  request_type text,
  request_status text,
  responded_at timestamptz,
  patient_id uuid,
  patient_display_name text,
  patient_ref text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pharmacy uuid;
  v_cutoff timestamptz := now() - interval '2 months';
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT ps.pharmacy_id INTO v_pharmacy
  FROM public.pharmacy_staff ps
  JOIN public.profiles p ON p.id = ps.user_id
  WHERE ps.user_id = v_uid AND p.role = 'pharmacien'
  LIMIT 1;

  IF v_pharmacy IS NULL THEN
    RAISE EXCEPTION 'Accès pharmacien requis';
  END IF;

  RETURN QUERY
  SELECT
    ms.id AS market_shortage_id,
    ms.product_id,
    coalesce(prd.name, 'Produit')::text AS product_name,
    prd.photo_url::text AS product_photo_url,
    ms.created_at AS shortage_since,
    ri.id AS request_item_id,
    r.id AS request_id,
    coalesce(r.request_public_ref, '')::text AS request_public_ref,
    r.request_type::text AS request_type,
    r.status::text AS request_status,
    r.responded_at,
    r.patient_id,
    coalesce(pat.full_name, '')::text AS patient_display_name,
    coalesce(pat.patient_ref, '')::text AS patient_ref
  FROM public.market_shortages ms
  JOIN public.products prd ON prd.id = ms.product_id
  LEFT JOIN public.request_items ri ON ri.product_id = ms.product_id
  LEFT JOIN public.requests r ON r.id = ri.request_id
    AND r.pharmacy_id = v_pharmacy
    AND r.responded_at IS NOT NULL
    AND r.responded_at >= v_cutoff
    AND r.status IN (
      'responded'::public.request_status_enum,
      'confirmed'::public.request_status_enum,
      'treated'::public.request_status_enum,
      'expired'::public.request_status_enum,
      'abandoned'::public.request_status_enum,
      'cancelled'::public.request_status_enum,
      'completed'::public.request_status_enum,
      'partially_collected'::public.request_status_enum,
      'fully_collected'::public.request_status_enum
    )
    AND r.request_type IN (
      'product_request'::public.request_type_enum,
      'prescription'::public.request_type_enum,
      'free_consultation'::public.request_type_enum
    )
  LEFT JOIN public.profiles pat ON pat.id = r.patient_id
  WHERE ms.pharmacy_id = v_pharmacy
    AND ms.is_active = true
    AND (
      ri.id IS NULL
      OR ri.availability_status = 'market_shortage'::public.availability_status_enum
    )
  ORDER BY ms.created_at DESC, prd.name, r.responded_at DESC NULLS LAST;
END;
$$;

CREATE OR REPLACE FUNCTION public.pharmacist_declare_market_shortage_available(p_product_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pharmacy uuid;
  v_product_name text;
  v_cutoff timestamptz := now() - interval '2 months';
  v_notified integer := 0;
  v_rec record;
  v_reason text;
  v_reason_base text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_product_id IS NULL THEN
    RAISE EXCEPTION 'Produit requis';
  END IF;

  SELECT ps.pharmacy_id INTO v_pharmacy
  FROM public.pharmacy_staff ps
  JOIN public.profiles p ON p.id = ps.user_id
  WHERE ps.user_id = v_uid AND p.role = 'pharmacien'
  LIMIT 1;

  IF v_pharmacy IS NULL THEN
    RAISE EXCEPTION 'Accès pharmacien requis';
  END IF;

  SELECT coalesce(nullif(btrim(pr.name), ''), 'Produit') INTO v_product_name
  FROM public.products pr WHERE pr.id = p_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produit introuvable';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.market_shortages ms
    WHERE ms.pharmacy_id = v_pharmacy
      AND ms.product_id = p_product_id
      AND ms.is_active = true
  ) THEN
    RAISE EXCEPTION 'Ce produit n''est pas en rupture active pour votre officine';
  END IF;

  UPDATE public.market_shortages
  SET
    is_active = false,
    resolved_at = now(),
    declared_by = v_uid
  WHERE pharmacy_id = v_pharmacy
    AND product_id = p_product_id
    AND is_active = true;

  v_reason_base := 'market_shortage_product_available|' || p_product_id::text;

  FOR v_rec IN
    SELECT DISTINCT ON (r.patient_id)
      r.patient_id,
      r.id AS request_id,
      r.status AS request_status
    FROM public.request_items ri
    JOIN public.requests r ON r.id = ri.request_id
    WHERE r.pharmacy_id = v_pharmacy
      AND ri.product_id = p_product_id
      AND r.responded_at IS NOT NULL
      AND r.responded_at >= v_cutoff
      AND r.status IN (
        'responded'::public.request_status_enum,
        'confirmed'::public.request_status_enum,
        'treated'::public.request_status_enum,
        'expired'::public.request_status_enum,
        'abandoned'::public.request_status_enum,
        'cancelled'::public.request_status_enum,
        'completed'::public.request_status_enum,
        'partially_collected'::public.request_status_enum,
        'fully_collected'::public.request_status_enum
      )
      AND ri.availability_status = 'market_shortage'::public.availability_status_enum
      AND coalesce(ri.is_selected_by_patient, true) = true
    ORDER BY r.patient_id, r.responded_at DESC
  LOOP
    v_reason := v_reason_base || '|' || v_rec.request_id::text;
    PERFORM public._log_request_status_change(
      v_rec.request_id,
      v_rec.request_status,
      v_rec.request_status,
      v_uid,
      v_reason
    );
    v_notified := v_notified + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'product_id', p_product_id,
    'product_name', v_product_name,
    'patients_notified', v_notified
  );
END;
$$;

-- Texte notif si le patient avait validé une alternative sur ce produit
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
      'Le produit '
      || coalesce(v_product_name, 'demandé')
      || ' qui était en rupture de marché est actuellement disponible chez '
      || coalesce(p_pharma_nom, 'votre pharmacie')
      || '.';
    IF v_had_alternative THEN
      n_body :=
        n_body
        || E'\n\nVous aviez validé une alternative sur ce dossier : rouvrez la demande si vous souhaitez ce produit.';
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
        || E'\n'
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

COMMENT ON FUNCTION public.pharmacist_declare_market_shortage_available(uuid) IS
  'Retire la rupture active et notifie les patients dont la ligne demandée était en rupture (y compris si une alternative avait été validée).';
