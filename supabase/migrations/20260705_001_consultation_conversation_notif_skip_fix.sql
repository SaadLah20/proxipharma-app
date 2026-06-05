-- Consultation libre : le 1er message chat patient doit notifier l'officine
-- (le brief initial est dans free_consultation_requests, pas request_comments).

CREATE OR REPLACE FUNCTION public._emit_in_app_notifications_for_request_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.requests%rowtype;
  v_pharma_nom text;
  v_title text;
  v_body text;
  v_ref text;
  v_skip_submission_message boolean := false;
BEGIN
  IF tg_op <> 'INSERT' THEN
    RETURN new;
  END IF;

  IF new.is_internal IS TRUE OR new.deleted_at IS NOT NULL THEN
    RETURN new;
  END IF;

  IF new.author_role NOT IN ('patient', 'pharmacien') THEN
    RETURN new;
  END IF;

  SELECT * INTO v_req FROM public.requests r WHERE r.id = new.request_id;
  IF NOT FOUND THEN
    RETURN new;
  END IF;

  SELECT coalesce(nullif(btrim(ph.nom::text), ''), 'Pharmacie') INTO v_pharma_nom
  FROM public.pharmacies ph
  WHERE ph.id = v_req.pharmacy_id;

  v_ref := nullif(btrim(v_req.request_public_ref), '');

  IF new.author_role = 'patient' THEN
    -- Skip uniquement pour produits/ordonnance : 1ère note patient dans request_comments
    -- à l'envoi (doublon avec le dossier). Consultation libre : toujours notifier.
    IF v_req.request_type IN ('product_request', 'prescription') THEN
      SELECT (
        NOT EXISTS (
          SELECT 1
          FROM public.request_comments c
          WHERE c.request_id = new.request_id
            AND c.id IS DISTINCT FROM new.id
            AND c.author_role = 'patient'
            AND c.is_internal IS NOT TRUE
            AND c.deleted_at IS NULL
        )
        AND new.created_at <= v_req.created_at + interval '15 minutes'
      ) INTO v_skip_submission_message;

      IF v_skip_submission_message THEN
        RETURN new;
      END IF;
    END IF;

    v_title := 'Nouveau message patient';
    v_body := coalesce(v_pharma_nom, 'Officine') || ' — ' || left(btrim(new.comment_text), 360);
    IF v_ref IS NOT NULL THEN
      v_body := v_body || E'\nRéf. dossier ' || v_ref;
    END IF;

    INSERT INTO public.app_notifications (
      recipient_id, request_id, source_status_history_id, event_type, title, body
    )
    SELECT
      ps.user_id,
      new.request_id,
      NULL,
      'request_conversation:message',
      v_title,
      v_body
    FROM public.pharmacy_staff ps
    JOIN public.profiles p ON p.id = ps.user_id
    WHERE ps.pharmacy_id = v_req.pharmacy_id
      AND p.role = 'pharmacien'
      AND ps.user_id IS DISTINCT FROM new.author_id;
  ELSIF new.author_role = 'pharmacien' THEN
    v_title := 'Message de votre pharmacie';
    v_body := left(btrim(new.comment_text), 360);
    IF v_ref IS NOT NULL THEN
      v_body := v_body || E'\nRéf. dossier ' || v_ref;
    END IF;

    INSERT INTO public.app_notifications (
      recipient_id, request_id, source_status_history_id, event_type, title, body
    )
    VALUES (
      v_req.patient_id,
      new.request_id,
      NULL,
      'request_conversation:message',
      v_title,
      v_body
    );
  END IF;

  RETURN new;
END;
$$;

COMMENT ON FUNCTION public._emit_in_app_notifications_for_request_comment() IS
  'Notif in-app conversation patient↔pharmacien. Skip 1er commentaire patient (15 min) seulement product_request/prescription.';
