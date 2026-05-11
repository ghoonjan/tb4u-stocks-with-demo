## Root cause

Two bugs combine to produce the behavior you're seeing:

1. **`profiles.has_been_initialized` is never set to `true`.** The signup trigger (`handle_new_user`) clones the template but leaves the flag at `false`. So on **every page load** `useInitializeUser` re-runs and tries to call `clone_template_for_user` via RPC again.

2. **The client RPC call now fails with "permission denied".** In the recent security pass we revoked `EXECUTE` on `clone_template_for_user` from `authenticated`. The trigger still works (it runs as a definer inside the DB), but the client fallback in `useInitializeUser.ts` no longer can call it → it falls through to `toast.error("Setup failed -- you can add holdings manually")` on every refresh.

3. **Start Fresh deletes holdings but doesn't mark the profile initialized.** So on the next refresh the clone fallback runs again — and if EXECUTE were granted, it would silently re-insert the 8 template holdings (the function's `IF NOT EXISTS holdings` guard passes once they're deleted). That's why you "have to hit refresh to clear them" — the first refresh's failed clone leaves them gone, but a working clone would bring them back.

## Fix

### 1. Database migration
- Re-grant `EXECUTE ON FUNCTION public.clone_template_for_user(uuid) TO authenticated` (it's SECURITY DEFINER and only writes for the calling user — safe).
- Update `handle_new_user()` to set `has_been_initialized = true` after the clone attempt (success or fallback).
- Backfill: `UPDATE profiles SET has_been_initialized = true WHERE EXISTS (portfolio for that user)` so existing users stop re-running the init flow.

### 2. `src/hooks/useInitializeUser.ts`
- After a successful clone, write `has_been_initialized = true` to the user's profile so the hook short-circuits on subsequent loads.
- Only show the "Welcome!" toast on first successful init (it currently fires on every refresh too).

### 3. `src/components/dashboard/WelcomeBanner.tsx` (`handleStartFresh`)
- Set `has_been_initialized = true` on the user's profile after clearing holdings, so the init hook never tries to re-clone the deleted template.
- Also call `onCleared()` after the delete completes so the UI reflects the empty portfolio without needing a manual page refresh.

## Result
- No more "Setup failed" toast on refresh.
- Start Fresh clears holdings immediately (no second refresh needed).
- Adding a holding after Start Fresh won't trigger any init logic — the profile is marked initialized.
