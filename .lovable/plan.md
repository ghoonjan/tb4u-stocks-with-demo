## Goal
Stop the "Add Holding" flow from creating duplicate holdings when the ticker already exists in the portfolio. Instead, treat it as adding another tax lot to the existing holding. Also adapt the modal UI and clean up any duplicates already in the database.

## Changes

### 1. `src/hooks/usePortfolioData.ts` — fix `addHolding`
Before inserting, look up an existing holding by case-insensitive ticker match against `rawHoldingsRef.current`.

- **No match** → keep current behavior (insert holding + seed initial tax lot + toast "Holding added").
- **Match found** →
  - Insert a new row into `tax_lots` with:
    - `holding_id` = existing holding's id
    - `shares`, `shares_remaining` = form `shares`
    - `cost_basis_per_share` = form `avg_cost_basis`
    - `purchased_at` = `data.date_added.slice(0, 10)`
  - Re-fetch all `tax_lots` for that `holding_id`.
  - Recalculate parent holding row:
    - `shares` = sum of `shares_remaining`
    - `avg_cost_basis` = `Σ(shares_remaining × cost_basis_per_share) / Σ(shares_remaining)`, rounded to 4 decimals (guard divide-by-zero)
    - `date_added` = earliest `purchased_at`
  - `UPDATE holdings` with those values.
  - Toast: `Added new lot to {TICKER}`.
  - `await fetchData()` and return `true`.
- Errors at any step → destructive toast + return `false`.

`updateHolding`, `deleteHolding`, and the rest of the file are unchanged.

### 2. `src/components/dashboard/HoldingModal.tsx` — adapt UI when ticker exists
Add a new optional prop `existingTickers: string[]` (uppercase set passed from parent — Dashboard already has `holdings`). Derive:

```ts
const isAddingLot = !initial && existingTickers.includes(ticker.trim().toUpperCase()) && ticker.trim().length > 0;
```

When `isAddingLot` is true (and not in edit mode):
- Modal title → `Add Lot to {TICKER}`
- Submit button text → `Add Lot` (still `Saving...` while in flight)
- Show an info paragraph below the ticker input: `{TICKER} is already in your portfolio. This will add a new purchase lot.`
- Hide the Conviction Rating, Investment Thesis, and Target Allocation % fields (skip rendering). Company Name field stays — it's needed only by the new-holding branch and is harmless when ignored by the lot branch; but to keep the form tidy we'll also hide Company Name when `isAddingLot` (the existing holding already has it; submit will pass the empty string, which `addHolding` ignores in the lot branch).
- Keep visible: Ticker, Shares, Avg Cost / Share, Purchase Date.

Edit mode (`initial`) is unaffected — keeps existing read-only behavior.

Find the call sites of `HoldingModal` (Dashboard etc.) and pass `existingTickers={holdings.map(h => h.ticker.toUpperCase())}`. (Will read those files during implementation; no behavior change beyond the new prop.)

### 3. Database migration — collapse existing duplicate holdings
Run the provided `DO $$ ... $$` block as a Supabase migration. For every `(portfolio_id, ticker)` group with >1 rows:
- Pick the oldest row as the keeper.
- Re-parent all `tax_lots` from the duplicates to the keeper.
- Delete duplicate holding rows.
- Recalculate keeper's `shares`, `avg_cost_basis` (4-decimal weighted avg), and `date_added` (earliest `purchased_at`).

Safe no-op if there are no duplicates.

## Out of scope
- `src/hooks/useTaxLots.ts` and `src/components/dashboard/TaxLotsPanel.tsx` are untouched (the in-panel "Add Lot" flow already works).
- No change to `updateHolding`/`deleteHolding`.

## Verification
- `tsc --noEmit` after the code edits.
- Manually: in preview, add a holding for a brand-new ticker (creates holding + lot); add the same ticker again (creates an additional lot, no duplicate holding row, parent shares/avg cost recalculated, toast says "Added new lot to ...").
