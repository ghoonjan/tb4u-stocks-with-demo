-- Revoke EXECUTE on SECURITY DEFINER functions from anon/authenticated/public.
-- These functions are only meant to be invoked internally:
--   - handle_new_user: called by auth trigger on auth.users
--   - cleanup_stale_finnhub_cache: called from finnhub edge function via service role
-- Service role bypasses these GRANTs, and the auth trigger runs as definer, so
-- revoking client-facing EXECUTE does not break legitimate callers.

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_stale_finnhub_cache() FROM PUBLIC, anon, authenticated;