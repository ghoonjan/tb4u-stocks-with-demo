Add a new first step in the onboarding flow that collects and validates the user's email and full name before any other onboarding actions.

### Why
The DB now requires non-blank `email` and `full_name` on `profiles` (validation trigger). OAuth signups usually fill these, but email/password sign-ups or users with missing metadata could end up with blank fields. We should let the user confirm/correct them at first run.

### Changes

**1. `OnboardingFlow.tsx` — add a new step `"profile"` as the first step**

- Update `Step` union: `"profile" | "welcome" | "holdings" | "preferences" | "tour"`.
- New `ProfileStep` component:
  - On mount, fetch current `profiles.email` and `profiles.full_name` and prefill inputs. Also fall back to `auth.user.email` and `auth.user.user_metadata.full_name || .name` when profile fields are blank.
  - Two inputs: Email, Full Name. Both required.
  - Client-side validation with `zod`:
    - `email`: `z.string().trim().email().max(255)`
    - `fullName`: `z.string().trim().min(1, "Full name is required").max(100)`
  - Inline error messages below each field; submit button disabled until both pass.
  - On submit: `UPDATE profiles SET email = ..., full_name = ... WHERE id = auth.uid()`. If the DB validation trigger rejects (e.g. blank after trim), surface the Postgres error via toast.
  - "Continue" advances to `"welcome"`.
- Update progress dots array to include `"profile"`.
- Update `OnboardingFlow` initial state: `useState<Step>("profile")`.

**2. Progress dot ordering**
Change the steps array to `["profile", "welcome", "holdings", "preferences", "tour"]`.

**3. Skip behavior**
The profile step has no skip — user must enter valid values. Other steps keep their existing skip behavior.

### Out of scope
- No DB migration. The trigger already enforces non-null/non-empty.
- No changes to `Dashboard.tsx`'s `onboarding_completed` check — the existing gate still triggers the flow.
- No changes to sign-up/auth pages.

### Files to edit
- `src/components/dashboard/OnboardingFlow.tsx` (only file)

### Verification
- Build passes (auto by harness).
- Manually: fresh user opens dashboard → sees Profile step prefilled → cannot continue with blank/invalid → on valid submit, advances to Welcome.