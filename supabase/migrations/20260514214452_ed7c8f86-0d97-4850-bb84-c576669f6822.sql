
-- Replace the permissive UPDATE policy on stock_lookup with a tightly-scoped RPC.
DROP POLICY IF EXISTS "Authenticated can enrich stock_lookup" ON public.stock_lookup;

CREATE OR REPLACE FUNCTION public.enrich_stock_lookup(
  _ticker text,
  _country text,
  _currency text,
  _exchange text,
  _ipo text,
  _market_cap double precision,
  _share_outstanding double precision,
  _weburl text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _ticker IS NULL OR length(btrim(_ticker)) = 0 THEN
    RAISE EXCEPTION 'ticker required';
  END IF;

  -- Length guards to prevent abuse
  IF coalesce(length(_country),0) > 64
     OR coalesce(length(_currency),0) > 16
     OR coalesce(length(_exchange),0) > 128
     OR coalesce(length(_ipo),0) > 32
     OR coalesce(length(_weburl),0) > 512 THEN
    RAISE EXCEPTION 'field too long';
  END IF;

  UPDATE public.stock_lookup
  SET
    country = COALESCE(NULLIF(_country, ''), country),
    currency = COALESCE(NULLIF(_currency, ''), currency),
    exchange = COALESCE(NULLIF(_exchange, ''), exchange),
    ipo = COALESCE(NULLIF(_ipo, ''), ipo),
    market_cap = COALESCE(_market_cap, market_cap),
    share_outstanding = COALESCE(_share_outstanding, share_outstanding),
    weburl = COALESCE(NULLIF(_weburl, ''), weburl),
    updated_at = now()
  WHERE ticker = upper(_ticker);
END;
$$;

REVOKE ALL ON FUNCTION public.enrich_stock_lookup(text,text,text,text,text,double precision,double precision,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enrich_stock_lookup(text,text,text,text,text,double precision,double precision,text) TO authenticated;
