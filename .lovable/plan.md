

## Fix Table Column Alignment — Root Cause and New Approach

### Problem Analysis
The code has 11 `<th>` and 11 `<td>` elements with matching widths, yet data visually shifts one column right. The `table-fixed` + `w-full` combination is the culprit: when the table container is wider than 1200px, the `w-full` class stretches the table beyond the sum of column widths, and `table-fixed` redistributes space unpredictably — sometimes collapsing the first column's visible content area.

### Solution
Replace the per-cell width approach with a `<colgroup>` block that defines column widths at the table level. This is the standard HTML mechanism for fixed column sizing and works reliably with or without `table-fixed`. Also remove the redundant `w-[...]` classes from all `<th>` and `<td>` elements to avoid conflicts.

### File: `src/components/dashboard/HoldingsTable.tsx`

**1. Change the `<table>` element** (line 256) — remove `table-fixed`:
```tsx
<table className="w-full min-w-[1200px]" role="table">
```

**2. Add `<colgroup>` immediately after the opening `<table>` tag** (after line 256):
```tsx
<colgroup>
  <col style={{ width: 200 }} />
  <col style={{ width: 80 }} />
  <col style={{ width: 100 }} />
  <col style={{ width: 100 }} />
  <col style={{ width: 140 }} />
  <col style={{ width: 150 }} />
  <col style={{ width: 120 }} />
  <col style={{ width: 65 }} />
  <col style={{ width: 85 }} />
  <col style={{ width: 80 }} />
  <col style={{ width: 80 }} />
</colgroup>
```

**3. Remove all `w-[...]` classes** from every `<th>` (lines 259–269) and `<td>` (lines 135–166) to prevent conflicts with the colgroup definitions.

This ensures the table columns are sized at the structural level, independent of cell content or layout algorithm quirks.

