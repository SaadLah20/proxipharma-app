-- Hub pharmacien « Produits commandés » : liste centralisée + marquage groupé reçu en officine.

-- ---------------------------------------------------------------------------
-- Liste des lignes à commander / commandées / reçues (3 parcours, confirmed|treated)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pharmacist_ordered_supply_hub_lines()
RETURNS TABLE (
  request_item_id uuid,
  request_id uuid,
  request_public_ref text,
  request_type text,
  request_status text,
  catalog_product_id uuid,
  product_name text,
  product_photo_url text,
  selected_qty integer,
  expected_availability_date date,
  post_confirm_fulfillment public.post_confirm_fulfillment_enum,
  fulfillment_bucket text,
  patient_id uuid,
  patient_display_name text,
  patient_ref text,
  counter_outcome text,
  line_updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pharmacy uuid;
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
    ri.id AS request_item_id,
    r.id AS request_id,
    coalesce(r.request_public_ref, '')::text AS request_public_ref,
    r.request_type::text AS request_type,
    r.status::text AS request_status,
    CASE
      WHEN ri.patient_chosen_alternative_id IS NOT NULL THEN altp.id
      ELSE p.id
    END AS catalog_product_id,
    coalesce(
      CASE WHEN ri.patient_chosen_alternative_id IS NOT NULL THEN altp.name ELSE p.name END,
      'Produit'
    )::text AS product_name,
    (CASE WHEN ri.patient_chosen_alternative_id IS NOT NULL THEN altp.photo_url ELSE p.photo_url END)::text
      AS product_photo_url,
    coalesce(ri.selected_qty, ri.requested_qty, 1)::integer AS selected_qty,
    CASE
      WHEN ri.patient_chosen_alternative_id IS NOT NULL THEN ria.expected_availability_date
      ELSE ri.expected_availability_date
    END AS expected_availability_date,
    ri.post_confirm_fulfillment,
    CASE
      WHEN ri.post_confirm_fulfillment = 'arrived_reserved'::public.post_confirm_fulfillment_enum
        THEN 'received'::text
      ELSE 'pending'::text
    END AS fulfillment_bucket,
    r.patient_id,
    coalesce(pr.full_name, '')::text AS patient_display_name,
    coalesce(pr.patient_ref, '')::text AS patient_ref,
    ri.counter_outcome::text AS counter_outcome,
    ri.updated_at AS line_updated_at
  FROM public.request_items ri
  JOIN public.requests r ON r.id = ri.request_id
  JOIN public.products p ON p.id = ri.product_id
  LEFT JOIN public.request_item_alternatives ria
    ON ria.id = ri.patient_chosen_alternative_id AND ria.request_item_id = ri.id
  LEFT JOIN public.products altp ON altp.id = ria.product_id
  LEFT JOIN public.profiles pr ON pr.id = r.patient_id
  WHERE r.pharmacy_id = v_pharmacy
    AND r.request_type IN (
      'product_request'::public.request_type_enum,
      'prescription'::public.request_type_enum,
      'free_consultation'::public.request_type_enum
    )
    AND r.status IN (
      'confirmed'::public.request_status_enum,
      'treated'::public.request_status_enum
    )
    AND coalesce(ri.is_selected_by_patient, false) = true
    AND coalesce(ri.withdrawn_after_confirm, false) = false
    AND coalesce(ria.availability_status, ri.availability_status) = 'to_order'::public.availability_status_enum
    AND (
      ri.post_confirm_fulfillment IN (
        'unset'::public.post_confirm_fulfillment_enum,
        'ordered'::public.post_confirm_fulfillment_enum
      )
      OR ri.post_confirm_fulfillment = 'arrived_reserved'::public.post_confirm_fulfillment_enum
    );
END;
$$;

COMMENT ON FUNCTION public.pharmacist_ordered_supply_hub_lines() IS
  'Lignes validées « à commander » pour le hub Produits commandés (pending = unset|ordered, received = arrived_reserved).';

-- ---------------------------------------------------------------------------
-- Marquer reçu en officine (bulk) — réutilise pharmacist_set_post_confirm_fulfillment
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pharmacist_apply_ordered_supply_arrival(p_item_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_item_id uuid;
  v_cur public.post_confirm_fulfillment_enum;
  v_eff public.availability_status_enum;
  v_exp date;
  v_applied integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_item_ids IS NULL OR cardinality(p_item_ids) = 0 THEN
    RAISE EXCEPTION 'Aucune ligne sélectionnée';
  END IF;

  FOREACH v_item_id IN ARRAY p_item_ids LOOP
    SELECT
      ri.post_confirm_fulfillment,
      coalesce(ria.availability_status, ri.availability_status),
      CASE
        WHEN ri.patient_chosen_alternative_id IS NOT NULL THEN ria.expected_availability_date
        ELSE ri.expected_availability_date
      END
    INTO v_cur, v_eff, v_exp
    FROM public.request_items ri
    LEFT JOIN public.request_item_alternatives ria
      ON ria.id = ri.patient_chosen_alternative_id AND ria.request_item_id = ri.id
    WHERE ri.id = v_item_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ligne introuvable: %', v_item_id;
    END IF;

    IF v_eff IS DISTINCT FROM 'to_order'::public.availability_status_enum THEN
      RAISE EXCEPTION 'Ligne incompatible (disponibilité non « à commander »)';
    END IF;

    IF v_cur = 'arrived_reserved'::public.post_confirm_fulfillment_enum THEN
      CONTINUE;
    END IF;

    IF v_cur = 'unset'::public.post_confirm_fulfillment_enum THEN
      IF v_exp IS NULL THEN
        RAISE EXCEPTION 'Date de réception prévue obligatoire avant marquage « commandé »';
      END IF;
      PERFORM public.pharmacist_set_post_confirm_fulfillment(
        v_item_id,
        'ordered'::public.post_confirm_fulfillment_enum
      );
    END IF;

    PERFORM public.pharmacist_set_post_confirm_fulfillment(
      v_item_id,
      'arrived_reserved'::public.post_confirm_fulfillment_enum
    );
    v_applied := v_applied + 1;
  END LOOP;

  RETURN v_applied;
END;
$$;

COMMENT ON FUNCTION public.pharmacist_apply_ordered_supply_arrival(uuid[]) IS
  'Hub produits commandés : marque les lignes sélectionnées comme reçues en officine (unset→ordered→arrived_reserved).';

-- ---------------------------------------------------------------------------
-- Annuler réception en officine (bulk) — repasse arrived_reserved → ordered
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pharmacist_revert_ordered_supply_arrival(p_item_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_item_id uuid;
  v_cur public.post_confirm_fulfillment_enum;
  v_counter public.counter_line_outcome_enum;
  v_reverted integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_item_ids IS NULL OR cardinality(p_item_ids) = 0 THEN
    RAISE EXCEPTION 'Aucune ligne sélectionnée';
  END IF;

  FOREACH v_item_id IN ARRAY p_item_ids LOOP
    SELECT ri.post_confirm_fulfillment, ri.counter_outcome
    INTO v_cur, v_counter
    FROM public.request_items ri
    WHERE ri.id = v_item_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ligne introuvable: %', v_item_id;
    END IF;

    IF v_cur IS DISTINCT FROM 'arrived_reserved'::public.post_confirm_fulfillment_enum THEN
      CONTINUE;
    END IF;

    IF v_counter IS DISTINCT FROM 'unset'::public.counter_line_outcome_enum THEN
      RAISE EXCEPTION 'Impossible d''annuler : retrait comptoir déjà enregistré sur une ligne sélectionnée';
    END IF;

    PERFORM public.pharmacist_set_post_confirm_fulfillment(
      v_item_id,
      'ordered'::public.post_confirm_fulfillment_enum
    );
    v_reverted := v_reverted + 1;
  END LOOP;

  RETURN v_reverted;
END;
$$;

COMMENT ON FUNCTION public.pharmacist_revert_ordered_supply_arrival(uuid[]) IS
  'Hub produits commandés : annule le marquage « reçu en officine » (arrived_reserved → ordered) avec notif patient existante.';

REVOKE ALL ON FUNCTION public.pharmacist_ordered_supply_hub_lines() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pharmacist_ordered_supply_hub_lines() TO authenticated;

REVOKE ALL ON FUNCTION public.pharmacist_apply_ordered_supply_arrival(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pharmacist_apply_ordered_supply_arrival(uuid[]) TO authenticated;

REVOKE ALL ON FUNCTION public.pharmacist_revert_ordered_supply_arrival(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pharmacist_revert_ordered_supply_arrival(uuid[]) TO authenticated;
