
CREATE OR REPLACE FUNCTION public.clone_template_for_user(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_initialized boolean;
  v_template_portfolio_id uuid;
  v_new_portfolio_id uuid;
BEGIN
  -- Auth guard: users can only initialize themselves
  IF target_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to initialize another user';
  END IF;

  -- 1. Already initialized?
  SELECT has_been_initialized INTO v_initialized
  FROM public.profiles
  WHERE id = target_user_id;

  IF v_initialized IS TRUE THEN
    RETURN false;
  END IF;

  -- 2. Find the template portfolio
  SELECT id INTO v_template_portfolio_id
  FROM public.portfolios
  WHERE is_template = true
  LIMIT 1;

  IF v_template_portfolio_id IS NULL THEN
    UPDATE public.profiles
    SET has_been_initialized = true
    WHERE id = target_user_id;
    RETURN false;
  END IF;

  -- 3. Create the new portfolio for the target user
  INSERT INTO public.portfolios (user_id, name, is_template)
  VALUES (target_user_id, 'My Portfolio', false)
  RETURNING id INTO v_new_portfolio_id;

  -- 4. Clone holdings
  INSERT INTO public.holdings (
    id, portfolio_id, ticker, company_name, shares, avg_cost_basis,
    conviction_rating, thesis, target_allocation_pct, notes, date_added
  )
  SELECT
    gen_random_uuid(), v_new_portfolio_id, ticker, company_name, shares, avg_cost_basis,
    conviction_rating, thesis, target_allocation_pct, notes, date_added
  FROM public.holdings
  WHERE portfolio_id = v_template_portfolio_id;

  -- 5. tax_lots: table does not exist, skip.
  -- 6. watchlist: no template marker, skip.

  -- 7. Mark initialized
  UPDATE public.profiles
  SET has_been_initialized = true
  WHERE id = target_user_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.clone_template_for_user(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.clone_template_for_user(uuid) TO authenticated;
