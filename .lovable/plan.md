

## Fix: Holdings Table Scroll Shadows Not Working

### Problem
The outer wrapper of the holdings table (line 254 of `HoldingsTable.tsx`) has `overflow-hidden`, which clips the content and prevents the inner `overflow-x-auto` div from actually scrolling horizontally. The table data is visually clipped but not scrollable.

### Root Cause
```
<div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
```
The `overflow-hidden` was likely added to maintain the `rounded-2xl` border radius (browsers need `overflow: hidden` on rounded containers to clip child content to the curve). However, it also prevents horizontal scrolling of the inner table.

### Fix

**File: `src/components/dashboard/HoldingsTable.tsx`** (line 254)

- Remove `overflow-hidden` from the outer wrapper
- Add `overflow-hidden` to the `ScrollShadowWrapper`'s outer `relative` div instead, so the border-radius clipping still works at the scroll container level while allowing `overflow-x-auto` on the inner div

Specifically:
1. Change line 254 from `overflow-hidden` to just removing it (keep the rounded corners)
2. In `ScrollShadowWrapper`, update the outer `<div className="relative">` to `<div className="relative overflow-hidden rounded-2xl">` — but this won't work either because it also clips the scroll.

**Better approach**: Keep `overflow-hidden` on the outer div but change the `ScrollShadowWrapper`'s inner div from `overflow-x-auto` to `overflow-x-scroll` — actually, this won't help either since the parent clips it.

**Correct fix**: Replace `overflow-hidden` with `overflow-x-auto` on the outer div (line 254), and move the scroll detection logic to that level. Or simpler: remove `overflow-hidden` from line 254 and let the `ScrollShadowWrapper` handle clipping with its own `overflow-hidden` on the relative wrapper while keeping `overflow-x-auto` on the scroll div.

The cleanest approach:
1. **Line 254**: Remove `overflow-hidden`, keep everything else
2. **ScrollShadowWrapper**: Change outer div to `<div className="relative overflow-clip rounded-b-2xl">` — `overflow-clip` clips for visual rounding without creating a scroll container

Actually, the simplest fix: just move `overflow-hidden` off the outer wrapper. The `rounded-2xl` visual clipping is cosmetic — the `ScrollShadowWrapper`'s `overflow-x-auto` already constrains the horizontal overflow properly. Without `overflow-hidden`, the table will scroll as expected.

### Changes
- **One line change** in `src/components/dashboard/HoldingsTable.tsx`: Remove `overflow-hidden` from the outer `<div>` on line 254.

