
-- 1. Tighten portfolios UPDATE policy: prevent non-admins from setting is_template = true
DROP POLICY IF EXISTS "Users can update own portfolios" ON public.portfolios;
CREATE POLICY "Users can update own portfolios"
ON public.portfolios
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND (is_template = false OR public.is_super_admin(auth.uid()))
);

-- Also tighten INSERT: cannot create a template unless super admin
DROP POLICY IF EXISTS "Users can insert own portfolios" ON public.portfolios;
CREATE POLICY "Users can insert own portfolios"
ON public.portfolios
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (is_template = false OR public.is_super_admin(auth.uid()))
);

-- Reset any non-admin-owned template flags that may have been set maliciously
UPDATE public.portfolios p
SET is_template = false
WHERE is_template = true
  AND NOT public.is_super_admin(p.user_id);

-- 2. Make clone_template_for_user deterministic: prefer admin-owned, oldest first
CREATE OR REPLACE FUNCTION public.clone_template_for_user(target_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_initialized boolean;
  v_template_portfolio_id uuid;
  v_new_portfolio_id uuid;
BEGIN
  IF target_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to initialize another user';
  END IF;

  SELECT has_been_initialized INTO v_initialized
  FROM public.profiles
  WHERE id = target_user_id;

  IF v_initialized IS TRUE THEN
    RETURN false;
  END IF;

  -- Only consider templates owned by a super_admin, oldest first (deterministic)
  SELECT p.id INTO v_template_portfolio_id
  FROM public.portfolios p
  WHERE p.is_template = true
    AND public.is_super_admin(p.user_id)
  ORDER BY p.created_at ASC
  LIMIT 1;

  IF v_template_portfolio_id IS NOT NULL THEN
    INSERT INTO public.portfolios (user_id, name, is_template)
    VALUES (target_user_id, 'My Portfolio', false)
    RETURNING id INTO v_new_portfolio_id;

    INSERT INTO public.holdings (
      id, portfolio_id, ticker, company_name, shares, avg_cost_basis,
      conviction_rating, thesis, target_allocation_pct, notes, date_added
    )
    SELECT
      gen_random_uuid(), v_new_portfolio_id, ticker, company_name, shares, avg_cost_basis,
      conviction_rating, thesis, target_allocation_pct, notes, date_added
    FROM public.holdings
    WHERE portfolio_id = v_template_portfolio_id;
  END IF;

  INSERT INTO public.watchlist (user_id, ticker, company_name, target_price, notes)
  SELECT target_user_id, ticker, company_name, target_price, notes
  FROM public.watchlist_template;

  UPDATE public.profiles
  SET has_been_initialized = true
  WHERE id = target_user_id;

  RETURN true;
END;
$function$;

-- 3. Restrict has_role/is_super_admin probing to self-or-admin
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow internal calls (no JWT) and self/admin lookups; otherwise deny
  IF auth.uid() IS NOT NULL
     AND _user_id IS DISTINCT FROM auth.uid()
     AND NOT EXISTS (
       SELECT 1 FROM public.user_roles
       WHERE user_id = auth.uid() AND role = 'super_admin'
     )
  THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$function$;

-- is_super_admin already delegates to has_role, so it inherits the restriction.

-- 4. Revoke anon EXECUTE on SECURITY DEFINER functions exposed via PostgREST
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.clone_template_for_user(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.cleanup_stale_finnhub_cache() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clone_template_for_user(uuid) TO authenticated;

-- 5. finnhub_cache: keep RLS-only-server-access. Add an explicit deny-all policy
-- so the linter recognizes the intentional no-client-access posture.
DROP POLICY IF EXISTS "No client access to cache" ON public.finnhub_cache;
CREATE POLICY "No client access to cache"
ON public.finnhub_cache
FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);
