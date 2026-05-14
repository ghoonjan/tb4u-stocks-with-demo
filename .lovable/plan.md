# Debug Finnhub 401

## Findings
`supabase/functions/finnhub/index.ts` line 68 reads the key with `Deno.env.get('FINNHUB_API_KEY')` on every request — no hardcoding, no module-level capture. So a stale value can only mean the deployed function predates the secret update, or the secret value itself differs from what you're testing in the browser.

The L2 DB cache (`finnhub_cache`) could also be masking success/failure for `/stock/profile2?symbol=COST` if a prior bad response was stored — but only successful responses are written, so this is unlikely the cause. Worth clearing if needed.

## Plan

1. **Edit `supabase/functions/finnhub/index.ts`**: right after reading `apiKey`, add:
   ```ts
   console.log(`Using Finnhub key: ${apiKey?.slice(0, 4)}... (len=${apiKey?.length})`);
   ```
   Also log endpoint + Finnhub status when `!response.ok` (already logs status+body — fine).

2. **Redeploy** the `finnhub` edge function so it picks up the latest secret value.

3. **Test** by calling the function with `endpoint=/stock/profile2`, `params={symbol:"COST"}` via `curl_edge_functions`, then fetch `edge_function_logs` for `finnhub` and show you:
   - the "Using Finnhub key: xxxx..." prefix line
   - the response body / any 401 error from Finnhub

4. If the prefix doesn't match the key you're testing in the browser → secret needs to be re-set. If it matches but Finnhub still returns 401 → the key itself is the problem (wrong tier/revoked).

No other files change. Only one log line added; removed after debugging if you want.
