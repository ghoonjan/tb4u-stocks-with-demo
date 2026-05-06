## Problem

In `WatchlistPanel.tsx`, rows where the target price is hit render an extra `<td>` to draw the green left accent bar:

```tsx
{isHit && <td className="absolute left-0 top-0 bottom-0 w-[3px] bg-gain rounded-r" />}
```

Even with `absolute` positioning, the browser still counts it as a real table cell, so every following cell (Ticker, Price, Day Chg, …) is pushed one column to the right. Non-hit rows have no extra cell and render correctly — hence the misalignment visible in the screenshot for AGG and XLP.

## Fix

Remove the rogue `<td>` and draw the accent bar in a way that does not occupy a column:

- Move the accent into the first real cell (Ticker) as an absolutely-positioned `<div>`, or
- Apply it on the `<tr>` via a `border-l-2 border-gain` style when `isHit`.

Preferred approach: put a `<div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gain rounded-r" />` inside the existing first `<td>` (which already gets `relative` positioning implicitly via the row, so add `relative` to that `<td>`). This preserves the exact visual without altering table layout.

## Change scope

- File: `src/components/dashboard/WatchlistPanel.tsx`
  - Delete the standalone `{isHit && <td …/>}` line.
  - Add `relative` to the first `<td>` (Ticker cell).
  - Inside that `<td>`, conditionally render the accent `<div>` when `isHit`.

No other files, styles, or logic change. No DB or API changes.

## Verification

- Hit rows (AGG, XLP) show the green left bar with Ticker / Price / Day Chg / Target / Distance / 52W / P/E / Yield in the same columns as non-hit rows (SDY, VPU).
- Hover, expand-on-click, sorting, and the "X targets hit!" pill continue to work.
