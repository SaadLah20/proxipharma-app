-- Ordonnances & consultations : rétablir le workflow lignes sur les RPC post-validé
-- (20260628_* avait restreint à product_request uniquement).

-- ---------------------------------------------------------------------------
-- Déclarer traitée : confirmed -> treated (prépare réservé/commandé si unset)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pharmacist_mark_request_treated(
  p_request_id uuid,
  p_expected_updated_at timestamptz DEFAULT NULL
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
  v_live_updated timestamptz;
  v_row RECORD;
  v_eff public.availability_status_enum;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT status, pharmacy_id, request_type, updated_at
  INTO v_old, v_pharmacy, v_type, v_live_updated
  FROM public.requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF p_expected_updated_at IS NOT NULL AND v_live_updated IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Le dossier a été modifié entre-temps. Actualisez la page avant de déclarer traitée.';
  END IF;

  IF NOT public._request_uses_product_line_workflow(v_type) THEN
    RAISE EXCEPTION 'Unsupported request type';
  END IF;

  IF v_old IS DISTINCT FROM 'confirmed'::public.request_status_enum THEN
    RAISE EXCEPTION 'Statut % : impossible de passer en traitée', v_old;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.pharmacy_staff ps
    JOIN public.profiles p ON p.id = ps.user_id
    WHERE ps.pharmacy_id = v_pharmacy
      AND ps.user_id = v_uid
      AND p.role = 'pharmacien'
  ) THEN
    RAISE EXCEPTION 'Accès pharmacien requis';
  END IF;

  FOR v_row IN
    SELECT
      ri.id,
      ri.is_selected_by_patient,
      ri.withdrawn_after_confirm,
      ri.post_confirm_fulfillment,
      coalesce(ria.availability_status, ri.availability_status) AS eff_av
    FROM public.request_items ri
    LEFT JOIN public.request_item_alternatives ria
      ON ria.id = ri.patient_chosen_alternative_id AND ria.request_item_id = ri.id
    WHERE ri.request_id = p_request_id
  LOOP
    IF NOT coalesce(v_row.is_selected_by_patient, false) THEN
      CONTINUE;
    END IF;
    IF coalesce(v_row.withdrawn_after_confirm, false) THEN
      CONTINUE;
    END IF;

    v_eff := v_row.eff_av;

    IF v_eff IN (
      'available'::public.availability_status_enum,
      'partially_available'::public.availability_status_enum
    ) THEN
      IF v_row.post_confirm_fulfillment IS NULL
         OR v_row.post_confirm_fulfillment = 'unset'::public.post_confirm_fulfillment_enum THEN
        UPDATE public.request_items
        SET post_confirm_fulfillment = 'reserved'::public.post_confirm_fulfillment_enum,
            updated_at = now()
        WHERE id = v_row.id;
      END IF;
    ELSIF v_eff = 'to_order'::public.availability_status_enum THEN
      IF v_row.post_confirm_fulfillment IS NULL
         OR v_row.post_confirm_fulfillment = 'unset'::public.post_confirm_fulfillment_enum THEN
        UPDATE public.request_items
        SET post_confirm_fulfillment = 'ordered'::public.post_confirm_fulfillment_enum,
            updated_at = now()
        WHERE id = v_row.id;
      END IF;
    END IF;
  END LOOP;

  UPDATE public.requests SET status = 'treated', updated_at = now() WHERE id = p_request_id;

  PERFORM public._log_request_status_change(
    p_request_id,
    v_old,
    'treated'::public.request_status_enum,
    v_uid,
    'pharmacist_mark_request_treated'
  );
END;
$$;

COMMENT ON FUNCTION public.pharmacist_mark_request_treated(uuid, timestamptz) IS
  'confirmed -> treated ; produits, ordonnances, consultations (workflow lignes) ; prépare réservé/commandé ; verrou optimistic optionnel.';

-- ---------------------------------------------------------------------------
-- Abandon sans retrait : toutes lignes retenues écartées
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pharmacist_abandon_request_no_pickup(p_request_id uuid)
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
  v_active int := 0;
  v_picked int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT status, pharmacy_id, request_type
  INTO v_old, v_pharmacy, v_type
  FROM public.requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF NOT public._request_uses_product_line_workflow(v_type) THEN
    RAISE EXCEPTION 'Unsupported request type';
  END IF;

  IF v_old NOT IN (
    'confirmed'::public.request_status_enum,
    'treated'::public.request_status_enum
  ) THEN
    RAISE EXCEPTION 'Cannot abandon from status %', v_old;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.pharmacy_staff ps
    JOIN public.profiles p ON p.id = ps.user_id
    WHERE ps.pharmacy_id = v_pharmacy
      AND ps.user_id = v_uid
      AND p.role = 'pharmacien'
  ) THEN
    RAISE EXCEPTION 'Accès pharmacien requis';
  END IF;

  SELECT
    count(*) FILTER (
      WHERE coalesce(ri.is_selected_by_patient, false)
        AND NOT coalesce(ri.withdrawn_after_confirm, false)
    ),
    count(*) FILTER (
      WHERE coalesce(ri.is_selected_by_patient, false)
        AND ri.counter_outcome = 'picked_up'::public.counter_line_outcome_enum
    )
  INTO v_active, v_picked
  FROM public.request_items ri
  WHERE ri.request_id = p_request_id;

  IF v_active > 0 THEN
    RAISE EXCEPTION 'Il reste des lignes actives : abandon impossible.';
  END IF;

  IF v_picked > 0 THEN
    RAISE EXCEPTION 'Des produits ont été récupérés au comptoir : utilisez la clôture du dossier.';
  END IF;

  UPDATE public.requests
  SET status = 'abandoned', updated_at = now()
  WHERE id = p_request_id;

  PERFORM public._log_request_status_change(
    p_request_id,
    v_old,
    'abandoned'::public.request_status_enum,
    v_uid,
    'pharmacist_abandon_no_pickup|toutes_lignes_ecartees_sans_retrait'
  );
END;
$$;

COMMENT ON FUNCTION public.pharmacist_abandon_request_no_pickup(uuid) IS
  'confirmed/treated -> abandoned si aucune ligne retenue active ; produits, ordonnances, consultations.';
