

## Add Server-Side Caching to Finnhub Edge Function

### Why
Currently, all caching lives client-side in `marketData.ts`. Every browser tab, every user, every page load hits the Finnhub API independently. Server-side caching in the edge function means repeated requests for the same ticker across all users return cached data, dramatically reducing Finnhub API calls and rate-limit hits.

### Approach
Use a **Deno in-memory `Map`** inside the edge function with endpoint-specific TTLs. Edge function instances persist across requests (until shutdown), so the cache survives multiple calls within the same instance lifecycle.

### Changes

**File: `supabase/functions/finnhub/index.ts`**

1. Add a `Map<string, { data: unknown; ts: number }>` cache at module scope
2. Define TTLs per endpoint:
   - `/quote` — 60 seconds (prices change frequently)
   - `/stock/profile2` — 1 hour (rarely changes)
   - `/stock/metric` — 1 hour
   - `/stock/candle` — 5 minutes
   - `/company-news` — 10 minutes
   - `/calendar/earnings`, `/stock/earnings` — 1 hour
3. Build a cache key from `endpoint + sorted params` (excluding the API token)
4. Before calling Finnhub, check the cache. If a valid entry exists, return it immediately
5. After a successful Finnhub response, store in cache
6. Add a `Cache-Control` response header so CDN/browser layers can also benefit
7. Cap cache size (evict oldest entries beyond 500) to prevent memory growth

### Technical Detail

```typescript
const cache = new Map<string, { data: unknown; ts: number }>();
const TTL: Record<string, number> = {
  '/quote': 60_000,
  '/stock/profile2': 3600_000,
  '/stock/metric': 3600_000,
  '/stock/candle': 300_000,
  '/company-news': 600_000,
  '/calendar/earnings': 3600_000,
  '/stock/earnings': 3600_000,
};

// Cache key = endpoint + sorted param string (no token)
const cacheKey = `${endpoint}:${new URLSearchParams(params).toString()}`;
const cached = cache.get(cacheKey);
const ttl = TTL[endpoint] ?? 60_000;
if (cached && Date.now() - cached.ts < ttl) {
  return new Response(JSON.stringify(cached.data), { headers: ... });
}
```

No database tables or client-side changes needed. The existing client-side cache remains as a second layer.

