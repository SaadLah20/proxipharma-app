-- Inbox conversation : noms patients (annuaire pharmacien) + champs pharmacie pour i18n client.

CREATE OR REPLACE FUNCTION public.request_conversation_inbox(p_limit integer DEFAULT 30)
RETURNS TABLE (
  request_id uuid,
  request_public_ref text,
  request_type text,
  counterpart_label text,
  pharmacy_nom text,
  pharmacy_nom_ar text,
  patient_full_name text,
  patient_ref text,
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
          coalesce(nullif(btrim(pat_dir.full_name), ''), 'Patient')
          || CASE
            WHEN nullif(btrim(pat_dir.patient_ref), '') IS NOT NULL THEN ' · ' || btrim(pat_dir.patient_ref)
            ELSE ''
          END
        ELSE coalesce(nullif(btrim(ph.nom), ''), 'Pharmacie')
      END AS counterpart_label,
      ph.nom::text AS pharmacy_nom,
      ph.nom_ar::text AS pharmacy_nom_ar,
      pat_dir.full_name::text AS patient_full_name,
      pat_dir.patient_ref::text AS patient_ref,
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
    LEFT JOIN public.pharmacies ph ON ph.id = a.pharmacy_id
    LEFT JOIN LATERAL (
      SELECT d.full_name, d.patient_ref
      FROM public.pharmacist_patient_directory_for_my_pharmacy() AS d
      WHERE d.patient_id = a.patient_id
      LIMIT 1
    ) pat_dir ON (SELECT role FROM me) = 'pharmacien'
    WHERE lc.deleted_at IS NULL
  )
  SELECT
    t.request_id,
    t.request_public_ref,
    t.request_type,
    t.counterpart_label,
    t.pharmacy_nom,
    t.pharmacy_nom_ar,
    t.patient_full_name,
    t.patient_ref,
    t.last_message_at,
    t.last_message_preview,
    t.has_unread
  FROM threads t
  ORDER BY t.has_unread DESC, t.last_message_at DESC
  LIMIT greatest(coalesce(p_limit, 30), 1);
$$;

COMMENT ON FUNCTION public.request_conversation_inbox(integer) IS
  'Fil conversation global : labels structurés (pharmacie FR/AR, patient via annuaire officine).';
