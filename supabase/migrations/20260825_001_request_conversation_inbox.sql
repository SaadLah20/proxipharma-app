-- Inbox conversation globale + compteur messages non lus + sync alertes cloche à la lecture.

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.request_comments;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public._conversation_message_preview(
  p_comment_text text,
  p_audio_duration_seconds integer,
  p_deleted_at timestamptz
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_deleted_at IS NOT NULL THEN 'Message retiré.'
    WHEN coalesce(btrim(p_comment_text), '') = '' AND p_audio_duration_seconds IS NOT NULL THEN
      format('Message vocal (%s s)', p_audio_duration_seconds)
    WHEN coalesce(btrim(p_comment_text), '') <> '' AND p_audio_duration_seconds IS NOT NULL THEN
      left(btrim(p_comment_text), 80) || format(' · vocal (%s s)', p_audio_duration_seconds)
    WHEN coalesce(btrim(p_comment_text), '') <> '' THEN left(btrim(p_comment_text), 120)
    ELSE 'Message'
  END;
$$;

COMMENT ON FUNCTION public._conversation_message_preview(text, integer, timestamptz) IS
  'Aperçu court d''un message conversation (aligné lib/request-conversation.ts).';

CREATE OR REPLACE FUNCTION public.request_conversation_unread_count()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT count(*)::bigint
  FROM public.requests r
  WHERE (
      r.patient_id = auth.uid()
      OR public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.pharmacy_staff ps
        JOIN public.profiles p ON p.id = ps.user_id
        WHERE ps.pharmacy_id = r.pharmacy_id
          AND ps.user_id = auth.uid()
          AND p.role = 'pharmacien'
      )
    )
    AND EXISTS (
      SELECT 1
      FROM public.request_comments c
      WHERE c.request_id = r.id
        AND c.is_internal IS FALSE
        AND c.deleted_at IS NULL
        AND c.author_id IS DISTINCT FROM auth.uid()
        AND c.created_at > COALESCE(
          (
            SELECT rcr.last_read_at
            FROM public.request_conversation_reads rcr
            WHERE rcr.request_id = r.id
              AND rcr.user_id = auth.uid()
            LIMIT 1
          ),
          '-infinity'::timestamptz
        )
    );
$$;

REVOKE ALL ON FUNCTION public.request_conversation_unread_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_conversation_unread_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_conversation_unread_count() TO service_role;

COMMENT ON FUNCTION public.request_conversation_unread_count() IS
  'Nombre de dossiers accessibles avec au moins un message conversation non lu pour auth.uid().';

CREATE OR REPLACE FUNCTION public.request_conversation_inbox(p_limit integer DEFAULT 30)
RETURNS TABLE (
  request_id uuid,
  request_public_ref text,
  request_type text,
  counterpart_label text,
  last_message_at timestamptz,
  last_message_preview text,
  has_unread boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH me AS (
    SELECT p.id, p.role
    FROM public.profiles p
    WHERE p.id = auth.uid()
    LIMIT 1
  ),
  accessible AS (
    SELECT r.*
    FROM public.requests r
    CROSS JOIN me
    WHERE (
        r.patient_id = auth.uid()
        OR me.role = 'admin'
        OR (
          me.role = 'pharmacien'
          AND EXISTS (
            SELECT 1
            FROM public.pharmacy_staff ps
            WHERE ps.pharmacy_id = r.pharmacy_id
              AND ps.user_id = auth.uid()
          )
        )
      )
  ),
  latest_comment AS (
    SELECT DISTINCT ON (c.request_id)
      c.request_id,
      c.created_at AS last_message_at,
      c.comment_text,
      c.audio_duration_seconds,
      c.deleted_at
    FROM public.request_comments c
    JOIN accessible a ON a.id = c.request_id
    WHERE c.is_internal IS FALSE
    ORDER BY c.request_id, c.created_at DESC
  ),
  threads AS (
    SELECT
      a.id AS request_id,
      a.request_public_ref::text,
      a.request_type::text,
      CASE
        WHEN (SELECT role FROM me) = 'pharmacien' THEN
          coalesce(nullif(btrim(pat.full_name), ''), 'Patient')
          || CASE
            WHEN nullif(btrim(pat.patient_ref), '') IS NOT NULL THEN ' · ' || btrim(pat.patient_ref)
            ELSE ''
          END
        ELSE coalesce(nullif(btrim(ph.nom), ''), 'Pharmacie')
      END AS counterpart_label,
      lc.last_message_at,
      public._conversation_message_preview(
        lc.comment_text,
        lc.audio_duration_seconds,
        lc.deleted_at
      ) AS last_message_preview,
      EXISTS (
        SELECT 1
        FROM public.request_comments c2
        WHERE c2.request_id = a.id
          AND c2.is_internal IS FALSE
          AND c2.deleted_at IS NULL
          AND c2.author_id IS DISTINCT FROM auth.uid()
          AND c2.created_at > COALESCE(
            (
              SELECT rcr.last_read_at
              FROM public.request_conversation_reads rcr
              WHERE rcr.request_id = a.id
                AND rcr.user_id = auth.uid()
              LIMIT 1
            ),
            '-infinity'::timestamptz
          )
      ) AS has_unread
    FROM accessible a
    JOIN latest_comment lc ON lc.request_id = a.id
    LEFT JOIN public.profiles pat ON pat.id = a.patient_id
    LEFT JOIN public.pharmacies ph ON ph.id = a.pharmacy_id
    WHERE lc.deleted_at IS NULL
  )
  SELECT
    t.request_id,
    t.request_public_ref,
    t.request_type,
    t.counterpart_label,
    t.last_message_at,
    t.last_message_preview,
    t.has_unread
  FROM threads t
  ORDER BY t.has_unread DESC, t.last_message_at DESC
  LIMIT greatest(coalesce(p_limit, 30), 1);
$$;

REVOKE ALL ON FUNCTION public.request_conversation_inbox(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_conversation_inbox(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_conversation_inbox(integer) TO service_role;

COMMENT ON FUNCTION public.request_conversation_inbox(integer) IS
  'Fil conversation global : dernier message par dossier accessible, tri non lus puis récence.';

CREATE OR REPLACE FUNCTION public.mark_request_conversation_read(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.requests r
    WHERE r.id = p_request_id
      AND (
        r.patient_id = auth.uid()
        OR public.is_admin()
        OR EXISTS (
          SELECT 1
          FROM public.pharmacy_staff ps
          JOIN public.profiles p ON p.id = ps.user_id
          WHERE ps.pharmacy_id = r.pharmacy_id
            AND ps.user_id = auth.uid()
            AND p.role = 'pharmacien'
        )
      )
  ) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.request_conversation_reads (request_id, user_id, last_read_at)
  VALUES (p_request_id, auth.uid(), now())
  ON CONFLICT (request_id, user_id)
  DO UPDATE SET last_read_at = excluded.last_read_at;

  UPDATE public.app_notifications
  SET read_at = now()
  WHERE recipient_id = auth.uid()
    AND request_id = p_request_id
    AND read_at IS NULL
    AND event_type LIKE 'request_conversation:%';
END;
$$;

COMMENT ON FUNCTION public.mark_request_conversation_read(uuid) IS
  'Marque le fil conversation lu et synchronise les alertes cloche request_conversation:* du même dossier.';
