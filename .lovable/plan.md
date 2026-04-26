# Wire `date_added` through the holdings stack

The `holdings.date_added` column already exists in the database (`timestamp with time zone`, defaults to `now()`). It's currently ignored by the UI. We'll wire it through the entire stack — no migration needed.

A note on the column type: it's a `timestamptz`, not a `DATE`. We'll send/receive ISO date strings (`YYYY-MM-DD`), which Postgres accepts and coerces cleanly. We'll truncate to the date portion when reading.

---

## 1. `src/components/dashboard/HoldingModal.tsx`

- Extend the `onSubmit` payload type with `date_added: string` (ISO `YYYY-MM-DD`).
- Add a `purchaseDate` state, initialized from `initial?.purchaseDate` (after step 3 adds the field) or today's date for new holdings. Reset alongside the other fields in the `useEffect([open, initial])` block.
- Add a new `<input type="date">` field labeled "Purchase Date" with:
  - `value={purchaseDate}`
  - `max={today}` (today's date, computed once at render as `new Date().toISOString().slice(0,10)`)
  - `required`
- Place it in a new row below the Shares / Avg Cost row (or share that row — design call: keep the existing 2-col grid and add a single full-width row to keep things uncluttered).
- Include `date_added: purchaseDate` in the `onSubmit({ ... })` call.

## 2. `src/hooks/usePortfolioData.ts`

- Add three fields to the `HoldingDisplay` interface:
  - `purchaseDate: string` (ISO `YYYY-MM-DD`)
  - `holdingPeriodDays: number`
  - `isLongTerm: boolean`
- Update `addHolding` signature to accept `date_added: string` and pass it into `supabase.from("holdings").insert({ ..., date_added: data.date_added })`.
- Update `updateHolding` signature to accept `date_added: string` and pass it into the `.update({ ..., date_added: data.date_added })` payload.

## 3. `src/hooks/portfolioUtils.ts` — `toDisplay()`

- Map `h.date_added` → `purchaseDate` as a normalized `YYYY-MM-DD` string (slice the timestamp).
- Compute `holdingPeriodDays` as `Math.floor((todayMs - purchaseMs) / 86_400_000)`, clamped to `>= 0`.
- Set `isLongTerm = holdingPeriodDays > 365`.

## 4. `src/hooks/portfolioUtils.test.ts`

- Update the `makeHolding` factory's `date_added` so existing tests still pass.
- Add tests:
  - `purchaseDate` is the date portion of `date_added`.
  - `holdingPeriodDays` is computed correctly for a recent date (e.g., 10 days ago → 10).
  - `isLongTerm` is `false` for a 100-day-old holding and `true` for a 400-day-old holding.
  - Edge case: a `date_added` equal to today produces `holdingPeriodDays === 0` and `isLongTerm === false`.

## 5. `src/pages/Dashboard.tsx`

- The `onSubmit` handler at line 192 already forwards `data` to `portfolio.addHolding(data)` and `portfolio.updateHolding(editingHolding.id, data)`. Since `data` will now include `date_added` (typed via the modal), this works automatically once the hook signatures accept the new field.
- The `initial={holdingModalInitial}` prop already passes the full `HoldingDisplay`, which will now include `purchaseDate` — the modal can read it directly. No structural changes here, just verifying type alignment compiles.

## What we are NOT doing

- No new database migration — `date_added` already exists.
- No changes to `HoldingDetailCard.tsx` (the user's spec didn't mention it; I'll leave it alone unless asked, to avoid scope creep). If you want the purchase date / holding period shown on the detail card, let me know and I'll add it.
- No changes to the realtime subscription or fetch logic — `date_added` is already returned by `select("*")`.

Once you approve, I'll switch out of plan mode and apply all five changes in one pass.