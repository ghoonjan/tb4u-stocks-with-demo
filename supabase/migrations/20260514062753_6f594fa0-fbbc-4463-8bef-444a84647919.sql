-- Allow signed-in users to enrich stock_lookup rows with Finnhub profile data.
-- Column-level privileges restrict edits to enrichment fields only;
-- ticker, company_name, sector, asset_type, id remain read-only for users.

REVOKE UPDATE ON public.stock_lookup FROM authenticated;
GRANT UPDATE (country, currency, exchange, ipo, market_cap, share_outstanding, weburl, updated_at)
  ON public.stock_lookup TO authenticated;

DROP POLICY IF EXISTS "Authenticated can enrich stock_lookup" ON public.stock_lookup;
CREATE POLICY "Authenticated can enrich stock_lookup"
ON public.stock_lookup
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);