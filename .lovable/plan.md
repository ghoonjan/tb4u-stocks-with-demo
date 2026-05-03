# Phase 4 — Prompt 3: Auto-initialize hook + loading screen

Wire the `clone_template_for_user` RPC into the app so first-time signups get the template portfolio cloned automatically, with a one-time loading overlay.

## New file: `src/hooks/useInitializeUser.ts`

A no-arg hook that returns `{ isInitializing, isInitialized }` and runs at most once per mount (guarded by a `useRef` flag).

Flow:
1. Initial state: `{ isInitializing: true, isInitialized: false }` so the dashboard never flashes empty before we know.
2. `supabase.auth.getUser()` — if no user, return `{ false, true }`.
3. `select has_been_initialized from profiles where id = user.id`.
4. If `true` → `{ false, true }`.
5. If `false` → call `supabase.rpc('clone_template_for_user', { target_user_id: user.id })`.
   - Success → `toast("Welcome!", { description: "We've set up a sample portfolio for you to explore. Feel free to make it your own!" })`.
   - Error → `toast.error("Setup failed — you can add holdings manually")`. Do not block.
6. End in `{ false, true }` regardless.

Uses `sonner` (`import { toast } from "sonner"`), per project preference.

## Integration: `src/pages/Dashboard.tsx`

Inside `DashboardContent({ user })` (which only mounts after auth resolves and `user` is non-null), at the top:

```tsx
const { isInitializing } = useInitializeUser();
if (isInitializing) {
  return <InitializingOverlay />;
}
```

Place above the existing `usePortfolioData()` etc. calls so data hooks only fire after cloning completes. Hooks order remains stable (always called before the early return).

Wait — to keep hooks rules safe, the early-return-before-other-hooks would change call order. Instead, render the overlay by branching the JSX, but keep all hooks called unconditionally. The data hooks will refetch naturally once the clone finishes and the component re-renders (no manual invalidation needed; the user's first render will already have the cloned rows by the time `isInitializing` flips to false on the *next* render — `usePortfolioData` runs on mount and won't re-fetch). 

Solution: gate the entire `DashboardContent` body by extracting a wrapper. Add a tiny `DashboardGate` component above `DashboardContent`:

```tsx
function Dashboard() {
  // existing auth resolution unchanged
  return <DashboardGate user={user} onLogout={handleLogout} />;
}

function DashboardGate({ user, onLogout }) {
  const { isInitializing } = useInitializeUser();
  if (isInitializing) return <InitializingOverlay />;
  return <DashboardContent user={user} onLogout={onLogout} />;
}
```

This guarantees `usePortfolioData` first runs *after* cloning completes, so the freshly cloned holdings appear without any extra refetch logic.

## InitializingOverlay (inline in Dashboard.tsx)

Full-screen, themed:

```tsx
<div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
  <Loader2 className="h-10 w-10 animate-spin text-primary" />
  <p className="text-foreground font-medium">Setting up your portfolio…</p>
  <p className="text-sm text-muted-foreground">This only happens once</p>
</div>
```

Uses `Loader2` from `lucide-react` and existing semantic tokens (`bg-background`, `text-primary`, `text-muted-foreground`) — no new design tokens.

## Out of scope / non-changes

- No edits to `usePortfolioData`, `HoldingsTable`, or any data-fetching hooks.
- No changes to existing `onboarding_completed` / `OnboardingFlow` logic — independent flag.
- No retry UI; failure leaves the user on an empty dashboard (per spec, "do not block").
