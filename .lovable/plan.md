## Goal

Make sure new users immediately notice that their portfolio already comes pre-populated with seeded holdings, by giving the holdings table a dedicated, attention-grabbing step at the start of the guided tour.

## Background

The guided tour in `src/components/dashboard/OnboardingFlow.tsx` already has a `holdings` step, but its copy ("Your positions live here. Click any row for details.") is generic and doesn't tell a brand-new user that the rows they see are sample/seeded positions added for them. New users have been missing the fact that their portfolio is already populated.

## Changes

### 1. `src/components/dashboard/OnboardingFlow.tsx`

- Pass a new optional `holdingsCount` prop into `OnboardingFlow` so the tour copy can say e.g. "We've added 8 sample holdings to get you started."
- Replace the first entry of `TOUR_STEPS` with a dedicated "seeded holdings" step:
  - Title: "Your Starter Portfolio"
  - Description (dynamic): "We've pre-loaded {count} sample holdings so you can explore right away. Click any row for details, or use Add Holding to make it yours."
  - Same selector (`[data-tour='holdings']`) so it reuses the existing anchor on the dashboard.
- Make this step visually louder than the others by adding a `pulse-ring` set of classes (existing ring + `animate-pulse` and a slightly thicker `ring-4`) only for this first step, so new users can't miss the highlighted area.
- Keep the remaining tour steps (sidebar, macro, header, watchlist) unchanged and in the same order.
- Ensure the tour can start at this step even when the user skipped the welcome/holdings/preferences setup, so seeded users still see it.

### 2. `src/pages/Dashboard.tsx`

- Pass `holdingsCount={portfolio.holdings.length}` into `<OnboardingFlow />` so the new copy can render the actual number.
- No layout changes; the existing `data-tour="holdings"` anchor is reused.

## Out of scope

- No database, RPC, or seeding changes — this only adjusts the tour UI.
- No changes to the watchlist, sidebar, or other tour steps.
- No new dependencies.

## Verification

- Brand-new user: completes signup, sees the dashboard with seeded holdings, and the first tour tooltip points at the holdings table with the new "Your Starter Portfolio" copy and pulsing highlight.
- Existing user replaying the tour: same first step appears with the correct count.
- User with zero holdings (edge case): copy gracefully falls back to a non-numeric phrasing ("Your holdings will appear here…") instead of "0 sample holdings".
