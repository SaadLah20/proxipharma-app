-- Mise à jour d'une demande DÉJÀ traitée : ne plus envoyer une notif générique
-- « Demande traitée » au patient. La notif « traitée » ne doit partir QUE lors de
-- la vraie transition de statut (old_status <> 'treated'). Les mises à jour
-- treated -> treated dont le motif n'est pas un cas spécial (amendements, audit,
-- réception produit, etc.) ne déclenchent plus de notification patient trompeuse.
--
-- Recrée _emit_in_app_notifications_for_status_history (basé sur 20260614_001),
-- seul le garde de transition du bloc patient change.

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
  v_patient_supply_update boolean;
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

  v_patient_supply_update :=
    new.reason IS NOT NULL
    AND (
      new.reason LIKE 'pharmacist_supply_amendments_saved|%'
      OR new.reason = 'pharmacist_adjustments_after_confirmation'
      OR new.reason LIKE 'audit_v1:%'
    );

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

  -- Bloc patient. La notif de statut générique (responded / treated / completed / …)
  -- n'est émise que sur une vraie transition (new_status <> old_status). Les mises à
  -- jour same-status (ex. treated -> treated) ne passent que par les motifs spéciaux
  -- (amendements, audit, réception/annulation produit, réponse mise à jour).
  IF (
       (new.new_status IN ('responded', 'treated', 'completed', 'cancelled', 'abandoned', 'expired')
         AND new.new_status IS DISTINCT FROM new.old_status)
       OR new.reason = 'pharmacist_response_updated'
       OR (new.reason IS NOT NULL AND (
         new.reason LIKE 'post_confirm_product_arrived|%'
         OR new.reason LIKE 'post_confirm_arrival_cancelled|%'
       ))
       OR v_patient_supply_update
     )
  THEN
    SELECT t.n_title, t.n_body INTO v_title_pat, v_body_pat
    FROM public._in_app_notification_patient(new.new_status, v_pharma_nom, v_pharma_ville, v_nature, v_when_fr, new.reason) AS t;

    v_event_pat := CASE
      WHEN new.reason = 'pharmacist_response_updated' THEN 'request_event:pharmacist_response_updated'
      WHEN new.reason LIKE 'post_confirm_product_arrived|%' THEN 'request_event:post_confirm_product_arrived'
      WHEN new.reason LIKE 'post_confirm_arrival_cancelled|%' THEN 'request_event:post_confirm_arrival_cancelled'
      WHEN new.reason LIKE 'pharmacist_supply_amendments_saved|%' THEN 'request_event:pharmacist_supply_amendments_saved'
      WHEN v_patient_supply_update THEN 'request_event:pharmacist_validated_request_updated'
      ELSE 'request_status:' || new.new_status::text
    END;

    INSERT INTO public.app_notifications (recipient_id, request_id, source_status_history_id, event_type, title, body)
    VALUES (v_req.patient_id, new.request_id, new.id, v_event_pat, v_title_pat, v_body_pat)
    ON CONFLICT (source_status_history_id, recipient_id) DO NOTHING;
  END IF;

  -- Bloc pharmacien : notif statut aux autres membres de l'officine, seulement sur
  -- une vraie transition (évite « Demande traitée » sur une mise à jour treated->treated).
  IF new.new_status IN ('submitted', 'confirmed', 'treated', 'abandoned', 'cancelled', 'expired')
     AND new.new_status IS DISTINCT FROM new.old_status
     AND coalesce(new.reason, '') IS DISTINCT FROM 'patient_planned_visit_updated'
     AND coalesce(new.reason, '') NOT LIKE 'post_confirm_product_arrived|%'
     AND coalesce(new.reason, '') NOT LIKE 'post_confirm_arrival_cancelled|%'
     AND coalesce(new.reason, '') IS DISTINCT FROM 'pharmacist_response_updated'
     AND NOT v_patient_supply_update
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

COMMENT ON FUNCTION public._emit_in_app_notifications_for_status_history() IS
  'Notifs in-app : statut générique seulement sur vraie transition (old<>new) ; mises à jour same-status via motifs spéciaux (amendements/audit/réception).';
