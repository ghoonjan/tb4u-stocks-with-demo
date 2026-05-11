-- 1. Remove existing orphaned tax_lots
DELETE FROM public.tax_lots tl
WHERE NOT EXISTS (SELECT 1 FROM public.holdings h WHERE h.id = tl.holding_id);

-- 2. Add cascade FKs (drop any existing same-named constraints first)
ALTER TABLE public.tax_lots
  DROP CONSTRAINT IF EXISTS tax_lots_holding_id_fkey,
  ADD CONSTRAINT tax_lots_holding_id_fkey
    FOREIGN KEY (holding_id) REFERENCES public.holdings(id) ON DELETE CASCADE;

ALTER TABLE public.holdings
  DROP CONSTRAINT IF EXISTS holdings_portfolio_id_fkey,
  ADD CONSTRAINT holdings_portfolio_id_fkey
    FOREIGN KEY (portfolio_id) REFERENCES public.portfolios(id) ON DELETE CASCADE;
