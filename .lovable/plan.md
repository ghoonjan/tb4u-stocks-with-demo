## Fix watchlist column alignment

In `src/components/dashboard/WatchlistPanel.tsx`:

1. Change `<table className="w-full min-w-[900px]">` to `<table className="w-full min-w-[900px] table-fixed">`.
2. Insert a `<colgroup>` immediately inside the `<table>` with fixed `<col>` widths: Ticker 130, Price 80, Day Chg 110, Target 90, Distance 110, 52W 80, P/E 60, Yield 60, Actions 90.
3. Remove the now-redundant `w-[…]` classes from each `<th>` (keep padding/alignment).
4. No other changes — sort, expand, inline target edit, hit-row green bar, and horizontal scroll all preserved.

This mirrors the `<colgroup>` pattern already used in HoldingsTable and locks Price, Day Chg, Target, Distance, P/E, and Yield into identical x-positions across hit and non-hit rows.
