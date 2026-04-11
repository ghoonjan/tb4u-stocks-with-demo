

## Persistent Database Cache for Finnhub API Responses

### Overview
Add a database table as a second-level cache behind the existing in-memory `Map`. The edge function checks memory first, then the database, and only calls Finnhub as a last resort. This ensures cache survives across cold starts and instance restarts.

### Database Changes

**New table: `finnhub_cache`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Default `gen_random_uuid()` |
| `cache_key` | text (unique) | `endpoint:sorted_params` |
| `endpoint` | text | For cleanup queries |
| `response_data` | jsonb | The cached API response |
| `cached_at` | timestamptz | `now()` |
| `ttl_seconds` | integer | TTL for this entry |

No RLS needed — this table is only accessed from the edge function using the service role key, not from the client.

**Database function for cleanup:**
A `cleanup_stale_finnhub_cache()` function that deletes rows where `cached_at + ttl_seconds < now()`. Called periodically from the edge function (e.g., 1 in 20 requests) to avoid unbounded growth.

### Edge Function Changes

**File: `supabase/functions/finnhub/index.ts`**

Update the request flow to a two-tier cache:

```text
Request → In-memory Map (L1) → Database table (L2) → Finnhub API
```

1. Import `createClient` from `@supabase/supabase-js` and initialize with the service role key
2. On cache miss from the in-memory `Map`, query `finnhub_cache` for a row matching the cache key where `cached_at + ttl_seconds > now()`
3. If found, populate the in-memory cache and return the response
4. If not found, call Finnhub, then upsert into both the in-memory cache and the database table
5. On ~5% of requests, run the cleanup function to prune expired rows

### What Changes
- **Migration**: One new table `finnhub_cache` + one cleanup function
- **Edge function**: `supabase/functions/finnhub/index.ts` — add database reads/writes as L2 cache
- **No client-side changes** — the existing client code and in-memory L1 cache remain untouched

