DROP POLICY IF EXISTS "Authenticated can enrich stock_lookup" ON public.stock_lookup;
REVOKE UPDATE ON public.stock_lookup FROM authenticated;