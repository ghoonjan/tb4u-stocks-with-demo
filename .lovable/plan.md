## Problem

When opening "Add Holding" and typing a ticker that already exists in the portfolio (e.g. `GOOG`), the modal shows both:
- "Ticker not found" (red error)
- "GOOG is already in your portfolio. This will add a new purchase lot." (blue hint)

Root cause: `lookupTicker` always calls the Finnhub profile API, even when the ticker is already a known holding. If the lookup misses (rate-limit / cache miss / unknown to Finnhub), `setTickerError("Ticker not found")` fires even though the ticker is clearly valid (we own it).

A secondary issue: `companyName` is captured in the `lookupTicker` closure, so when the user types fast the wrong stale value is used.

## Fix (in `src/components/dashboard/HoldingModal.tsx`)

1. Add refs that always reflect the latest `existingTickers`, `companyName`, and modal-open state:
   - `existingSetRef` — uppercase set of existing tickers, refreshed on every render.
   - `companyNameRef` — current company name.
   - `modalOpenRef` — current `open` value, so an in-flight lookup that resolves after the modal closes/reopens is discarded.

2. In `lookupTicker`:
   - Short-circuit before the API call when `existingSetRef.current.includes(symbol.toUpperCase())` — clear error, stop spinner, return.
   - Read `companyNameRef.current` instead of the closed-over `companyName`.
   - Bail out of `setState` calls if `!modalOpenRef.current`.
   - Drop the `[companyName]` dependency so the callback identity is stable.

3. Compute `isAddingLot` from `existingSetRef.current` (keeps the banner consistent with the lookup short-circuit).

4. Update `handleTickerChange` deps to `[lookupTicker]` only (already correct, but confirm after refactor).

## Result

- Adding a lot to an existing ticker (`GOOG`, `AAPL`, etc.) skips the API entirely → no false "Ticker not found".
- Stale-closure race between debounce + company name autofill is gone.
- New tickers still get full Finnhub validation.

No backend, schema, or styling changes.
