

## Fix: Holdings Table Horizontal Scrolling Broken

### Problem
After removing `overflow-hidden` from the outer wrapper (line 254), the table content overflows the viewport without creating a scrollbar. The `overflow-x-auto` div expands to the table's 1200px width because nothing constrains it — so there's nothing to scroll.

### Root Cause
The `overflow-hidden` on the outer wrapper was **needed** to constrain the width of the inner scroll container. Without it, the chain is:
```text
outer div (no overflow) → div.relative → div.overflow-x-auto → table (1200px)
```
Each div expands to fit 1200px. No scrollbar is generated because `overflow-x-auto` only scrolls when its content exceeds its own width — and its width grew to match the table.

### Fix

**File: `src/components/dashboard/HoldingsTable.tsx`**

1. **Add `overflow-hidden` back to the outer wrapper** (line 254) — this constrains the scroll container width and makes the horizontal scrollbar appear.

```tsx
// Line 254: restore overflow-hidden
<div className="rounded-2xl border border-border/50 bg-card overflow-hidden" style={{ boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.04)" }}>
```

The shadow gradient fix (`from-card/90`, `w-12`) is already in place from the previous change and will now actually be visible once scrolling works.

### What Changes
- One line in `HoldingsTable.tsx`: add `overflow-hidden` back to the outer wrapper
- Horizontal scrolling will work again, and the shadow indicators will be visible

