## Prompt 3: `useTaxLots` data hook

Create `src/hooks/useTaxLots.ts` exporting `useTaxLots(holdingId)` and a `recalcHolding(holdingId)` helper.

### Behavior

- Fetches `tax_lots` for the given `holding_id`, ordered by `purchased_at` ascending. Returns `{ lots, isLoading, addLot, updateLot, deleteLot, refetch }`.
- `addLot({ shares, cost_basis_per_share, purchased_at, notes? })` inserts with `shares_remaining = shares`.
- `updateLot(id, partial)` updates the given fields (allows editing `shares`, `cost_basis_per_share`, `purchased_at`, `notes`, and optionally `shares_remaining`).
- `deleteLot(id)` deletes the lot.
- After every mutation: call `recalcHolding(holdingId)`, then refetch lots.
- Uses `sonner` toasts on success/error (matches project convention — see Portfolio Management memory).

### `recalcHolding(holdingId)`

Pure helper, also exported so other code (e.g. future tests) can reuse it.

1. Select `shares_remaining, cost_basis_per_share, purchased_at` for all lots of the holding.
2. If no lots: return early (do not zero out the holding — avoids corrupting data if all lots are deleted in flight).
3. Compute:
   - `shares = SUM(shares_remaining)`
   - `avg_cost_basis = SUM(shares_remaining * cost_basis_per_share) / SUM(shares_remaining)` (guard divide-by-zero)
   - `date_added = MIN(purchased_at)` converted to ISO timestamp (holdings.date_added is `timestamptz`; tax_lots.purchased_at is `date`)
4. `update` the `holdings` row.

### Notes / deviations

- I'll early-return on zero lots rather than wiping the holding to 0 shares. If you'd prefer wiping, say so.
- This hook is the data layer only — no UI yet (that's Prompt 4+).
- No changes to `usePortfolioData`. The realtime subscription on `holdings` will pick up the recalculated values automatically.

### Files

- **New:** `src/hooks/useTaxLots.ts`
