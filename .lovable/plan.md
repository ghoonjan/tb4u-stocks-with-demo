

## Fix Table Column Alignment

### Problem
The `<th>` headers have explicit width classes but the `<td>` cells do not, allowing the browser's table layout algorithm to calculate different widths for header vs. body columns. This causes data to visually shift relative to its header.

### Solution
Add matching width classes to each `<td>` in the `HoldingRow` component so they lock to the same column widths as the headers.

### File: `src/components/dashboard/HoldingsTable.tsx`

Update the 11 `<td>` elements in `HoldingRow` (lines 135–168) to include the same `w-[...]` classes used on their corresponding `<th>`:

| Column | Width | Header line | Cell line |
|--------|-------|-------------|-----------|
| Ticker | `w-[150px]` | 259 | 135 |
| Shares | `w-[60px]` | 260 | 141 |
| Avg Cost | `w-[80px]` | 261 | 142 |
| Price | `w-[80px]` | 262 | 143 |
| Day Chg | `w-[100px]` | 263 | 144 |
| Total P&L | `w-[110px]` | 264 | 150 |
| Value | `w-[90px]` | 265 | 154 |
| Wt% | `w-[55px]` | 266 | 155 |
| Conv. | `w-[75px]` | 267 | 156 |
| Div | `w-[70px]` | 268 | 157 |
| Menu | `w-[35px]` | 269 | 166 |

### R2 Upload Error
The `dist upload failed` error is a transient Cloudflare infrastructure issue (HTTP 500). No code fix needed — just retry the publish/deploy.

