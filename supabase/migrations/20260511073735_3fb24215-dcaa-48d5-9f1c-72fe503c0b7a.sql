REVOKE EXECUTE ON FUNCTION public.clonetemplatefor_user(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tax_lots_validate() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.profiles_validate() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_stale_finnhub_cache() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_user_completely(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.clone_template_for_user(uuid) FROM PUBLIC, anon, authenticated;