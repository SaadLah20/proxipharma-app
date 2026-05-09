-- État intermédiaire « arrivé en officine » pour les lignes à commander déjà « commandé ».

DO $enum$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'post_confirm_fulfillment_enum' AND e.enumlabel = 'arrived_reserved'
  ) THEN
    ALTER TYPE public.post_confirm_fulfillment_enum ADD VALUE 'arrived_reserved';
  END IF;
END;
$enum$;

CREATE OR REPLACE FUNCTION public.pharmacist_set_post_confirm_fulfillment(
  p_request_item_id uuid,
  p_fulfillment public.post_confirm_fulfillment_enum
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req_id uuid;
  v_status public.request_status_enum;
  v_pharmacy uuid;
  v_selected boolean;
  v_chosen_alt uuid;
  v_eff public.availability_status_enum;
  v_exp date;
  v_cur public.post_confirm_fulfillment_enum;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT
    ri.request_id,
    ri.is_selected_by_patient,
    ri.patient_chosen_alternative_id,
    coalesce(ria.availability_status, ri.availability_status) AS eff_av,
    CASE
      WHEN ri.patient_chosen_alternative_id IS NOT NULL THEN ria.expected_availability_date
      ELSE ri.expected_availability_date
    END AS eff_exp,
    ri.post_confirm_fulfillment
  INTO v_req_id, v_selected, v_chosen_alt, v_eff, v_exp, v_cur
  FROM public.request_items ri
  LEFT JOIN public.request_item_alternatives ria
    ON ria.id = ri.patient_chosen_alternative_id
    AND ria.request_item_id = ri.id
  WHERE ri.id = p_request_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ligne introuvable';
  END IF;

  IF NOT coalesce(v_selected, false) THEN
    RAISE EXCEPTION 'Ligne non retenue par le patient';
  END IF;

  SELECT r.status, r.pharmacy_id INTO v_status, v_pharmacy
  FROM public.requests r
  WHERE r.id = v_req_id;

  IF v_status NOT IN (
    'confirmed'::public.request_status_enum,
    'processing'::public.request_status_enum,
    'treated'::public.request_status_enum
  ) THEN
    RAISE EXCEPTION 'Statut demande incompatible';
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

  IF p_fulfillment = 'reserved'::public.post_confirm_fulfillment_enum THEN
    IF v_eff IS NULL OR v_eff NOT IN ('available'::public.availability_status_enum, 'partially_available'::public.availability_status_enum) THEN
      RAISE EXCEPTION '« Réservé » uniquement pour une ligne disponible ou partiellement disponible sur la branche choisie.';
    END IF;
  ELSIF p_fulfillment = 'ordered'::public.post_confirm_fulfillment_enum THEN
    IF v_eff IS DISTINCT FROM 'to_order'::public.availability_status_enum THEN
      RAISE EXCEPTION '« Commandé » uniquement pour une ligne « à commander » sur la branche choisie.';
    END IF;
    IF v_exp IS NULL THEN
      RAISE EXCEPTION 'Date de réception prévue obligatoire pour une ligne à commander.';
    END IF;
  ELSIF p_fulfillment = 'arrived_reserved'::public.post_confirm_fulfillment_enum THEN
    IF v_eff IS DISTINCT FROM 'to_order'::public.availability_status_enum THEN
      RAISE EXCEPTION '« Arrivé en officine » uniquement pour une ligne à commander.';
    END IF;
    IF v_cur IS DISTINCT FROM 'ordered'::public.post_confirm_fulfillment_enum THEN
      RAISE EXCEPTION 'Indiquez d''abord « Commandé », puis « Arrivé · prêt au comptoir ».';
    END IF;
  END IF;

  UPDATE public.request_items
  SET post_confirm_fulfillment = p_fulfillment, updated_at = now()
  WHERE id = p_request_item_id;

  IF v_status = 'confirmed'::public.request_status_enum
     AND p_fulfillment IN (
       'reserved'::public.post_confirm_fulfillment_enum,
       'ordered'::public.post_confirm_fulfillment_enum,
       'arrived_reserved'::public.post_confirm_fulfillment_enum
     ) THEN
    UPDATE public.requests SET status = 'processing', updated_at = now() WHERE id = v_req_id;
    PERFORM public._log_request_status_change(v_req_id, v_status, 'processing', v_uid, 'pharmacist_post_confirm_fulfillment_started');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.pharmacist_mark_request_treated(p_request_id uuid)
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
  v_row RECORD;
  v_eff public.availability_status_enum;
  v_pcf public.post_confirm_fulfillment_enum;
  v_bad int := 0;
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

  IF v_old NOT IN ('confirmed'::public.request_status_enum, 'processing'::public.request_status_enum) THEN
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

COMMENT ON FUNCTION public.pharmacist_set_post_confirm_fulfillment(uuid, public.post_confirm_fulfillment_enum) IS
  'Après validation : réservé / commandé / arrivé en officine (lignes à commander déjà commandées).';
