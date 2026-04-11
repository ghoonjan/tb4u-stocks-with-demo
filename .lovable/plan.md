

## Client-Side Request Throttling for Finnhub API

### Problem
Currently, only `getBatchQuotes` staggers requests (200ms delay). But other callers (`getCandles`, `getCompanyNews`, `getBasicFinancials`, etc.) can fire simultaneously, overwhelming the Finnhub free-tier limit of 60 requests/minute.

### Solution
Add a global throttle queue at the `callFinnhub` level so **all** Finnhub requests are serialized with a minimum gap between calls, regardless of which function initiates them.

### Technical Approach

**File: `src/services/marketData.ts`**

1. **Add a request queue** — a simple promise-chain throttle that ensures a minimum 350ms gap between any two Finnhub API calls (~170 req/min max, well under the 60/min free limit with headroom):

```typescript
let lastCall = 0;
let queue: Promise<void> = Promise.resolve();

function throttled<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    queue = queue.then(async () => {
      const wait = Math.max(0, lastCall + 350 - Date.now());
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
      lastCall = Date.now();
      try { resolve(await fn()); }
      catch (e) { reject(e); }
    });
  });
}
```

2. **Wrap `callFinnhub`** — route all requests through the throttle:

```typescript
async function callFinnhub(endpoint, params) {
  return throttled(async () => {
    const { data, error } = await supabase.functions.invoke("finnhub", { ... });
    // existing error handling
    return data;
  });
}
```

3. **Remove the 200ms delay from `getBatchQuotes`** — the global throttle now handles pacing, so the manual `setTimeout` between iterations is redundant.

### What Changes
- One file modified: `src/services/marketData.ts`
- All Finnhub calls automatically queued and spaced 350ms apart
- No UI changes needed — existing caches and error handling remain intact

