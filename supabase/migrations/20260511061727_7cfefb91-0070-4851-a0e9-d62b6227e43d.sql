
-- Fix mutable search_path
ALTER FUNCTION public.delete_user_completely(uuid) SET search_path = public;
ALTER FUNCTION public.clone_template_for_user(uuid) SET search_path = public;

-- Revoke broad EXECUTE access on SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tax_lots_validate() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.profiles_validate() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_stale_finnhub_cache() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_user_completely(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clone_template_for_user(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_seed_user_template(uuid) FROM PUBLIC, anon;

-- Grant execute only where needed
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_seed_user_template(uuid) TO authenticated;
