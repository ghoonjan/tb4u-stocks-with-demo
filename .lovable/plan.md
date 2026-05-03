# Phase 4 — Prompt 5: Welcome banner for new users

## New component: `src/components/dashboard/WelcomeBanner.tsx`

Props (passed from Dashboard so the banner stays decoupled from data hooks):
- `userId: string`
- `portfolioId: string | null`
- `hasHoldings: boolean`
- `isInitialized: boolean`
- `onExploreHoldings: () => void`
- `onViewWatchlist: () => void`
- `onCleared: () => void | Promise<void>`

Visibility gate (render `null` otherwise):
- `useUserRole()` resolved AND `!isSuperAdmin` (admin = `super_admin`, per project model)
- `isInitialized`
- `localStorage["welcome_banner_dismissed_<userId>"] !== "true"`
- `hasHoldings === true`

UI:
- Rounded card, subtle gradient using semantic tokens: `bg-gradient-to-br from-primary/15 via-primary/5 to-transparent`, `border border-primary/30`, `backdrop-blur-sm`.
- X dismiss button (top-right) — sets the localStorage key and hides.
- Title: "👋 Welcome to your portfolio!"
- Body: "We've loaded sample holdings to help you get started. These are yours now — edit, add, or remove them freely."
- Three buttons:
  - **Explore Holdings** (primary) → calls `onExploreHoldings`, then dismiss.
  - **View Watchlist** (secondary) → calls `onViewWatchlist`, then dismiss.
  - **Start Fresh** (ghost/outline) → opens existing `ConfirmDialog` ("Remove all sample holdings? You'll start with an empty portfolio."). On confirm:
    - `supabase.from("holdings").delete().eq("portfolio_id", portfolioId)`
    - On success: `toast("Portfolio cleared", { description: "Add your own holdings to get started!" })`, dismiss banner, `await onCleared()` so the parent refetches.
    - On error: `toast.error("Could not clear holdings")`.

Any action button also dismisses the banner (per spec).

Uses `sonner` for toasts and the existing `ConfirmDialog` component.

## Integration: `src/pages/Dashboard.tsx`

Add scroll target refs:
- `holdingsSectionRef` already-existing wrapper around `<HoldingsTable>` — attach a `ref` to its `<div>`.
- The watchlist wrapper already has `watchlistRevealRef`; reuse that for scrolling.

Render the banner just below `<TemplateAdminPanel>` (admins won't see it anyway, but keeping it above the holdings grid matches "top of dashboard"):

```tsx
<WelcomeBanner
  userId={user.id}
  portfolioId={portfolio.portfolioId}
  hasHoldings={portfolio.holdings.length > 0}
  isInitialized={!portfolio.loading}
  onExploreHoldings={() => holdingsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
  onViewWatchlist={() => watchlistRevealRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
  onCleared={portfolio.refetch}
/>
```

`isInitialized` is derived from the portfolio finishing its first load (`!portfolio.loading`). The clone hook already gates the entire dashboard mount, so by the time this banner renders the user is past initialization — `!loading` is the right "data is ready" signal.

## Out of scope

- No watchlist page exists; "View Watchlist" scrolls to the existing watchlist panel.
- No new RPC; deletion uses the existing RLS-protected `holdings` delete (already permitted via the `portfolios` ownership check).
- `tax_lots` does not exist in this project — cascade note in spec is moot.
