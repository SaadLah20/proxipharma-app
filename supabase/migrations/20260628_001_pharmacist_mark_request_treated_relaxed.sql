-- Pharmacien : déclarer traitée sans exiger « réservé / commandé » au préalable (boutons retirés côté UI).
-- Prépare les lignes (réservé / commandé) au passage en treated si encore « unset ».

DROP FUNCTION IF EXISTS public.pharmacist_mark_request_treated(uuid);

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

REVOKE ALL ON FUNCTION public.pharmacist_mark_request_treated(uuid, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.pharmacist_mark_request_treated(uuid, timestamptz) TO authenticated;

COMMENT ON FUNCTION public.pharmacist_mark_request_treated(uuid, timestamptz) IS
  'confirmed -> treated ; prépare réservé/commandé sur lignes actives ; verrou optimistic optionnel.';
