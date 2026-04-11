

## Fix: Scroll Shadow Indicators Not Visible

### Testing Results
- **Scroll works**: After removing `overflow-hidden`, the table scrolls horizontally at narrower viewports (confirmed at 768px iPad width).
- **Shadows not visible**: The gradient overlays render but are virtually invisible because they use `from-background/80` while the table uses `bg-card`. In the dark theme, these two colors are nearly identical, so the shadow blends in.

### Fix

**File: `src/components/dashboard/HoldingsTable.tsx`** — `ScrollShadowWrapper` component (lines 56-62)

Two changes to make shadows visible:

1. **Change gradient color from `background` to `card`** — match the surface the table sits on.
2. **Increase shadow width from `w-8` to `w-12`** — make the fade more noticeable.

```tsx
// Left shadow (line 56-58)
<div
  className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-card/90 to-transparent transition-opacity duration-200"
  style={{ opacity: canScrollLeft ? 1 : 0 }}
/>
// Right shadow (line 60-62)
<div
  className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-card/90 to-transparent transition-opacity duration-200"
  style={{ opacity: canScrollRight ? 1 : 0 }}
/>
```

### What Changes
- One file: `src/components/dashboard/HoldingsTable.tsx`
- Shadow gradient color: `from-background/80` → `from-card/90`
- Shadow width: `w-8` → `w-12`
- Shadows will now visually match the card surface and be clearly visible when scrolling

