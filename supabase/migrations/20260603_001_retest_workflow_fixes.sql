-- Retours test terrain (2026-06-03) : RPC amendements 3 parcours, notifs patient ciblées.

-- Amendements post-validation : tous types « lignes produits », sans notif patient (audit table seulement).
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

  IF NOT public._request_uses_product_line_workflow(v_type) THEN
    RAISE EXCEPTION 'Unsupported request type';
  END IF;

  IF v_old NOT IN ('confirmed'::public.request_status_enum, 'treated'::public.request_status_enum) THEN
    RAISE EXCEPTION 'Amendements autorisés seulement en confirmed ou treated (statut courant %).', v_old;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.pharmacy_staff ps
    JOIN public.profiles p ON p.id = ps.user_id
    WHERE ps.pharmacy_id = v_pharmacy AND ps.user_id = v_uid AND p.role = 'pharmacien'
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
END;
$$;

COMMENT ON FUNCTION public.pharmacist_record_supply_amendments(uuid, jsonb) IS
  'Journal amendements post-validation (product_request, prescription, consultation) ; pas de notification patient.';

-- Notifs patient : statuts métier + réponse publiée + produit reçu en officine uniquement.
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
  v_event_pat text;
BEGIN
  IF new.reason = 'counter_outcome:picked_up' THEN
    RETURN new;
  END IF;

  SELECT r.* INTO v_req FROM public.requests r WHERE r.id = new.request_id;
  IF NOT FOUND THEN RETURN new; END IF;

  SELECT ph.nom, ph.ville INTO v_pharma_nom, v_pharma_ville FROM public.pharmacies ph WHERE ph.id = v_req.pharmacy_id;
  SELECT coalesce(nullif(btrim(p.full_name::text), ''), 'Patient') INTO v_patient_nom FROM public.profiles p WHERE p.id = v_req.patient_id;
  v_nature := public._request_type_label_fr(v_req.request_type);
  v_when_fr := to_char(new.created_at AT TIME ZONE 'Africa/Casablanca', 'DD/MM/YYYY à HH24:MI');

  IF new.reason = 'patient_planned_visit_updated' THEN
    SELECT t.n_title, t.n_body INTO v_title_pat, v_body_pat
    FROM public._in_app_notification_patient(new.new_status, v_pharma_nom, v_pharma_ville, v_nature, v_when_fr, new.reason) AS t;
    INSERT INTO public.app_notifications (recipient_id, request_id, source_status_history_id, event_type, title, body)
    VALUES (v_req.patient_id, new.request_id, new.id, 'request_event:patient_planned_visit_updated', v_title_pat, v_body_pat)
    ON CONFLICT (source_status_history_id, recipient_id) DO NOTHING;

    SELECT t.n_title, t.n_body INTO v_title_ph, v_body_ph
    FROM public._in_app_notification_pharmacist(
      new.new_status, new.old_status, v_pharma_nom, v_pharma_ville, v_patient_nom, v_nature, v_when_fr, new.reason
    ) AS t;
    INSERT INTO public.app_notifications (recipient_id, request_id, source_status_history_id, event_type, title, body)
    SELECT ps.user_id, new.request_id, new.id, 'request_event:patient_planned_visit_updated', v_title_ph, v_body_ph
    FROM public.pharmacy_staff ps
    JOIN public.profiles p ON p.id = ps.user_id
    WHERE ps.pharmacy_id = v_req.pharmacy_id AND p.role = 'pharmacien'
      AND (new.changed_by IS NULL OR ps.user_id IS DISTINCT FROM new.changed_by)
    ON CONFLICT (source_status_history_id, recipient_id) DO NOTHING;
    RETURN new;
  END IF;

  IF new.reason = 'patient_prescription_updated' THEN
    SELECT t.n_title, t.n_body INTO v_title_ph, v_body_ph
    FROM public._in_app_notification_pharmacist(
      new.new_status, new.old_status, v_pharma_nom, v_pharma_ville, v_patient_nom, v_nature, v_when_fr, new.reason
    ) AS t;
    INSERT INTO public.app_notifications (recipient_id, request_id, source_status_history_id, event_type, title, body)
    SELECT ps.user_id, new.request_id, new.id, 'request_status:patient_prescription_updated', v_title_ph, v_body_ph
    FROM public.pharmacy_staff ps
    JOIN public.profiles p ON p.id = ps.user_id
    WHERE ps.pharmacy_id = v_req.pharmacy_id AND p.role = 'pharmacien'
      AND (new.changed_by IS NULL OR ps.user_id IS DISTINCT FROM new.changed_by)
    ON CONFLICT (source_status_history_id, recipient_id) DO NOTHING;
    RETURN new;
  END IF;

  IF new.new_status NOT IN (
    'submitted', 'in_review', 'responded', 'confirmed', 'completed',
    'cancelled', 'abandoned', 'expired', 'treated'
  ) THEN
    RETURN new;
  END IF;

  IF new.new_status IN ('responded', 'treated', 'completed', 'cancelled', 'abandoned', 'expired')
     OR new.reason = 'pharmacist_response_updated'
     OR (new.reason IS NOT NULL AND new.reason LIKE 'post_confirm_product_arrived|%')
  THEN
    SELECT t.n_title, t.n_body INTO v_title_pat, v_body_pat
    FROM public._in_app_notification_patient(new.new_status, v_pharma_nom, v_pharma_ville, v_nature, v_when_fr, new.reason) AS t;

    v_event_pat := CASE
      WHEN new.reason = 'pharmacist_response_updated' THEN 'request_event:pharmacist_response_updated'
      WHEN new.reason LIKE 'post_confirm_product_arrived|%' THEN 'request_event:post_confirm_product_arrived'
      ELSE 'request_status:' || new.new_status::text
    END;

    INSERT INTO public.app_notifications (recipient_id, request_id, source_status_history_id, event_type, title, body)
    VALUES (v_req.patient_id, new.request_id, new.id, v_event_pat, v_title_pat, v_body_pat)
    ON CONFLICT (source_status_history_id, recipient_id) DO NOTHING;
  END IF;

  IF new.new_status IN ('submitted', 'confirmed', 'treated', 'abandoned', 'cancelled', 'expired')
     AND coalesce(new.reason, '') IS DISTINCT FROM 'patient_planned_visit_updated'
     AND coalesce(new.reason, '') NOT LIKE 'post_confirm_product_arrived|%'
     AND coalesce(new.reason, '') IS DISTINCT FROM 'pharmacist_response_updated'
  THEN
    SELECT t.n_title, t.n_body INTO v_title_ph, v_body_ph
    FROM public._in_app_notification_pharmacist(
      new.new_status, new.old_status, v_pharma_nom, v_pharma_ville, v_patient_nom, v_nature, v_when_fr, new.reason
    ) AS t;

    INSERT INTO public.app_notifications (recipient_id, request_id, source_status_history_id, event_type, title, body)
    SELECT ps.user_id, new.request_id, new.id, 'request_status:' || new.new_status::text, v_title_ph, v_body_ph
    FROM public.pharmacy_staff ps
    JOIN public.profiles p ON p.id = ps.user_id
    WHERE ps.pharmacy_id = v_req.pharmacy_id AND p.role = 'pharmacien'
      AND (new.changed_by IS NULL OR ps.user_id IS DISTINCT FROM new.changed_by)
    ON CONFLICT (source_status_history_id, recipient_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$;
