## Problem

"Ticker not found" still appears for existing holdings (e.g. `GOOG`) because of a race between debounced lookups, not the short-circuit itself.

When the user types `G-O-O-G`:
1. Debounce fires `lookupTicker("G")` after 300ms of pause — `"G"` is not in `existingTickers`, so it calls Finnhub.
2. The user finishes typing `GOOG`. `clearTimeout` cancels future debounces, but the in-flight `getCompanyProfile("G")` is still running.
3. That call resolves with `null` → `setTickerError("Ticker not found")` — overwriting the cleared error, even though the current input is a valid existing ticker.

The short-circuit added previously only protects calls that *start* with the existing symbol. Partial-input calls already in flight bypass it.

## Fix (in `src/components/dashboard/HoldingModal.tsx`)

1. Add a `latestLookupRef = useRef(0)` request-sequence counter.
2. In `lookupTicker(symbol)`:
   - Increment the counter and capture `myId = ++latestLookupRef.current` at the top.
   - After every `await`, bail out if `myId !== latestLookupRef.current` (a newer keystroke has superseded this lookup) — do not touch state.
   - Also bail out if `symbol.toUpperCase() !== ticker.trim().toUpperCase()` via a `tickerRef` (latest typed value), so a stale partial never sets an error for a value the user has moved past.
3. Add `tickerRef` mirroring `ticker` (same pattern as the existing `companyNameRef`), and re-check `existingSetRef.current.includes(tickerRef.current.toUpperCase())` before setting the "not found" error — final safety net.
4. In `handleTickerChange`, also bump `latestLookupRef.current++` so any in-flight call is invalidated immediately on keystroke (not only on debounce schedule).

## Result

- Stale partial-ticker lookups can no longer overwrite the error state for the current (valid) ticker.
- Adding a tax lot for an existing holding never shows "Ticker not found", even with fast typing or slow Finnhub responses.
- New, unknown tickers still surface the error correctly because their lookup is the latest one.

No backend, schema, or styling changes.
