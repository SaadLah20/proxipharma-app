-- Conversation par demande : fil `request_comments` (non interne), lecture, notifs, suppression par auteur.
-- Remplace l’usage « message général » patient (`patient_note` reste en base pour compat RPC ; plus alimenté par l’UI).

ALTER TABLE public.request_comments
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMENT ON COLUMN public.request_comments.deleted_at IS
  'Suppression logique par l’auteur ; le texte n’est plus affiché aux autres.';

CREATE TABLE IF NOT EXISTS public.request_conversation_reads (
  request_id uuid NOT NULL REFERENCES public.requests (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT 'epoch',
  PRIMARY KEY (request_id, user_id)
);

CREATE INDEX IF NOT EXISTS request_conversation_reads_user_idx
  ON public.request_conversation_reads (user_id);

COMMENT ON TABLE public.request_conversation_reads IS
  'Curseur « tout lu jusqu’à » par utilisateur et demande ; mis à jour à l’ouverture du fil conversation.';

ALTER TABLE public.request_conversation_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "request_conversation_reads_select_own" ON public.request_conversation_reads;
CREATE POLICY "request_conversation_reads_select_own"
ON public.request_conversation_reads
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_admin());

-- Écritures : uniquement via `mark_request_conversation_read` (SECURITY DEFINER).

-- RLS request_comments : remplace la policy unique « for all » par des règles explicites (insert auteur = self).
DROP POLICY IF EXISTS "request_comments_access" ON public.request_comments;

CREATE POLICY "request_comments_select_participants"
ON public.request_comments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.requests r
    WHERE r.id = request_comments.request_id
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
  )
);

CREATE POLICY "request_comments_insert_as_author"
ON public.request_comments
FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND is_internal IS FALSE
  AND deleted_at IS NULL
  AND author_role IN ('patient', 'pharmacien')
  AND char_length(btrim(comment_text)) BETWEEN 1 AND 2000
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

-- Marquer la conversation comme lue (SECURITY DEFINER : upsert fiable).
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
END;
$$;

REVOKE ALL ON FUNCTION public.mark_request_conversation_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_request_conversation_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_request_conversation_read(uuid) TO service_role;

COMMENT ON FUNCTION public.mark_request_conversation_read(uuid) IS
  'Patient ou pharmacien : enregistre que tous les messages visibles sont lus à cet instant.';

-- Retrait d’un message par son auteur
CREATE OR REPLACE FUNCTION public.request_comment_soft_delete(p_comment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.request_comments c
  SET deleted_at = now()
  WHERE c.id = p_comment_id
    AND c.author_id = auth.uid()
    AND c.deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.requests r
      WHERE r.id = c.request_id
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
    );
END;
$$;

REVOKE ALL ON FUNCTION public.request_comment_soft_delete(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_comment_soft_delete(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_comment_soft_delete(uuid) TO service_role;

-- Non lus : un batch pour les hubs (SECURITY INVOKER, RLS requests + comments).
CREATE OR REPLACE FUNCTION public.request_conversation_unread_flags(p_request_ids uuid[])
RETURNS TABLE (request_id uuid, has_unread boolean)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    r.id AS request_id,
    EXISTS (
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
    ) AS has_unread
  FROM public.requests r
  WHERE r.id = ANY (p_request_ids)
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
    );
$$;

REVOKE ALL ON FUNCTION public.request_conversation_unread_flags(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_conversation_unread_flags(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_conversation_unread_flags(uuid[]) TO service_role;

COMMENT ON FUNCTION public.request_conversation_unread_flags(uuid[]) IS
  'Pour chaque demande accessible : y a-t-il au moins un message conversation non lu pour auth.uid() ?';

-- Notifications in-app (hors trigger statut ; source_status_history_id NULL).
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

  IF new.author_role = 'patient' THEN
    v_title := 'Nouveau message sur une demande';
    v_body := v_pharma_nom || ' — ' || left(btrim(new.comment_text), 400);

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
    v_title := 'Message de la pharmacie';
    v_body := left(btrim(new.comment_text), 400);

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

DROP TRIGGER IF EXISTS trg_request_comments_in_app_notifications ON public.request_comments;
CREATE TRIGGER trg_request_comments_in_app_notifications
AFTER INSERT ON public.request_comments
FOR EACH ROW
EXECUTE FUNCTION public._emit_in_app_notifications_for_request_comment();

COMMENT ON FUNCTION public._emit_in_app_notifications_for_request_comment() IS
  'Notif in-app : message conversation patient → pharmaciens ; pharmacien → patient.';
