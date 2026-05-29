-- « Reçu en officine » (arrived_reserved) sans exiger « Commandé » au préalable.
-- Depuis 20260628_001, le pharmacien déclare la demande « traitée » et toutes les
-- lignes retenues sont implicitement réservées / commandées : marquer « Reçu en
-- officine » ne doit plus être bloqué par l'étape « Commandé ».
--
-- Basé sur la dernière version effective (20260601_001) : conserve la journalisation
-- post_confirm_product_arrived / post_confirm_arrival_cancelled (notif patient).
-- Seul changement : suppression de l'exigence « état Commandé » avant « reçu ».

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
  v_reason text;
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
    ON ria.id = ri.patient_chosen_alternative_id AND ria.request_item_id = ri.id
  WHERE ri.id = p_request_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ligne introuvable';
  END IF;

  IF NOT coalesce(v_selected, false) THEN
    RAISE EXCEPTION 'Ligne non retenue par le patient';
  END IF;

  SELECT r.status, r.pharmacy_id INTO v_status, v_pharmacy
  FROM public.requests r WHERE r.id = v_req_id;

  IF v_status NOT IN ('confirmed'::public.request_status_enum, 'treated'::public.request_status_enum) THEN
    RAISE EXCEPTION 'Statut demande incompatible';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.pharmacy_staff ps
    JOIN public.profiles p ON p.id = ps.user_id
    WHERE ps.pharmacy_id = v_pharmacy AND ps.user_id = v_uid AND p.role = 'pharmacien'
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
    -- « Reçu en officine » : seule contrainte = ligne à commander.
    -- Plus d'exigence d'un état « Commandé » préalable (réservé/commandé implicite après « traitée »).
    IF v_eff IS DISTINCT FROM 'to_order'::public.availability_status_enum THEN
      RAISE EXCEPTION '« Reçu en officine » uniquement pour une ligne à commander.';
    END IF;
  END IF;

  UPDATE public.request_items
  SET post_confirm_fulfillment = p_fulfillment, updated_at = now()
  WHERE id = p_request_item_id;

  IF p_fulfillment = 'arrived_reserved'::public.post_confirm_fulfillment_enum
     AND v_cur IS DISTINCT FROM 'arrived_reserved'::public.post_confirm_fulfillment_enum
  THEN
    v_reason := 'post_confirm_product_arrived|' || p_request_item_id::text;
    PERFORM public._log_request_status_change(v_req_id, v_status, v_status, v_uid, v_reason);
  ELSIF v_cur = 'arrived_reserved'::public.post_confirm_fulfillment_enum
     AND p_fulfillment = 'ordered'::public.post_confirm_fulfillment_enum
  THEN
    v_reason := 'post_confirm_arrival_cancelled|' || p_request_item_id::text;
    PERFORM public._log_request_status_change(v_req_id, v_status, v_status, v_uid, v_reason);
  END IF;
END;
$$;

COMMENT ON FUNCTION public.pharmacist_set_post_confirm_fulfillment(uuid, public.post_confirm_fulfillment_enum) IS
  'Après validation : réservé / commandé / reçu en officine ; « reçu » sans pré-requis « commandé » ; journalise arrivée/annulation produit.';
