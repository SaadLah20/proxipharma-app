-- Délai d'expiration après réponse pharmacie : 24 h (sans validation patient).

CREATE OR REPLACE FUNCTION public.expire_overdue_requests(
  p_responded_silence interval DEFAULT interval '24 hours'
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
    v_silence := interval '24 hours';
  END IF;

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
  'Cron service_role : responded sans validation après délai (défaut 24 h) + expires_at dépassé.';

REVOKE ALL ON FUNCTION public.expire_overdue_requests(interval) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_overdue_requests(interval) TO service_role;

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
