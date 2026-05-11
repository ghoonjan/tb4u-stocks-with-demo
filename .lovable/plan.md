## Goal
Show holdings sorted alphabetically by ticker by default, so AAPL sits at the top of the list for new (cloned) users — and for everyone else.

## Why a UI change, not a database change
The `clone_template_for_user` RPC already inserts holdings in a defined order, but `HoldingsTable` re-sorts them client-side. Currently the default is `sortKey = "weight"` (descending), which is why AAPL is not at the top after cloning. Changing the insert order in the database would have no visible effect because the table always re-sorts. The fix lives in the UI.

## Change
In `src/components/dashboard/HoldingsTable.tsx`:
- Change the default `useState<SortKey>("weight")` → `useState<SortKey>("ticker")`
- Change the default `useState<SortDir>("desc")` → `useState<SortDir>("asc")`

Users can still click any column header to re-sort; only the initial order changes.

## Out of scope
- No database / RPC changes
- No changes to the mobile card sort dropdown logic (it reads the same state, so it will reflect the new default automatically)
- No changes to watchlist ordering