

## Fix: Trade Journal Close Button Off-Screen in Portrait

### Root Cause
`TradeJournalPanel` opens a left-side `Sheet` with hardcoded width `w-[420px] sm:w-[460px]`. On phones in portrait (e.g., 390px wide), the panel is wider than the viewport, pushing the absolutely-positioned close button (`right-4 top-4`) off-screen to the right. In landscape, the viewport is wide enough for the full 420px panel, so the X is visible.

This also explains the clipped "Top Reas…" stat label in the portrait screenshot — the entire panel overflows the viewport.

### Fix
Change the SheetContent width in `src/components/dashboard/TradeJournalPanel.tsx` from a fixed pixel width to a responsive width that never exceeds the viewport on mobile:

```tsx
// Before
<SheetContent side="left" className="w-[420px] sm:w-[460px] bg-card border-border p-0 flex flex-col">

// After  
<SheetContent side="left" className="w-full max-w-[420px] sm:max-w-[460px] bg-card border-border p-0 flex flex-col">
```

`w-full` makes it fill the viewport on small screens (so the X stays on-screen), while `max-w-[420px]` / `sm:max-w-[460px]` preserves the desktop sizing.

### What Changes
- One line in `src/components/dashboard/TradeJournalPanel.tsx` (line 87)
- No other components affected — desktop/landscape behavior is unchanged; mobile portrait now fits the viewport with a visible close button

