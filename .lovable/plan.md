

## Fix Table Column Alignment on Desktop

### Problem
The width classes (`w-[150px]`, `w-[60px]`, etc.) on `<th>` and `<td>` are being ignored because the table uses the browser's default `table-layout: auto` algorithm, which sizes columns based on content rather than declared widths. This causes body data to shift relative to headers.

### Solution
Add `table-fixed` (Tailwind's `table-layout: fixed`) to the `<table>` element. This forces the browser to respect the explicit width classes on the first row (headers), and all body cells will inherit those widths.

### File: `src/components/dashboard/HoldingsTable.tsx`

**Line 256** — Change:
```tsx
<table className="w-full min-w-[1200px]" role="table">
```
to:
```tsx
<table className="w-full min-w-[1200px] table-fixed" role="table">
```

One line, one class addition. That's the entire fix.

