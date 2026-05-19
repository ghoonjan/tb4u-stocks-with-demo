CREATE OR REPLACE FUNCTION public.get_email_queue_health()
RETURNS TABLE(
  stuck_count bigint,
  oldest_pending_at timestamptz,
  oldest_age_seconds integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  WITH latest AS (
    SELECT DISTINCT ON (message_id) message_id, status, created_at
    FROM public.email_send_log
    WHERE message_id IS NOT NULL
    ORDER BY message_id, created_at DESC
  ),
  stuck AS (
    SELECT created_at
    FROM latest
    WHERE status = 'pending'
      AND created_at < now() - interval '5 minutes'
  )
  SELECT
    (SELECT count(*) FROM stuck)::bigint,
    (SELECT min(created_at) FROM stuck),
    COALESCE(EXTRACT(EPOCH FROM (now() - (SELECT min(created_at) FROM stuck)))::integer, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.get_email_queue_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_email_queue_health() TO authenticated;