-- Abandon direct pharmacien (confirmed/treated) : écarte les lignes retenues actives puis passe en abandoned.

CREATE OR REPLACE FUNCTION public.pharmacist_abandon_request(
  p_request_id uuid,
  p_reason_text text
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
  v_reason text := nullif(trim(p_reason_text), '');
  v_picked int := 0;
  v_log text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_reason IS NULL OR length(v_reason) < 5 THEN
    RAISE EXCEPTION 'Motif d''abandon obligatoire (5 caractères minimum).';
  END IF;

  IF length(v_reason) > 2000 THEN
    RAISE EXCEPTION 'Motif d''abandon trop long.';
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

  SELECT count(*)
  INTO v_picked
  FROM public.request_items ri
  WHERE ri.request_id = p_request_id
    AND coalesce(ri.is_selected_by_patient, false)
    AND ri.counter_outcome = 'picked_up'::public.counter_line_outcome_enum;

  IF v_picked > 0 THEN
    RAISE EXCEPTION 'Des produits ont été récupérés au comptoir : utilisez la clôture du dossier.';
  END IF;

  UPDATE public.request_items
  SET
    withdrawn_after_confirm = true,
    updated_at = now()
  WHERE request_id = p_request_id
    AND coalesce(is_selected_by_patient, false)
    AND NOT coalesce(withdrawn_after_confirm, false);

  v_log := format('pharmacist_abandon|%s', v_reason);

  UPDATE public.requests
  SET status = 'abandoned', updated_at = now()
  WHERE id = p_request_id;

  PERFORM public._log_request_status_change(
    p_request_id,
    v_old,
    'abandoned'::public.request_status_enum,
    v_uid,
    v_log
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pharmacist_abandon_request(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.pharmacist_abandon_request(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.pharmacist_abandon_request(uuid, text) IS
  'confirmed/treated -> abandoned ; écarte les lignes retenues actives ; motif obligatoire ; refus si retrait comptoir.';
