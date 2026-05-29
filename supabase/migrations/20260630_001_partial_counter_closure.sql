-- Clôture comptoir : au moins une ligne récupérée suffit ; les autres retenues non récupérées
-- sont automatiquement écartées (withdrawn_after_confirm) à la clôture.

CREATE OR REPLACE FUNCTION public.pharmacist_complete_request_after_counter(
  p_request_id uuid,
  p_reason text DEFAULT NULL
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
  v_picked int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT status, pharmacy_id INTO v_old, v_pharmacy
  FROM public.requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF NOT public.is_admin() AND NOT EXISTS (
    SELECT 1 FROM public.pharmacy_staff ps
    JOIN public.profiles p ON p.id = ps.user_id
    WHERE ps.pharmacy_id = v_pharmacy AND ps.user_id = v_uid AND p.role = 'pharmacien'
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF v_old NOT IN (
    'responded'::public.request_status_enum,
    'confirmed'::public.request_status_enum,
    'treated'::public.request_status_enum
  ) THEN
    RAISE EXCEPTION 'Cannot complete from status %', v_old;
  END IF;

  SELECT count(*)::int INTO v_picked
  FROM public.request_items
  WHERE request_id = p_request_id
    AND is_selected_by_patient = true
    AND coalesce(withdrawn_after_confirm, false) = false
    AND counter_outcome = 'picked_up'::public.counter_line_outcome_enum;

  IF v_picked < 1 THEN
    RAISE EXCEPTION 'Au moins un produit doit être marqué récupéré au comptoir avant de clôturer.';
  END IF;

  UPDATE public.request_items
  SET
    withdrawn_after_confirm = true,
    post_confirm_fulfillment = 'unset'::public.post_confirm_fulfillment_enum,
    updated_at = now()
  WHERE request_id = p_request_id
    AND is_selected_by_patient = true
    AND coalesce(withdrawn_after_confirm, false) = false
    AND counter_outcome IN (
      'unset'::public.counter_line_outcome_enum,
      'deferred_next_visit'::public.counter_line_outcome_enum
    );

  UPDATE public.requests SET status = 'completed'::public.request_status_enum, updated_at = now() WHERE id = p_request_id;

  PERFORM public._log_request_status_change(
    p_request_id,
    v_old,
    'completed'::public.request_status_enum,
    v_uid,
    coalesce(p_reason, 'pharmacist_complete_request_after_counter')
  );
END;
$$;
