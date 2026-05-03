-- 1. Template watchlist table
CREATE TABLE public.watchlist_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker text NOT NULL,
  company_name text,
  target_price numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.watchlist_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view watchlist template"
  ON public.watchlist_template FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins insert watchlist template"
  ON public.watchlist_template FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins update watchlist template"
  ON public.watchlist_template FOR UPDATE
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins delete watchlist template"
  ON public.watchlist_template FOR DELETE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- 2. Update clone RPC to also seed the watchlist
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

  SELECT id INTO v_template_portfolio_id
  FROM public.portfolios
  WHERE is_template = true
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

  -- Clone watchlist template
  INSERT INTO public.watchlist (user_id, ticker, company_name, target_price, notes)
  SELECT target_user_id, ticker, company_name, target_price, notes
  FROM public.watchlist_template;

  UPDATE public.profiles
  SET has_been_initialized = true
  WHERE id = target_user_id;

  RETURN true;
END;
$function$;