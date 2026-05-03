-- Fix clone_template_for_user so brand-new users actually receive seeded holdings.
-- Root cause: previous version filtered candidate templates with public.is_super_admin(p.user_id),
-- which now returns false for cross-user role checks initiated by a normal authenticated user,
-- so the template lookup silently returned NULL and no holdings were copied.
-- Also: avoid creating a duplicate "My Portfolio" when handle_new_user already created one.

CREATE OR REPLACE FUNCTION public.clone_template_for_user(target_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_initialized boolean;
  v_template_portfolio_id uuid;
  v_target_portfolio_id uuid;
  v_existing_holdings int;
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

  -- Resolve active template using a direct user_roles lookup. We are inside a
  -- SECURITY DEFINER function, so we can read user_roles directly without
  -- relying on is_super_admin (which is restricted for cross-user probing).
  SELECT p.id INTO v_template_portfolio_id
  FROM public.portfolios p
  WHERE p.is_template = true
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = p.user_id AND ur.role = 'super_admin'::public.app_role
    )
  ORDER BY p.created_at ASC
  LIMIT 1;

  -- Reuse the user's existing non-template portfolio (created by handle_new_user)
  -- instead of creating a second one.
  SELECT id INTO v_target_portfolio_id
  FROM public.portfolios
  WHERE user_id = target_user_id
    AND is_template = false
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_target_portfolio_id IS NULL THEN
    INSERT INTO public.portfolios (user_id, name, is_template)
    VALUES (target_user_id, 'My Portfolio', false)
    RETURNING id INTO v_target_portfolio_id;
  END IF;

  IF v_template_portfolio_id IS NOT NULL THEN
    SELECT count(*) INTO v_existing_holdings
    FROM public.holdings WHERE portfolio_id = v_target_portfolio_id;

    IF v_existing_holdings = 0 THEN
      INSERT INTO public.holdings (
        id, portfolio_id, ticker, company_name, shares, avg_cost_basis,
        conviction_rating, thesis, target_allocation_pct, notes, date_added
      )
      SELECT
        gen_random_uuid(), v_target_portfolio_id, ticker, company_name, shares, avg_cost_basis,
        conviction_rating, thesis, target_allocation_pct, notes, date_added
      FROM public.holdings
      WHERE portfolio_id = v_template_portfolio_id;
    END IF;
  END IF;

  -- Seed watchlist only if the user has none yet (idempotent).
  INSERT INTO public.watchlist (user_id, ticker, company_name, target_price, notes)
  SELECT target_user_id, wt.ticker, wt.company_name, wt.target_price, wt.notes
  FROM public.watchlist_template wt
  WHERE NOT EXISTS (
    SELECT 1 FROM public.watchlist w
    WHERE w.user_id = target_user_id AND w.ticker = wt.ticker
  );

  UPDATE public.profiles
  SET has_been_initialized = true
  WHERE id = target_user_id;

  RETURN true;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.clone_template_for_user(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.clone_template_for_user(uuid) TO authenticated;

-- Repair function: lets a super admin retro-clone the active template into a
-- specific user who was hit by the previous bug. Restricted to super admins.
CREATE OR REPLACE FUNCTION public.admin_seed_user_template(target_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_template_portfolio_id uuid;
  v_target_portfolio_id uuid;
  v_existing_holdings int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'::public.app_role
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT p.id INTO v_template_portfolio_id
  FROM public.portfolios p
  WHERE p.is_template = true
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = p.user_id AND ur.role = 'super_admin'::public.app_role
    )
  ORDER BY p.created_at ASC
  LIMIT 1;

  IF v_template_portfolio_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT id INTO v_target_portfolio_id
  FROM public.portfolios
  WHERE user_id = target_user_id AND is_template = false
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_target_portfolio_id IS NULL THEN
    INSERT INTO public.portfolios (user_id, name, is_template)
    VALUES (target_user_id, 'My Portfolio', false)
    RETURNING id INTO v_target_portfolio_id;
  END IF;

  SELECT count(*) INTO v_existing_holdings
  FROM public.holdings WHERE portfolio_id = v_target_portfolio_id;

  IF v_existing_holdings = 0 THEN
    INSERT INTO public.holdings (
      id, portfolio_id, ticker, company_name, shares, avg_cost_basis,
      conviction_rating, thesis, target_allocation_pct, notes, date_added
    )
    SELECT
      gen_random_uuid(), v_target_portfolio_id, ticker, company_name, shares, avg_cost_basis,
      conviction_rating, thesis, target_allocation_pct, notes, date_added
    FROM public.holdings
    WHERE portfolio_id = v_template_portfolio_id;
  END IF;

  RETURN true;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_seed_user_template(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_seed_user_template(uuid) TO authenticated;

-- One-shot backfill: any non-admin user whose only portfolio is empty gets
-- the current template holdings copied in. Safe + idempotent.
DO $$
DECLARE
  v_template_portfolio_id uuid;
  r record;
BEGIN
  SELECT p.id INTO v_template_portfolio_id
  FROM public.portfolios p
  WHERE p.is_template = true
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = p.user_id AND ur.role = 'super_admin'::public.app_role
    )
  ORDER BY p.created_at ASC
  LIMIT 1;

  IF v_template_portfolio_id IS NULL THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT po.id AS portfolio_id, po.user_id
    FROM public.portfolios po
    WHERE po.is_template = false
      AND NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = po.user_id AND ur.role = 'super_admin'::public.app_role
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.holdings h WHERE h.portfolio_id = po.id
      )
  LOOP
    INSERT INTO public.holdings (
      id, portfolio_id, ticker, company_name, shares, avg_cost_basis,
      conviction_rating, thesis, target_allocation_pct, notes, date_added
    )
    SELECT
      gen_random_uuid(), r.portfolio_id, ticker, company_name, shares, avg_cost_basis,
      conviction_rating, thesis, target_allocation_pct, notes, date_added
    FROM public.holdings
    WHERE portfolio_id = v_template_portfolio_id;
  END LOOP;
END $$;