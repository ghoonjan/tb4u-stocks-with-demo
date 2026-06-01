REVOKE EXECUTE ON FUNCTION public.get_email_queue_health() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_email_queue_health() TO service_role;