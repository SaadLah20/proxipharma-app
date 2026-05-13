-- Retrait « récupéré » au comptoir : entrée request_status_history uniquement, aucune notification in-app.

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
    'submitted', 'in_review', 'responded', 'confirmed', 'treated', 'completed',
    'cancelled', 'abandoned', 'expired'
  ) THEN
    RETURN new;
  END IF;

  IF new.reason = 'counter_outcome:picked_up' THEN
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
      'treated'
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

  IF new.new_status IN ('submitted', 'confirmed', 'treated', 'abandoned', 'cancelled', 'expired')
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
    WHERE ps.pharmacy_id = v_req.pharmacy_id
      AND p.role = 'pharmacien'
      AND (new.changed_by IS NULL OR ps.user_id IS DISTINCT FROM new.changed_by)
    ON CONFLICT (source_status_history_id, recipient_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$;

COMMENT ON FUNCTION public._emit_in_app_notifications_for_status_history() IS
  'Notifs patient + pharmacien sur journal statut ; pharmacien : exclut changed_by ; pas de notif pour counter_outcome:picked_up (retrait enregistré au comptoir).';
