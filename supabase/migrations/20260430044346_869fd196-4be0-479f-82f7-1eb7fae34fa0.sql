REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_stale_finnhub_cache() FROM PUBLIC, authenticated, anon;