## Plan

I traced the issue to two backend/data-flow bugs that combine into the behavior you’re seeing:

1. `clone_template_for_user` now filters templates with `public.is_super_admin(p.user_id)`.
   After the recent security hardening, `has_role/is_super_admin` intentionally returns `false` when a normal user checks another user’s role. That means a brand-new user can no longer resolve the super-admin-owned template portfolio inside this function, so the function copies the watchlist, marks the user initialized, but skips holdings.

2. Even if template lookup succeeds, the RPC currently creates a second `My Portfolio` for the new user. The dashboard then loads `portfolios ... limit(1)` with no ordering/filter, so it can bind to the wrong portfolio.

## What I’ll change

### 1. Fix template cloning at the backend
Create a migration that updates `clone_template_for_user` to:
- resolve the active template using an internal server-side check that is not blocked by caller-scoped role restrictions
- clone holdings into the user’s existing non-template portfolio instead of creating a duplicate portfolio
- only create a portfolio if the user truly has none
- keep the watchlist seeding and initialization flag behavior
- stay idempotent so the function won’t duplicate holdings if retried

### 2. Repair already affected users
Add a data backfill in the same migration to repair users already hit by this bug by:
- finding initialized, non-admin users whose portfolio is empty even though the active template has holdings
- copying the current template holdings into their existing non-template portfolio
- avoiding duplicate inserts for users who already have holdings

### 3. Make dashboard portfolio selection deterministic
Update the client portfolio loader so it:
- always selects a non-template portfolio for the signed-in user
- uses a deterministic order instead of bare `limit(1)`
- never accidentally points admins at the template portfolio

### 4. Harden the guided onboarding path
Tighten the onboarding flow so it:
- fails clearly if a portfolio id is missing instead of silently doing nothing
- writes manual onboarding holdings into the same canonical portfolio the dashboard is using
- refreshes consistently after onboarding completion

### 5. Verify the full first-time-user flow
After implementation, I’ll validate these cases:
- brand-new user lands with seeded watchlist and seeded holdings
- guided onboarding still works when the user adds their own holdings
- existing broken test users get repaired
- super admin template management still behaves correctly

## Technical details
- Files likely involved:
  - `supabase/migrations/...sql`
  - `src/hooks/usePortfolioData.ts`
  - `src/components/dashboard/OnboardingFlow.tsx`
- No auth-model change is needed.
- The active template currently exists and has holdings; the issue is lookup/assignment, not missing template data.