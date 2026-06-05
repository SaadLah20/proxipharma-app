-- Messages vocaux optionnels dans le fil conversation (request_comments), max 30 s.
-- Hors notes produit (client_comment / pharmacist_comment).

ALTER TABLE public.request_comments
  ADD COLUMN IF NOT EXISTS audio_path text,
  ADD COLUMN IF NOT EXISTS audio_duration_seconds smallint;

COMMENT ON COLUMN public.request_comments.audio_path IS
  'Chemin Storage private-media/conversation/{request_id}/{comment_id}.{webm|mp4|m4a}';

COMMENT ON COLUMN public.request_comments.audio_duration_seconds IS
  'Durée enregistrée côté client (1–30 s) si audio_path renseigné.';

ALTER TABLE public.request_comments
  ALTER COLUMN comment_text DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.request_comment_audio_path_valid(
  p_request_id uuid,
  p_comment_id uuid,
  p_path text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, storage
AS $$
  SELECT p_path IS NOT NULL
    AND p_path ~* '^conversation/[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}/[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}\.(webm|mp4|m4a)$'
    AND lower((storage.foldername(p_path))[1]) = 'conversation'
    AND ((storage.foldername(p_path))[2])::uuid = p_request_id
    AND lower(split_part(storage.filename(p_path), '.', 1)) = lower(p_comment_id::text);
$$;

ALTER TABLE public.request_comments DROP CONSTRAINT IF EXISTS request_comments_content_check;
ALTER TABLE public.request_comments ADD CONSTRAINT request_comments_content_check CHECK (
  (
    comment_text IS NOT NULL
    AND char_length(btrim(comment_text)) BETWEEN 1 AND 2000
  )
  OR audio_path IS NOT NULL
);

ALTER TABLE public.request_comments DROP CONSTRAINT IF EXISTS request_comments_audio_duration_check;
ALTER TABLE public.request_comments ADD CONSTRAINT request_comments_audio_duration_check CHECK (
  (
    audio_path IS NULL
    AND audio_duration_seconds IS NULL
  )
  OR (
    audio_path IS NOT NULL
    AND audio_duration_seconds BETWEEN 1 AND 30
    AND public.request_comment_audio_path_valid(request_id, id, audio_path)
  )
);

-- Storage : préfixe conversation/{request_id}/…
CREATE OR REPLACE FUNCTION public.storage_request_id_from_private_path(p_name text)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public, storage
AS $$
  SELECT CASE
    WHEN (storage.foldername(p_name))[1] IN ('ordonnances', 'patient', 'consultations', 'conversation')
      AND (storage.foldername(p_name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN ((storage.foldername(p_name))[2])::uuid
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.storage_is_valid_private_media_path(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, storage
AS $$
  SELECT (storage.foldername(p_name))[1] IN ('ordonnances', 'patient', 'consultations', 'conversation')
    AND public.storage_request_id_from_private_path(p_name) IS NOT NULL
    AND nullif(trim(storage.filename(p_name)), '') IS NOT NULL;
$$;

DROP POLICY IF EXISTS "request_comments_insert_as_author" ON public.request_comments;

CREATE POLICY "request_comments_insert_as_author"
ON public.request_comments
FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND is_internal IS FALSE
  AND deleted_at IS NULL
  AND author_role IN ('patient', 'pharmacien')
  AND (
    (
      comment_text IS NOT NULL
      AND char_length(btrim(comment_text)) BETWEEN 1 AND 2000
    )
    OR (
      audio_path IS NOT NULL
      AND audio_duration_seconds BETWEEN 1 AND 30
      AND public.request_comment_audio_path_valid(request_id, id, audio_path)
    )
  )
  AND (
    (
      author_role = 'patient'
      AND (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()) = 'patient'
      AND EXISTS (
        SELECT 1 FROM public.requests r
        WHERE r.id = request_comments.request_id AND r.patient_id = auth.uid()
      )
    )
    OR (
      author_role = 'pharmacien'
      AND (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()) = 'pharmacien'
      AND EXISTS (
        SELECT 1
        FROM public.requests r
        JOIN public.pharmacy_staff ps ON ps.pharmacy_id = r.pharmacy_id AND ps.user_id = auth.uid()
        JOIN public.profiles p ON p.id = ps.user_id
        WHERE r.id = request_comments.request_id AND p.role = 'pharmacien'
      )
    )
  )
);

-- Upload vocal : patient ou pharmacien de l'officine (dossier conversation/).
DROP POLICY IF EXISTS "private_media_insert_conversation_participant" ON storage.objects;
CREATE POLICY "private_media_insert_conversation_participant"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'private-media'
  AND (storage.foldername(name))[1] = 'conversation'
  AND public.storage_is_valid_private_media_path(name)
  AND public.storage_can_access_request_media(public.storage_request_id_from_private_path(name))
);

DROP POLICY IF EXISTS "private_media_update_conversation_participant" ON storage.objects;
CREATE POLICY "private_media_update_conversation_participant"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'private-media'
  AND (storage.foldername(name))[1] = 'conversation'
  AND public.storage_is_valid_private_media_path(name)
  AND public.storage_can_access_request_media(public.storage_request_id_from_private_path(name))
)
WITH CHECK (
  bucket_id = 'private-media'
  AND (storage.foldername(name))[1] = 'conversation'
  AND public.storage_is_valid_private_media_path(name)
  AND public.storage_can_access_request_media(public.storage_request_id_from_private_path(name))
);

CREATE OR REPLACE FUNCTION public.conversation_notification_excerpt(
  p_comment_text text,
  p_audio_duration_seconds smallint
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_audio_duration_seconds IS NOT NULL AND nullif(btrim(p_comment_text), '') IS NULL THEN
      'Message vocal (' || p_audio_duration_seconds::text || ' s)'
    WHEN p_audio_duration_seconds IS NOT NULL AND nullif(btrim(p_comment_text), '') IS NOT NULL THEN
      left(btrim(p_comment_text), 320) || ' · message vocal (' || p_audio_duration_seconds::text || ' s)'
    ELSE
      left(btrim(coalesce(p_comment_text, '')), 360)
  END;
$$;

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
  v_excerpt text;
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
  v_excerpt := public.conversation_notification_excerpt(new.comment_text, new.audio_duration_seconds);

  IF new.author_role = 'patient' THEN
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
    v_body := coalesce(v_pharma_nom, 'Officine') || ' — ' || v_excerpt;
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
    v_body := coalesce(v_pharma_nom, 'Officine') || ' — ' || v_excerpt;
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
  'Notif in-app conversation patient↔pharmacien ; excerpt texte ou vocal ; skip 1er commentaire patient (15 min) product/prescription.';
