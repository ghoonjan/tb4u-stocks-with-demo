-- Restore template dividend cloning in clone_template_for_user.
-- The previous change removed this block and relied on Finnhub /stock/dividend2
-- to populate dividends after clone, which fails on the free plan (403),
-- leaving new accounts with empty Income pages.

CREATE OR REPLACE FUNCTION public.clone_template_for_user(new_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  template_user_id uuid := '914c6d2f-256d-4d42-9475-e06939b6d25d';
  v_template_portfolio_id uuid;
  v_target_portfolio_id uuid;
  v_template_holding record;
  v_new_holding_id uuid;
BEGIN
  IF new_user_id IS NULL THEN
    RAISE EXCEPTION 'new_user_id cannot be null';
  END IF;

  SELECT p.id
  INTO v_template_portfolio_id
  FROM public.portfolios p
  WHERE p.user_id = template_user_id
  ORDER BY p.is_template DESC, p.created_at ASC
  LIMIT 1;

  IF v_template_portfolio_id IS NULL THEN
    RAISE EXCEPTION 'Template portfolio not found for user %', template_user_id;
  END IF;

  SELECT p.id
  INTO v_target_portfolio_id
  FROM public.portfolios p
  WHERE p.user_id = new_user_id
    AND p.is_template = false
  ORDER BY p.created_at ASC
  LIMIT 1;

  IF v_target_portfolio_id IS NULL THEN
    INSERT INTO public.portfolios (id, user_id, name, created_at, is_template)
    VALUES (gen_random_uuid(), new_user_id, 'My Portfolio', now(), false)
    RETURNING id INTO v_target_portfolio_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.holdings h WHERE h.portfolio_id = v_target_portfolio_id
  ) THEN
    FOR v_template_holding IN
      SELECT *
      FROM public.holdings h
      WHERE h.portfolio_id = v_template_portfolio_id
      ORDER BY h.date_added ASC, h.ticker ASC
    LOOP
      INSERT INTO public.holdings (
        id, portfolio_id, ticker, company_name, shares, avg_cost_basis,
        conviction_rating, thesis, target_allocation_pct, date_added, notes
      )
      VALUES (
        gen_random_uuid(), v_target_portfolio_id,
        v_template_holding.ticker, v_template_holding.company_name,
        v_template_holding.shares, v_template_holding.avg_cost_basis,
        v_template_holding.conviction_rating, v_template_holding.thesis,
        v_template_holding.target_allocation_pct,
        COALESCE(v_template_holding.date_added, now()),
        v_template_holding.notes
      )
      RETURNING id INTO v_new_holding_id;

      INSERT INTO public.tax_lots (
        id, holding_id, shares, shares_remaining, cost_basis_per_share,
        purchased_at, notes, created_at
      )
      SELECT
        gen_random_uuid(), v_new_holding_id, tl.shares, tl.shares_remaining,
        tl.cost_basis_per_share, tl.purchased_at, tl.notes,
        COALESCE(tl.created_at, now())
      FROM public.tax_lots tl
      WHERE tl.holding_id = v_template_holding.id
      ORDER BY tl.purchased_at ASC, tl.created_at ASC;

      -- Clone dividend rows from the template holding to the new holding.
      INSERT INTO public.dividends (
        id, user_id, holding_id, ticker, amount_per_share, shares_at_time,
        ex_date, pay_date, frequency, is_reinvested, notes, created_at, updated_at
      )
      SELECT
        gen_random_uuid(), new_user_id, v_new_holding_id, d.ticker,
        d.amount_per_share, d.shares_at_time, d.ex_date, d.pay_date,
        d.frequency, d.is_reinvested, d.notes, now(), now()
      FROM public.dividends d
      WHERE d.holding_id = v_template_holding.id
        AND d.user_id = template_user_id;
    END LOOP;
  END IF;

  -- Watchlist clone (unchanged): prefer curated watchlist_template, otherwise
  -- fall back to the template user's watchlist.
  IF NOT EXISTS (
    SELECT 1 FROM public.watchlist w WHERE w.user_id = new_user_id
  ) THEN
    IF EXISTS (SELECT 1 FROM public.watchlist_template) THEN
      INSERT INTO public.watchlist (id, user_id, ticker, company_name, target_price, date_added, notes)
      SELECT gen_random_uuid(), new_user_id, wt.ticker, wt.company_name, wt.target_price,
             now(), wt.notes
      FROM public.watchlist_template wt
      ORDER BY wt.created_at ASC, wt.ticker ASC;
    ELSE
      INSERT INTO public.watchlist (id, user_id, ticker, company_name, target_price, date_added, notes)
      SELECT gen_random_uuid(), new_user_id, w.ticker, w.company_name, w.target_price,
             COALESCE(w.date_added, now()), w.notes
      FROM public.watchlist w
      WHERE w.user_id = template_user_id
      ORDER BY w.date_added ASC, w.ticker ASC;
    END IF;
  END IF;
END;
$function$;

-- Backfill: for every non-template portfolio where holdings exist but the user
-- has zero dividend rows, copy dividends from the matching template holdings
-- (matched by ticker). This restores Income data for accounts created during
-- the regression window without requiring them to re-clone.
WITH template AS (
  SELECT p.id AS portfolio_id, p.user_id AS template_user_id
  FROM public.portfolios p
  WHERE p.user_id = '914c6d2f-256d-4d42-9475-e06939b6d25d'
  ORDER BY p.is_template DESC, p.created_at ASC
  LIMIT 1
),
candidate_users AS (
  SELECT DISTINCT p.user_id, p.id AS portfolio_id
  FROM public.portfolios p
  WHERE p.is_template = false
    AND p.user_id <> (SELECT template_user_id FROM template)
    AND EXISTS (SELECT 1 FROM public.holdings h WHERE h.portfolio_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.dividends d WHERE d.user_id = p.user_id)
)
INSERT INTO public.dividends (
  id, user_id, holding_id, ticker, amount_per_share, shares_at_time,
  ex_date, pay_date, frequency, is_reinvested, notes, created_at, updated_at
)
SELECT
  gen_random_uuid(), cu.user_id, user_h.id, td.ticker,
  td.amount_per_share, td.shares_at_time, td.ex_date, td.pay_date,
  td.frequency, td.is_reinvested, td.notes, now(), now()
FROM candidate_users cu
JOIN public.holdings user_h ON user_h.portfolio_id = cu.portfolio_id
JOIN public.holdings tmpl_h
  ON tmpl_h.portfolio_id = (SELECT portfolio_id FROM template)
 AND tmpl_h.ticker = user_h.ticker
JOIN public.dividends td
  ON td.holding_id = tmpl_h.id
 AND td.user_id = (SELECT template_user_id FROM template);
