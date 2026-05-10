## Bug Fix: Admin template builder — dedupe ticker into tax lot

### Problem

`src/pages/AdminTemplates.tsx` `handleSubmitHolding` always does a plain `INSERT INTO holdings`, creating duplicate rows when an admin adds an already-existing ticker. The user portfolio flow in `src/hooks/usePortfolioData.ts` (`addHolding`, lines 190–294) already handles this correctly: it detects an existing ticker (case-insensitive), inserts a new `tax_lots` row, and recalculates the parent holding's `shares` / `avg_cost_basis` / `date_added` from all lots.

### Fix

1. **Extract shared helper** `src/lib/holdingMutations.ts`:
   ```ts
   addHoldingOrLot({
     portfolioId: string,
     existingHoldings: { id: string; ticker: string }[],
     data: { ticker, company_name, shares, avg_cost_basis, conviction_rating,
             thesis?, target_allocation_pct?, date_added },
     logTradeForUserId?: string,   // optional — only set for real user portfolios
   }): Promise<{ ok: boolean; mode: "lot" | "new"; ticker: string; error?: string }>
   ```
   Logic mirrors `usePortfolioData.addHolding` exactly:
   - Uppercase ticker, look up existing match in `existingHoldings` (case-insensitive).
   - If match: insert `tax_lots` row (`shares`, `shares_remaining=shares`, `cost_basis_per_share`, `purchased_at`); refetch all lots for that holding; recompute `totalShares`, weighted `avgCost = SUM(shares_remaining * cost) / SUM(shares_remaining)`, earliest `purchased_at`; `UPDATE holdings` with those values. Return `mode: "lot"`.
   - Else: insert into `holdings`, then seed an initial `tax_lots` row from the same shares/cost/date. Return `mode: "new"`.
   - If `logTradeForUserId` is provided, also insert a `trade_journal` BUY row (so admin template edits don't pollute the admin's personal journal).
   - Returns errors instead of toasting, so each caller can surface its own toast style (Sonner vs `useToast`).

2. **Refactor `src/hooks/usePortfolioData.ts`** `addHolding` to call `addHoldingOrLot`, passing `existingHoldings: rawHoldingsRef.current.map(h => ({ id: h.id, ticker: h.ticker }))` and `logTradeForUserId: userId`. Keep the existing `useToast` calls for success/error and the `fetchData()` refresh. Behavior and toast strings ("Added new lot to X", "Holding added") unchanged.

3. **Fix `src/pages/AdminTemplates.tsx` `handleSubmitHolding`**:
   - Edit branch (`editingHolding` truthy): unchanged — still a direct `UPDATE holdings`.
   - Add branch: call `addHoldingOrLot({ portfolioId: template.id, existingHoldings: holdings.map(h => ({ id: h.id, ticker: h.ticker })), data })` (no `logTradeForUserId`).
   - On success, sonner toast based on returned `mode`:
     - `"lot"` → `Added new tax lot for ${TICKER}`
     - `"new"` → `Added ${TICKER} to template`
   - On error → `toast.error(error)`, return `false`.
   - Then `setHoldingModalOpen(false); setEditingHolding(null); void load();` and `return true;`.

4. **Pass `existingTickers` to `HoldingModal` in admin** so its existing "Add Lot" UI affordance lights up consistently:
   ```tsx
   <HoldingModal
     ...
     existingTickers={holdings.map(h => h.ticker)}
   />
   ```
   (UI behavior of the modal is unchanged — it already supports this prop in the user flow.)

### Out of scope

- No DB migration. The `tax_lots` RLS policy joins `holdings → portfolios.user_id = auth.uid()`; super admins own their template portfolio rows, so existing policies allow these inserts/updates.
- No changes to `HoldingModal.tsx` internals, no other UI changes.
- No changes to the template-cloning function (`clone_template_for_user`) — it copies only `holdings`. If template tax lots also need to seed into new users, that's a separate ticket.

### Verification

- Build passes.
- Manual: as super admin on `/admin/templates`, add `AAPL` (new) → one holdings row + one tax_lots row, toast "Added AAPL to template". Add `aapl` again with different shares/cost/date → no new holdings row; new tax_lots row; parent holding's `shares` = sum and `avg_cost_basis` = weighted avg; toast "Added new tax lot for AAPL".
- User dashboard add-holding flow continues to work identically (same shared helper).
