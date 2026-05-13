-- Problème : expire_overdue_requests() ne traitait que expires_at ; les flux actuels
-- laissent souvent expires_at NULL → aucune expiration malgré responded_at.
-- responded_at / now() sont en timestamptz (UTC en base) : cohérent Maroc / fuseaux.
--
-- Pilote : délai de silence après réponse = 30 minutes (paramètre, défaut).
-- Repasser le défaut à interval '24 hours' (ou passer l’intervalle depuis pg_cron) en prod stable.

DROP FUNCTION IF EXISTS public.expire_overdue_requests();

CREATE OR REPLACE FUNCTION public.expire_overdue_requests(
  p_responded_silence interval DEFAULT interval '30 minutes'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  r record;
  v_silence interval;
BEGIN
  v_silence := p_responded_silence;
  IF v_silence IS NULL OR v_silence <= interval '0' THEN
    v_silence := interval '30 minutes';
  END IF;

  -- 1) Répondu sans validation patient : délai depuis responded_at
  FOR r IN
    SELECT id, status
    FROM public.requests
    WHERE status = 'responded'::public.request_status_enum
      AND responded_at IS NOT NULL
      AND responded_at < (now() - v_silence)
    FOR UPDATE
  LOOP
    UPDATE public.requests
    SET status = 'expired', updated_at = now()
    WHERE id = r.id;

    PERFORM public._log_request_status_change(
      r.id,
      r.status,
      'expired',
      NULL,
      'auto_expire_after_response_silence'
    );
    v_count := v_count + 1;
  END LOOP;

  -- 2) Ancien mécanisme : expires_at renseigné (responded | confirmed)
  FOR r IN
    SELECT id, status
    FROM public.requests
    WHERE status IN (
        'responded'::public.request_status_enum,
        'confirmed'::public.request_status_enum
      )
      AND expires_at IS NOT NULL
      AND expires_at < now()
    FOR UPDATE
  LOOP
    UPDATE public.requests
    SET status = 'expired', updated_at = now()
    WHERE id = r.id;

    PERFORM public._log_request_status_change(r.id, r.status, 'expired', NULL, 'expire_overdue_requests');
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.expire_overdue_requests(interval) IS
  'Cron service_role : (1) responded + responded_at hors délai → expired ; (2) responded|confirmed + expires_at dépassé → expired. Défaut silence = 30 min (pilote).';

REVOKE ALL ON FUNCTION public.expire_overdue_requests(interval) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_overdue_requests(interval) TO service_role;

-- Alias historique Q6 / crons : une seule implémentation
CREATE OR REPLACE FUNCTION public.abandon_unconfirmed_responded_requests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.expire_overdue_requests();
END;
$$;

COMMENT ON FUNCTION public.abandon_unconfirmed_responded_requests() IS
  'Alias de expire_overdue_requests() : même batch (responded_at + expires_at). service_role.';
