-- Patient : mettre à jour sa validation tant que le dossier est « confirmed » (pas encore traité).
-- Optimistic lock : p_expected_updated_at doit correspondre à requests.updated_at.

CREATE OR REPLACE FUNCTION public.patient_update_confirmation(
  p_request_id uuid,
  p_selections jsonb DEFAULT '[]'::jsonb,
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
  v_patient uuid;
  v_live_updated timestamptz;
  v_sel jsonb;
  v_item_id uuid;
  v_is_selected boolean;
  v_qty int;
  v_row public.request_items%rowtype;
  v_alt_row public.request_item_alternatives%rowtype;
  v_chosen_alt uuid;
  v_max_qty int;
  v_any_selected boolean := false;
  v_item_count int;
  v_sel_count int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT status, patient_id, updated_at
  INTO v_old, v_patient, v_live_updated
  FROM public.requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_patient <> v_uid THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF v_old IS DISTINCT FROM 'confirmed'::public.request_status_enum THEN
    RAISE EXCEPTION 'Invalid status: expected confirmed, got %', v_old;
  END IF;

  IF p_expected_updated_at IS NOT NULL AND v_live_updated IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Le dossier a été modifié entre-temps. Actualisez la page avant d''enregistrer.';
  END IF;

  IF p_selections IS NULL OR jsonb_typeof(p_selections) <> 'array' THEN
    RAISE EXCEPTION 'p_selections must be a JSON array';
  END IF;

  SELECT count(*)::int INTO v_item_count FROM public.request_items WHERE request_id = p_request_id;
  v_sel_count := jsonb_array_length(p_selections);
  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'No request items';
  END IF;
  IF v_item_count <> v_sel_count THEN
    RAISE EXCEPTION 'p_selections must list exactly % item(s)', v_item_count;
  END IF;

  FOR v_sel IN SELECT * FROM jsonb_array_elements(p_selections)
  LOOP
    v_item_id := (v_sel->>'request_item_id')::uuid;
    v_is_selected := coalesce((v_sel->>'is_selected')::boolean, false);
    v_qty := nullif(v_sel->>'selected_qty', '')::int;
    v_chosen_alt := NULL;
    IF v_sel ? 'chosen_alternative_id' AND nullif(trim(v_sel->>'chosen_alternative_id'), '') IS NOT NULL THEN
      v_chosen_alt := (v_sel->>'chosen_alternative_id')::uuid;
    END IF;

    SELECT * INTO v_row
    FROM public.request_items
    WHERE id = v_item_id AND request_id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid request_item_id %', v_item_id;
    END IF;

    IF v_is_selected THEN
      IF v_chosen_alt IS NOT NULL THEN
        SELECT * INTO v_alt_row
        FROM public.request_item_alternatives
        WHERE id = v_chosen_alt AND request_item_id = v_item_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'chosen_alternative_id does not belong to item %', v_item_id;
        END IF;
        IF v_alt_row.available_qty IS NOT NULL THEN
          v_max_qty := greatest(1, v_alt_row.available_qty);
        ELSE
          v_max_qty := v_row.requested_qty;
          IF v_row.available_qty IS NOT NULL THEN
            v_max_qty := least(v_max_qty, v_row.available_qty);
          END IF;
        END IF;
      ELSE
        v_chosen_alt := NULL;
        v_max_qty := v_row.requested_qty;
        IF v_row.available_qty IS NOT NULL THEN
          v_max_qty := least(v_max_qty, v_row.available_qty);
        END IF;
      END IF;

      IF v_max_qty < 1 THEN
        RAISE EXCEPTION 'No quantity available on selected branch for item %', v_item_id;
      END IF;

      IF v_qty IS NULL THEN
        v_qty := greatest(v_max_qty, 1);
      END IF;
      IF v_qty < 1 OR v_qty > v_max_qty THEN
        RAISE EXCEPTION 'Quantité invalide pour cette ligne (max. % unité(s) proposée(s) par la pharmacie).', v_max_qty;
      END IF;

      UPDATE public.request_items
      SET
        is_selected_by_patient = true,
        selected_qty = v_qty,
        patient_chosen_alternative_id = v_chosen_alt,
        updated_at = now()
      WHERE id = v_item_id;
      v_any_selected := true;
    ELSE
      UPDATE public.request_items
      SET
        is_selected_by_patient = false,
        selected_qty = NULL,
        patient_chosen_alternative_id = NULL,
        counter_outcome = 'cancelled_at_counter',
        updated_at = now()
      WHERE id = v_item_id;
    END IF;
  END LOOP;

  IF NOT v_any_selected THEN
    RAISE EXCEPTION 'At least one line must stay selected';
  END IF;

  UPDATE public.requests SET updated_at = now() WHERE id = p_request_id;

  PERFORM public._log_request_status_change(
    p_request_id,
    v_old,
    v_old,
    v_uid,
    'patient_update_confirmation'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.patient_update_confirmation(uuid, jsonb, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.patient_update_confirmation(uuid, jsonb, timestamptz) TO authenticated;

COMMENT ON FUNCTION public.patient_update_confirmation(uuid, jsonb, timestamptz) IS
  'Met à jour la sélection patient tant que confirmed ; verrou optimistic sur updated_at.';

-- Pharmacien : marquer traitée uniquement si le snapshot client correspond encore.

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
  v_pcf public.post_confirm_fulfillment_enum;
  v_bad int := 0;
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

  IF v_type <> 'product_request' THEN
    RAISE EXCEPTION 'Only product_request';
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
      ri.patient_chosen_alternative_id,
      coalesce(ria.availability_status, ri.availability_status) AS eff_av,
      ri.post_confirm_fulfillment
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
    v_pcf := v_row.post_confirm_fulfillment;
    IF v_eff IN ('available'::public.availability_status_enum, 'partially_available'::public.availability_status_enum) THEN
      IF v_pcf IS DISTINCT FROM 'reserved'::public.post_confirm_fulfillment_enum THEN
        v_bad := v_bad + 1;
      END IF;
    ELSIF v_eff = 'to_order'::public.availability_status_enum THEN
      IF v_pcf IS DISTINCT FROM 'ordered'::public.post_confirm_fulfillment_enum
         AND v_pcf IS DISTINCT FROM 'arrived_reserved'::public.post_confirm_fulfillment_enum THEN
        v_bad := v_bad + 1;
      END IF;
    ELSE
      v_bad := v_bad + 1;
    END IF;
  END LOOP;

  IF v_bad > 0 THEN
    RAISE EXCEPTION 'Toutes les lignes retenues non retirées doivent être « réservé » ou « commandé » (ou arrivé en officine) selon la voie officine/commande.';
  END IF;

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

REVOKE ALL ON FUNCTION public.pharmacist_mark_request_treated(uuid, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.pharmacist_mark_request_treated(uuid, timestamptz) TO authenticated;

COMMENT ON FUNCTION public.pharmacist_mark_request_treated(uuid, timestamptz) IS
  'confirmed -> treated ; verrou optimistic optionnel sur updated_at.';
