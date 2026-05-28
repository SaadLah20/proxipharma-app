-- Pharmacien : abandon du dossier quand toutes les lignes retenues sont écartées sans aucun retrait comptoir.

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

  IF v_type <> 'product_request' THEN
    RAISE EXCEPTION 'Only product_request';
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

REVOKE ALL ON FUNCTION public.pharmacist_abandon_request_no_pickup(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.pharmacist_abandon_request_no_pickup(uuid) TO authenticated;

COMMENT ON FUNCTION public.pharmacist_abandon_request_no_pickup(uuid) IS
  'confirmed/treated -> abandoned si aucune ligne retenue active et aucun picked_up (dernière ligne écartée).';
