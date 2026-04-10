

## Fix Table Alignment — Corrected Approach

### Problem
`table-fixed` + `min-w-[1200px]` conflict: the column widths sum to only 905px, so the browser redistributes 295px of extra space unpredictably, breaking alignment. The ticker column's strict width also truncates company names to ~3 characters.

### Solution
Increase column widths so they sum to exactly 1200px, and widen the ticker's `max-w` for the company name. This makes `table-fixed` work as intended — every pixel is accounted for.

### File: `src/components/dashboard/HoldingsTable.tsx`

**New column widths** (905px → 1200px):

| Column | Old | New |
|--------|-----|-----|
| Ticker | 150 | 200 |
| Shares | 60 | 80 |
| Avg Cost | 80 | 100 |
| Price | 80 | 100 |
| Day Chg | 100 | 140 |
| Total P&L | 110 | 150 |
| Value | 90 | 120 |
| Wt% | 55 | 65 |
| Conv. | 75 | 85 |
| Div | 70 | 80 |
| Menu | 35 | 80 |
| **Total** | **905** | **1200** |

Update all `w-[...]` classes on both `<th>` (lines 259–269) and `<td>` (lines 135–166) to the new values. Also update the ticker company name `max-w-[120px]` → `max-w-[170px]` on line 138.

