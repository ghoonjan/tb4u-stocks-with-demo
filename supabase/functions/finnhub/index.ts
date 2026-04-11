const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FINNHUB_BASE = 'https://finnhub.io/api/v1';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
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

    // Check cache
    const sortedParams = new URLSearchParams(Object.entries(params || {}).sort());
    const cacheKey = `${endpoint}:${sortedParams.toString()}`;
    const ttl = TTL[endpoint] ?? 60_000;
    const cached = cache.get(cacheKey);

    if (cached && Date.now() - cached.ts < ttl) {
      const ttlSeconds = Math.ceil((ttl - (Date.now() - cached.ts)) / 1000);
      return new Response(JSON.stringify(cached.data), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-Cache': 'HIT',
          'Cache-Control': `public, max-age=${ttlSeconds}`,
        },
      });
    }

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

    // Store in cache
    cache.set(cacheKey, { data, ts: Date.now() });
    evictIfNeeded();

    const ttlSeconds = Math.ceil(ttl / 1000);
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
