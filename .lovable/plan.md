

## Horizontal Scroll Indicator for Holdings Table

### What You'll See
A subtle gradient shadow on the right edge of the table that fades in when there are more columns to scroll to, and fades out once you've scrolled all the way right. A matching left shadow appears once you start scrolling right. This is a common UX pattern that hints at hidden content.

### Technical Approach

**File: `src/components/dashboard/HoldingsTable.tsx`**

1. Add a `useRef` and scroll state tracking (`canScrollLeft`, `canScrollRight`) to the desktop table's `overflow-x-auto` wrapper div (line 255).
2. Attach an `onScroll` handler and a `ResizeObserver` to detect whether the container has overflowing content on either side.
3. Wrap the scroll container in a parent `div` with `relative overflow-hidden` and render two absolutely-positioned gradient overlays:
   - **Right shadow**: `bg-gradient-to-l from-background/80 to-transparent` — visible when `canScrollRight` is true
   - **Left shadow**: `bg-gradient-to-r from-background/80 to-transparent` — visible when `canScrollLeft` is true
4. Both overlays use a `transition-opacity` for smooth fade in/out.

**No CSS file changes needed** — this is all inline Tailwind on 2-3 new elements wrapping the existing scroll div.

