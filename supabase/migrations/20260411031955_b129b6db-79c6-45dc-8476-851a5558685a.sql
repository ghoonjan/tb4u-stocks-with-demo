
-- Create finnhub_cache table for persistent API response caching
CREATE TABLE public.finnhub_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key text NOT NULL UNIQUE,
  endpoint text NOT NULL,
  response_data jsonb NOT NULL,
  cached_at timestamptz NOT NULL DEFAULT now(),
  ttl_seconds integer NOT NULL DEFAULT 60
);

-- Index for cleanup queries
CREATE INDEX idx_finnhub_cache_cached_at ON public.finnhub_cache (cached_at);

-- Enable RLS but add no policies (service role bypasses RLS)
ALTER TABLE public.finnhub_cache ENABLE ROW LEVEL SECURITY;

-- Cleanup function to remove expired entries
CREATE OR REPLACE FUNCTION public.cleanup_stale_finnhub_cache()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.finnhub_cache
  WHERE cached_at + (ttl_seconds || ' seconds')::interval < now();
$$;
