-- Statuts dossier après validation patient : préparation officine (processing) puis traitée (pickup synchrone).
-- Lignes : withdrawn_after_confirm (traçabilité), journal request_supply_amendments (canal + motif par entrée).

-- ---------------------------------------------------------------------------
-- Enum request_status_enum : processing, treated
-- ---------------------------------------------------------------------------
DO $enum$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'request_status_enum' AND e.enumlabel = 'processing'
  ) THEN
    ALTER TYPE public.request_status_enum ADD VALUE 'processing';
  END IF;
END;
$enum$;

DO $enum2$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'request_status_enum' AND e.enumlabel = 'treated'
  ) THEN
    ALTER TYPE public.request_status_enum ADD VALUE 'treated';
  END IF;
END;
$enum2$;

ALTER TABLE public.request_items
  ADD COLUMN IF NOT EXISTS withdrawn_after_confirm boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.request_items.withdrawn_after_confirm IS
  'Après confirmed : ligne écartée avec accord patient tracé (reste lisible dans le dossier).';

CREATE TABLE IF NOT EXISTS public.request_supply_amendments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  amendments jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS request_supply_amendments_request_id_idx
  ON public.request_supply_amendments (request_id, created_at DESC);

COMMENT ON TABLE public.request_supply_amendments IS
  'Après validated client : entrées métier nécessitant un canal de confirmation (JSON array).';

ALTER TABLE public.request_supply_amendments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS request_supply_amendments_select ON public.request_supply_amendments;
CREATE POLICY request_supply_amendments_select
  ON public.request_supply_amendments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.requests r
      WHERE r.id = request_supply_amendments.request_id
        AND (
          r.patient_id = auth.uid()
          OR public.is_admin()
          OR EXISTS (
            SELECT 1 FROM public.pharmacy_staff ps
            WHERE ps.pharmacy_id = r.pharmacy_id AND ps.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS request_supply_amendments_insert ON public.request_supply_amendments;
CREATE POLICY request_supply_amendments_insert
  ON public.request_supply_amendments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.requests r
      WHERE r.id = request_supply_amendments.request_id
        AND (
          public.is_admin()
          OR EXISTS (
            SELECT 1
            FROM public.pharmacy_staff ps
            JOIN public.profiles p ON p.id = ps.user_id
            WHERE ps.pharmacy_id = r.pharmacy_id
              AND ps.user_id = auth.uid()
              AND p.role = 'pharmacien'
          )
        )
    )
  );

GRANT SELECT ON public.request_supply_amendments TO authenticated;

-- Canal texte pour flexibilité (évolution labels UI sans ALTER TYPE).

CREATE OR REPLACE FUNCTION public.pharmacist_record_supply_amendments(
  p_request_id uuid,
  p_amendments jsonb
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
  elem jsonb;
  v_ch text;
  v_n int;
  i int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_amendments IS NULL OR jsonb_typeof(p_amendments) <> 'array' OR jsonb_array_length(p_amendments) < 1 THEN
    RAISE EXCEPTION 'Liste d''entrées vide ou invalide.';
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
    'processing'::public.request_status_enum,
    'treated'::public.request_status_enum
  ) THEN
    RAISE EXCEPTION 'Amendements autorisés seulement en confirmed, processing ou treated (statut courant %).', v_old;
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

  v_n := jsonb_array_length(p_amendments);
  FOR i IN 0..(v_n - 1) LOOP
    elem := p_amendments -> i;
    v_ch := nullif(trim(coalesce(elem->>'client_confirmation_channel', '')), '');
    IF v_ch IS NULL OR length(v_ch) < 2 THEN
      RAISE EXCEPTION 'Canal client obligatoire sur chaque entrée (entrée %).', i + 1;
    END IF;
    IF length(v_ch) > 80 THEN
      RAISE EXCEPTION 'Canal client trop long (80 car max).';
    END IF;
  END LOOP;

  INSERT INTO public.request_supply_amendments (request_id, created_by, amendments)
  VALUES (p_request_id, v_uid, p_amendments);

  IF v_old = 'confirmed'::public.request_status_enum THEN
    UPDATE public.requests SET status = 'processing', updated_at = now()
    WHERE id = p_request_id;
    PERFORM public._log_request_status_change(p_request_id, v_old, 'processing', v_uid, 'pharmacist_supply_amendments_saved');
  END IF;
  -- Pas de transition treated -> processing lors d’un nouvel amendement après déclaration de traitée.
END;
$$;

COMMENT ON FUNCTION public.pharmacist_record_supply_amendments(uuid, jsonb) IS
  'Journalise des ajustements post-validation (+ canal confirmation) ; confirmed -> processing au premier bundle.';

REVOKE ALL ON FUNCTION public.pharmacist_record_supply_amendments(uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.pharmacist_record_supply_amendments(uuid, jsonb) TO authenticated;

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
      IF v_pcf IS DISTINCT FROM 'ordered'::public.post_confirm_fulfillment_enum THEN
        v_bad := v_bad + 1;
      END IF;
    ELSE
      v_bad := v_bad + 1;
    END IF;
  END LOOP;

  IF v_bad > 0 THEN
    RAISE EXCEPTION 'Toutes les lignes retenues non retirées doivent être « réservé » ou « commandé » selon la voie officine/commande.';
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

COMMENT ON FUNCTION public.pharmacist_mark_request_treated(uuid) IS
  'Pharmacien : déclaration préparation terminée (lignes retenues = réservé/commandé ou retirées tracées).';

REVOKE ALL ON FUNCTION public.pharmacist_mark_request_treated(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.pharmacist_mark_request_treated(uuid) TO authenticated;

-- Fulfillment après validation → autoriser processing/treated aussi ; passer en processing si encore confirmed à la première saisie.
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
    END AS eff_exp
  INTO v_req_id, v_selected, v_chosen_alt, v_eff, v_exp
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
  END IF;

  UPDATE public.request_items
  SET post_confirm_fulfillment = p_fulfillment, updated_at = now()
  WHERE id = p_request_item_id;

  IF v_status = 'confirmed'::public.request_status_enum
     AND p_fulfillment IN ('reserved'::public.post_confirm_fulfillment_enum, 'ordered'::public.post_confirm_fulfillment_enum) THEN
    UPDATE public.requests SET status = 'processing', updated_at = now() WHERE id = v_req_id;
    PERFORM public._log_request_status_change(v_req_id, v_status, 'processing', v_uid, 'pharmacist_post_confirm_fulfillment_started');
  END IF;
END;
$$;

-- Passage officine après validation patient : élargissement statuts dossier autorisés
CREATE OR REPLACE FUNCTION public.patient_update_planned_visit_after_confirmation(
  p_request_id uuid,
  p_planned_visit_date date,
  p_planned_visit_time text DEFAULT NULL
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
  v_today date;
  v_any_to_order boolean := false;
  v_max_eta date;
  v_row record;
  v_eff public.availability_status_enum;
  v_exp date;
  v_visit_time time without time zone;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT status, patient_id INTO v_old, v_patient
  FROM public.requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_patient <> v_uid THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF v_old NOT IN ('confirmed'::public.request_status_enum, 'processing'::public.request_status_enum, 'treated'::public.request_status_enum) THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  IF p_planned_visit_date IS NULL THEN
    RAISE EXCEPTION 'Date de passage obligatoire';
  END IF;

  IF p_planned_visit_time IS NOT NULL AND nullif(trim(p_planned_visit_time), '') IS NOT NULL THEN
    BEGIN
      v_visit_time := nullif(trim(p_planned_visit_time), '')::time without time zone;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Heure de passage invalide (format HH:MM attendu)';
    END;
  ELSE
    v_visit_time := NULL;
  END IF;

  FOR v_row IN
    SELECT
      ri.id AS item_id,
      ri.is_selected_by_patient,
      ri.withdrawn_after_confirm,
      ri.patient_chosen_alternative_id,
      ri.availability_status AS base_av,
      ri.expected_availability_date AS base_exp
    FROM public.request_items ri
    WHERE ri.request_id = p_request_id
  LOOP
    IF NOT coalesce(v_row.is_selected_by_patient, false) THEN
      CONTINUE;
    END IF;
    IF coalesce(v_row.withdrawn_after_confirm, false) THEN
      CONTINUE;
    END IF;

    v_eff := v_row.base_av;
    v_exp := v_row.base_exp;

    IF v_row.patient_chosen_alternative_id IS NOT NULL THEN
      SELECT a.availability_status, a.expected_availability_date
      INTO v_eff, v_exp
      FROM public.request_item_alternatives a
      WHERE a.id = v_row.patient_chosen_alternative_id AND a.request_item_id = v_row.item_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Alternative invalide pour une ligne sélectionnée';
      END IF;
    END IF;

    IF v_eff = 'to_order'::public.availability_status_enum THEN
      v_any_to_order := true;
      IF v_exp IS NULL THEN
        RAISE EXCEPTION 'Produit à commander sans date de réception prévue — contactez la pharmacie.';
      END IF;
      IF v_max_eta IS NULL OR v_exp > v_max_eta THEN
        v_max_eta := v_exp;
      END IF;
    END IF;
  END LOOP;

  v_today := (timezone('Africa/Casablanca', now()))::date;

  IF p_planned_visit_date < v_today THEN
    RAISE EXCEPTION 'La date de passage ne peut être antérieure à aujourd’hui.';
  END IF;

  IF NOT v_any_to_order THEN
    IF p_planned_visit_date > v_today + 4 THEN
      RAISE EXCEPTION 'Sans produit « à commander » dans votre sélection, choisissez une date dans les 4 jours suivants.';
    END IF;
  ELSE
    IF p_planned_visit_date > v_max_eta + 3 THEN
      RAISE EXCEPTION 'Avec produit(s) à commander, la date de passage doit être au plus 3 jours après la dernière date de réception indiquée (%).', v_max_eta;
    END IF;
  END IF;

  UPDATE public.requests
  SET patient_planned_visit_date = p_planned_visit_date, patient_planned_visit_time = v_visit_time, updated_at = now()
  WHERE id = p_request_id;

  PERFORM public._log_request_status_change(p_request_id, v_old, v_old, v_uid, 'patient_planned_visit_updated');
END;
$$;

-- Annulation pharmacien : processing et treated possibles aussi
CREATE OR REPLACE FUNCTION public.pharmacist_cancel_request(
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
  v_is_staff boolean := false;
  v_log text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_reason IS NULL OR length(v_reason) < 5 THEN
    RAISE EXCEPTION 'Motif d''annulation obligatoire (5 caractères minimum).';
  END IF;

  IF length(v_reason) > 2000 THEN
    RAISE EXCEPTION 'Motif d''annulation trop long.';
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
    'submitted'::public.request_status_enum,
    'in_review'::public.request_status_enum,
    'responded'::public.request_status_enum,
    'confirmed'::public.request_status_enum,
    'processing'::public.request_status_enum,
    'treated'::public.request_status_enum
  ) THEN
    RAISE EXCEPTION 'Cannot cancel from status %', v_old;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.pharmacy_staff ps
    WHERE ps.user_id = v_uid AND ps.pharmacy_id = v_pharmacy
  )
  INTO v_is_staff;

  IF NOT v_is_staff THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  v_log := format('pharmacist_cancel|%s', v_reason);

  UPDATE public.requests
  SET status = 'cancelled', cancelled_at = now(), updated_at = now()
  WHERE id = p_request_id;

  PERFORM public._log_request_status_change(p_request_id, v_old, 'cancelled', v_uid, v_log);
END;
$$;

-- Abandon patient : même logique après validation pour processing / traitée
CREATE OR REPLACE FUNCTION public.patient_abandon_request(
  p_request_id uuid,
  p_reason_code text,
  p_reason_other text DEFAULT NULL
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
  v_log text;
  v_other text := nullif(trim(p_reason_other), '');
  v_has_pickup boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_reason_code NOT IN ('no_longer_needed', 'found_elsewhere', 'price', 'delay', 'mistake', 'other') THEN
    RAISE EXCEPTION 'Motif inconnu.';
  END IF;

  IF p_reason_code = 'other' THEN
    IF v_other IS NULL OR length(v_other) < 8 THEN
      RAISE EXCEPTION 'Précise le motif (« autre ») en au moins 8 caractères.';
    END IF;
    IF length(v_other) > 2000 THEN
      RAISE EXCEPTION 'Texte trop long.';
    END IF;
  ELSE
    IF v_other IS NOT NULL AND length(v_other) > 2000 THEN
      RAISE EXCEPTION 'Texte trop long.';
    END IF;
  END IF;

  SELECT status, patient_id INTO v_old, v_patient
  FROM public.requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_patient <> v_uid THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF v_old NOT IN ('responded'::public.request_status_enum, 'confirmed'::public.request_status_enum,
                   'processing'::public.request_status_enum, 'treated'::public.request_status_enum) THEN
    RAISE EXCEPTION 'Cannot abandon from status %', v_old;
  END IF;

  v_log := format('patient_abandon|%s|%s', p_reason_code, coalesce(v_other, ''));

  IF v_old = 'responded' THEN
    UPDATE public.requests
    SET status = 'cancelled', cancelled_at = now(), updated_at = now()
    WHERE id = p_request_id;

    PERFORM public._log_request_status_change(p_request_id, v_old, 'cancelled', v_uid, v_log);
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.request_items ri
    WHERE ri.request_id = p_request_id
      AND ri.is_selected_by_patient = true
      AND ri.counter_outcome = 'picked_up'::public.counter_line_outcome_enum
  )
  INTO v_has_pickup;

  IF v_has_pickup THEN
    UPDATE public.requests SET status = 'completed', updated_at = now() WHERE id = p_request_id;
    PERFORM public._log_request_status_change(p_request_id, v_old, 'completed'::public.request_status_enum, v_uid, v_log || '|after_pickup');
    RETURN;
  END IF;

  UPDATE public.requests SET status = 'abandoned', updated_at = now() WHERE id = p_request_id;
  PERFORM public._log_request_status_change(p_request_id, v_old, 'abandoned', v_uid, v_log);
END;
$$;

-- Comptoir : pickup une fois dossier traitée (legacy : confirmed encore autorisée)
CREATE OR REPLACE FUNCTION public.pharmacist_set_item_counter_outcome(
  p_request_item_id uuid,
  p_outcome text,
  p_cancel_reason text DEFAULT NULL,
  p_cancel_detail text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_new public.counter_line_outcome_enum;
  v_reason public.counter_cancel_reason_enum;
  v_detail text;
  v_req_id uuid;
  v_st public.request_status_enum;
  v_pharmacy uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  BEGIN
    v_new := p_outcome::public.counter_line_outcome_enum;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Invalid outcome %', p_outcome;
  END;

  v_detail := nullif(btrim(p_cancel_detail), '');
  IF v_detail IS NOT NULL AND length(v_detail) > 1000 THEN
    RAISE EXCEPTION 'Détail trop long (1000 caractères max).';
  END IF;

  IF v_new = 'cancelled_at_counter'::public.counter_line_outcome_enum THEN
    IF p_cancel_reason IS NULL OR btrim(p_cancel_reason) = '' THEN
      RAISE EXCEPTION 'Précisez la raison (client_request ou pharmacy_unable).';
    END IF;
    BEGIN
      v_reason := p_cancel_reason::public.counter_cancel_reason_enum;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Raison d''annulation inconnue : %', p_cancel_reason;
    END;
  ELSE
    v_reason := NULL;
    v_detail := NULL;
  END IF;

  SELECT ri.request_id, r.status, r.pharmacy_id
  INTO v_req_id, v_st, v_pharmacy
  FROM public.request_items ri
  JOIN public.requests r ON r.id = ri.request_id
  WHERE ri.id = p_request_item_id;

  IF v_req_id IS NULL THEN
    RAISE EXCEPTION 'Request item not found';
  END IF;

  IF NOT public.is_admin() AND NOT EXISTS (
    SELECT 1 FROM public.pharmacy_staff ps
    JOIN public.profiles p ON p.id = ps.user_id
    WHERE ps.pharmacy_id = v_pharmacy AND ps.user_id = v_uid AND p.role = 'pharmacien'
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF v_st NOT IN (
    'responded'::public.request_status_enum,
    'confirmed'::public.request_status_enum,
    'processing'::public.request_status_enum,
    'treated'::public.request_status_enum
  ) THEN
    RAISE EXCEPTION 'Counter updates not allowed from status %', v_st;
  END IF;

  UPDATE public.request_items
  SET
    counter_outcome = v_new,
    counter_cancel_reason = v_reason,
    counter_cancel_detail = v_detail,
    updated_at = now()
  WHERE id = p_request_item_id;
END;
$$;

-- Clôture comptoir (legacy confirmed + tratée après flux moderne)
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
  v_bad int;
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
    'processing'::public.request_status_enum,
    'treated'::public.request_status_enum
  ) THEN
    RAISE EXCEPTION 'Cannot complete from status %', v_old;
  END IF;

  SELECT count(*)::int INTO v_bad
  FROM public.request_items
  WHERE request_id = p_request_id
    AND is_selected_by_patient = true
    AND coalesce(withdrawn_after_confirm, false) = false
    AND counter_outcome IN (
      'unset'::public.counter_line_outcome_enum,
      'deferred_next_visit'::public.counter_line_outcome_enum
    );

  IF v_bad > 0 THEN
    RAISE EXCEPTION 'Réglage comptoir requis: lignes encore « non traitées » ou « plus tard ».';
  END IF;

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

-- Notifications in-app : processing & treated
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
  v_motif text;
BEGIN
  IF p_history_reason = 'patient_planned_visit_updated' THEN
    n_title := 'Passage en pharmacie mis à jour';
    n_body :=
      'Pharmacie : ' || coalesce(p_pharma_nom, '—')
      || ' · ' || coalesce(p_pharma_ville, '—')
      || E'\nNature : ' || p_nature
      || E'\nMis à jour le : ' || p_when_fr
      || E'\n\n'
      || E'Votre créneau de passage prévu a été modifié. Ouvrez la demande pour voir le détail.';
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_status = 'responded'::public.request_status_enum
     AND p_history_reason IS NOT NULL
     AND p_history_reason = 'pharmacist_response_updated' THEN
    n_title := 'Le pharmacien a mis à jour sa réponse';
    n_body :=
      'Pharmacie : ' || coalesce(p_pharma_nom, '—')
      || ' · ' || coalesce(p_pharma_ville, '—')
      || E'\nNature : ' || p_nature
      || E'\nMis à jour le : ' || p_when_fr
      || E'\n\n'
      || E'Ouvrez la demande pour consulter les changements et ajuster votre choix si besoin.';
    RETURN NEXT;
    RETURN;
  END IF;

  n_title :=
    CASE p_status
      WHEN 'in_review' THEN 'Votre demande est en cours de traitement'
      WHEN 'responded' THEN 'La pharmacie vous a répondu'
      WHEN 'processing' THEN 'Votre commande validée est en préparation'
      WHEN 'treated' THEN 'Votre dossier est prêt pour le comptoir'
      WHEN 'completed' THEN 'Votre demande est clôturée'
      WHEN 'cancelled' THEN 'Votre demande a été annulée'
      WHEN 'abandoned' THEN 'Votre demande a été abandonnée'
      WHEN 'expired' THEN 'Votre demande a expiré'
      ELSE 'Mise à jour de votre demande'
    END;

  v_motif := NULL;
  IF p_history_reason IS NOT NULL AND p_history_reason LIKE 'pharmacist_cancel|%' THEN
    v_motif := substring(p_history_reason FROM char_length('pharmacist_cancel|') + 1);
  END IF;

  n_body :=
    'Pharmacie : ' || coalesce(p_pharma_nom, '—')
    || ' · ' || coalesce(p_pharma_ville, '—')
    || E'\nNature : ' || p_nature
    || E'\nMis à jour le : ' || p_when_fr
    || E'\n\n'
    || CASE p_status
      WHEN 'in_review' THEN
        E'L''officine traite votre dossier. Vous recevrez une notification dès qu''une réponse sera disponible.'
      WHEN 'responded' THEN
        E'Vous pouvez ouvrir la demande pour valider la proposition ou demander une modification.'
      WHEN 'processing' THEN
        E'La pharmacie actualise votre commande après validation ; consultez les détails sur la demande.'
      WHEN 'treated' THEN
        E'Deux étapes suivent : suivre vos produits récupérables au passage ou au comptoir. Ouvrez la demande pour le détail.'
      WHEN 'completed' THEN
        E'Merci d''avoir utilisé ProxiPharma. Conservez ce dossier pour votre suivi si besoin.'
      WHEN 'cancelled' THEN
        CASE
          WHEN v_motif IS NOT NULL AND btrim(v_motif) <> '' THEN
            E'La pharmacie a annulé cette demande.' || E'\n\nMotif : ' || btrim(v_motif)
          ELSE
            E'La demande ne sera plus suivie.'
        END
      WHEN 'abandoned' THEN
        E'Le dossier a été abandonné (délai ou autre motif). Contactez la pharmacie en cas de doute.'
      WHEN 'expired' THEN
        E'Le délai de traitement est dépassé. Vous pouvez relancer une nouvelle demande.'
      ELSE
        E'Consultez le détail de la demande pour plus d''informations.'
    END;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public._in_app_notification_pharmacist(
  p_status public.request_status_enum,
  p_old_status public.request_status_enum,
  p_pharma_nom text,
  p_pharma_ville text,
  p_patient_nom text,
  p_nature text,
  p_when_fr text,
  p_history_reason text DEFAULT NULL
)
RETURNS TABLE (n_title text, n_body text)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_is_update_submitted boolean := false;
  v_ph_cancel_motif text;
BEGIN
  v_is_update_submitted :=
    p_status = 'submitted'
    AND p_old_status IS NOT NULL
    AND p_old_status <> 'draft';

  IF p_history_reason IS NOT NULL AND p_history_reason LIKE 'pharmacist_cancel|%' THEN
    v_ph_cancel_motif := substring(p_history_reason FROM char_length('pharmacist_cancel|') + 1);
  ELSE
    v_ph_cancel_motif := NULL;
  END IF;

  n_title :=
    CASE p_status
      WHEN 'submitted' THEN
        CASE WHEN v_is_update_submitted THEN 'Le patient a mis à jour sa demande' ELSE 'Vous avez une nouvelle demande à traiter' END
      WHEN 'confirmed' THEN 'Le patient a validé votre proposition'
      WHEN 'processing' THEN 'Suivi dossier après validation patient'
      WHEN 'treated' THEN 'Dossier traité — retraits comptoir'
      WHEN 'cancelled' THEN
        CASE WHEN v_ph_cancel_motif IS NOT NULL AND btrim(v_ph_cancel_motif) <> '' THEN 'Demande annulée par l''officine' ELSE 'Une demande a été annulée' END
      WHEN 'abandoned' THEN 'Une demande a été abandonnée'
      WHEN 'expired' THEN 'Une demande a expiré (sans validation patient)'
      ELSE 'Mise à jour d''une demande'
    END;

  n_body :=
    'Votre officine : ' || coalesce(p_pharma_nom, '—')
    || ' · ' || coalesce(p_pharma_ville, '—')
    || E'\nPatient : ' || coalesce(p_patient_nom, '—')
    || E'\nNature : ' || p_nature
    || E'\nÉvénement le : ' || p_when_fr
    || E'\n\n'
    || CASE p_status
      WHEN 'submitted' THEN
        CASE WHEN v_is_update_submitted THEN E'Ouvrez la demande pour la version à jour.' ELSE E'Ouvrez la demande pour préparer votre réponse.' END
      WHEN 'confirmed' THEN E'Le patient a confirmé la sélection. Vous pouvez poursuivre la préparation.'
      WHEN 'processing' THEN E'Le dossier figure en préparation officine après validation.'
      WHEN 'treated' THEN E'Le patient doit pouvoir passer au comptoir. Indiquez les retraits ligne par ligne jusqu''à la clôture.'
      WHEN 'cancelled' THEN
        CASE WHEN v_ph_cancel_motif IS NOT NULL AND btrim(v_ph_cancel_motif) <> '' THEN E'Motif enregistré : ' || btrim(v_ph_cancel_motif) ELSE E'La demande est passée en annulée.' END
      WHEN 'abandoned' THEN E'Demande abandonnée côté patient.'
      WHEN 'expired' THEN E'Délai dépassé sans action du patient.'
      ELSE E'Consultez le dossier.'
    END;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public._emit_in_app_notifications_for_status_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.requests%rowtype;
  v_pharma_nom text;
  v_pharma_ville text;
  v_patient_nom text;
  v_nature text;
  v_when_fr text;
  v_title_pat text;
  v_body_pat text;
  v_title_ph text;
  v_body_ph text;
BEGIN
  IF new.new_status NOT IN (
    'submitted', 'in_review', 'responded', 'confirmed', 'processing', 'treated', 'completed',
    'cancelled', 'abandoned', 'expired'
  ) THEN
    RETURN new;
  END IF;

  SELECT r.* INTO v_req FROM public.requests r WHERE r.id = new.request_id;
  IF NOT FOUND THEN RETURN new; END IF;

  SELECT ph.nom, ph.ville INTO v_pharma_nom, v_pharma_ville FROM public.pharmacies ph WHERE ph.id = v_req.pharmacy_id;

  SELECT coalesce(nullif(btrim(p.full_name::text), ''), 'Patient') INTO v_patient_nom FROM public.profiles p WHERE p.id = v_req.patient_id;

  v_nature := public._request_type_label_fr(v_req.request_type);
  v_when_fr := to_char(new.created_at AT TIME ZONE 'Africa/Casablanca', 'DD/MM/YYYY à HH24:MI');

  IF new.new_status IN (
      'responded', 'completed', 'cancelled', 'abandoned', 'expired',
      'processing', 'treated'
    )
     OR new.reason = 'patient_planned_visit_updated' THEN
    SELECT t.n_title, t.n_body INTO v_title_pat, v_body_pat
    FROM public._in_app_notification_patient(
      new.new_status,
      v_pharma_nom,
      v_pharma_ville,
      v_nature,
      v_when_fr,
      new.reason
    ) AS t;

    INSERT INTO public.app_notifications (
      recipient_id, request_id, source_status_history_id, event_type, title, body
    )
    VALUES (
      v_req.patient_id,
      new.request_id,
      new.id,
      CASE
        WHEN new.reason = 'patient_planned_visit_updated' THEN 'request_event:patient_planned_visit_updated'
        ELSE 'request_status:' || new.new_status::text
      END,
      v_title_pat,
      v_body_pat
    )
    ON CONFLICT (source_status_history_id, recipient_id) DO NOTHING;
  END IF;

  IF new.new_status IN ('submitted', 'confirmed', 'processing', 'treated', 'abandoned', 'cancelled', 'expired')
     AND NOT (
       new.old_status = 'confirmed'::public.request_status_enum
       AND new.new_status = 'confirmed'::public.request_status_enum
       AND new.reason = 'patient_planned_visit_updated'
     )
  THEN
    SELECT t.n_title, t.n_body INTO v_title_ph, v_body_ph
    FROM public._in_app_notification_pharmacist(
      new.new_status,
      new.old_status,
      v_pharma_nom,
      v_pharma_ville,
      v_patient_nom,
      v_nature,
      v_when_fr,
      new.reason
    ) AS t;

    INSERT INTO public.app_notifications (
      recipient_id, request_id, source_status_history_id, event_type, title, body
    )
    SELECT
      ps.user_id,
      new.request_id,
      new.id,
      'request_status:' || new.new_status::text,
      v_title_ph,
      v_body_ph
    FROM public.pharmacy_staff ps
    JOIN public.profiles p ON p.id = ps.user_id
    WHERE ps.pharmacy_id = v_req.pharmacy_id AND p.role = 'pharmacien'
    ON CONFLICT (source_status_history_id, recipient_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$;
