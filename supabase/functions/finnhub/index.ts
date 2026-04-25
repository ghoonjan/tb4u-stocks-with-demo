import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FINNHUB_BASE = 'https://finnhub.io/api/v1';

// L1: In-memory cache (per-instance)
const cache = new Map<string, { data: unknown; ts: number }>();
const MAX_CACHE_SIZE = 500;

const TTL: Record<string, number> = {
  '/quote': 60_000,
  '/stock/profile2': 3_600_000,
  '/stock/metric': 3_600_000,
  '/stock/candle': 300_000,
  '/company-news': 600_000,
  '/calendar/earnings': 3_600_000,
  '/stock/earnings': 3_600_000,
};

function evictIfNeeded() {
  if (cache.size <= MAX_CACHE_SIZE) return;
  let oldestKey: string | null = null;
  let oldestTs = Infinity;
  for (const [key, entry] of cache) {
    if (entry.ts < oldestTs) {
      oldestTs = entry.ts;
      oldestKey = key;
    }
  }
  if (oldestKey) cache.delete(oldestKey);
}

function getSupabaseAdmin() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, serviceKey);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // --- Auth check: require valid JWT to prevent API key exhaustion ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('FINNHUB_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'FINNHUB_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { endpoint, params } = await req.json();
    const allowedEndpoints = ['/quote', '/stock/profile2', '/stock/metric', '/stock/candle', '/company-news', '/calendar/earnings', '/stock/earnings'];
    if (!allowedEndpoints.includes(endpoint)) {
      return new Response(JSON.stringify({ error: 'Endpoint not allowed' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sortedParams = new URLSearchParams(Object.entries(params || {}).sort());
    const cacheKey = `${endpoint}:${sortedParams.toString()}`;
    const ttl = TTL[endpoint] ?? 60_000;
    const ttlSeconds = Math.ceil(ttl / 1000);

    // --- L1: In-memory cache ---
    const l1 = cache.get(cacheKey);
    if (l1 && Date.now() - l1.ts < ttl) {
      const remainingSeconds = Math.ceil((ttl - (Date.now() - l1.ts)) / 1000);
      return new Response(JSON.stringify(l1.data), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-Cache': 'HIT-L1',
          'Cache-Control': `public, max-age=${remainingSeconds}`,
        },
      });
    }

    // --- L2: Database cache ---
    const supabaseAdmin = getSupabaseAdmin();
    
    try {
      const { data: dbRow } = await supabaseAdmin
        .from('finnhub_cache')
        .select('response_data, cached_at, ttl_seconds')
        .eq('cache_key', cacheKey)
        .single();

      if (dbRow) {
        const cachedAt = new Date(dbRow.cached_at).getTime();
        const dbTtl = dbRow.ttl_seconds * 1000;
        if (Date.now() - cachedAt < dbTtl) {
          // Populate L1
          cache.set(cacheKey, { data: dbRow.response_data, ts: cachedAt });
          evictIfNeeded();

          const remainingSeconds = Math.ceil((dbTtl - (Date.now() - cachedAt)) / 1000);
          return new Response(JSON.stringify(dbRow.response_data), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
              'X-Cache': 'HIT-L2',
              'Cache-Control': `public, max-age=${remainingSeconds}`,
            },
          });
        }
      }
    } catch {
      // L2 miss or DB error — continue to Finnhub
    }

    // --- Finnhub API call ---
    const queryParams = new URLSearchParams({ ...params, token: apiKey });
    const url = `${FINNHUB_BASE}${endpoint}?${queryParams.toString()}`;
    const response = await fetch(url);

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: 'rate_limit', message: 'Finnhub rate limit reached', fallback: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Finnhub API error:', response.status, errorText);
      return new Response(JSON.stringify({ error: `API error: ${response.status}`, fallback: response.status >= 500 }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();

    // Store in L1
    cache.set(cacheKey, { data, ts: Date.now() });
    evictIfNeeded();

    // Store in L2 (fire-and-forget upsert)
    supabaseAdmin
      .from('finnhub_cache')
      .upsert({
        cache_key: cacheKey,
        endpoint,
        response_data: data,
        cached_at: new Date().toISOString(),
        ttl_seconds: ttlSeconds,
      }, { onConflict: 'cache_key' })
      .then(({ error }) => {
        if (error) console.error('L2 cache write error:', error.message);
      });

    // Probabilistic cleanup (~5% of requests)
    if (Math.random() < 0.05) {
      supabaseAdmin.rpc('cleanup_stale_finnhub_cache').then(({ error }) => {
        if (error) console.error('Cache cleanup error:', error.message);
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Cache': 'MISS',
        'Cache-Control': `public, max-age=${ttlSeconds}`,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
