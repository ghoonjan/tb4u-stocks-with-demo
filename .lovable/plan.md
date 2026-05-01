# Add "Forgot password?" flow

## What you'll get

1. A **"Forgot password?"** link on the sign-in form at `/auth`. Clicking it switches the card into a "Reset password" mode where the user enters their email and gets a reset link.
2. A new **`/reset-password`** page where the user lands from the email link to set a new password.
3. Clear success / error messaging in both places.

## User flow

```text
/auth (sign in)
   │  click "Forgot password?"
   ▼
/auth (reset mode) — enter email, submit
   │  email sent
   ▼
inbox — click reset link
   │
   ▼
/reset-password — enter + confirm new password → redirect to /
```

## Changes

### `src/pages/Auth.tsx`
- Add a third mode alongside `isLogin` / signup: `"reset"`.
- Add a small "Forgot password?" link directly under the password field (only visible in sign-in mode).
- In reset mode: hide the password field, change the button to "Send reset link", call:
  ```ts
  supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  ```
- On success show "Check your email for a reset link." Add a "Back to sign in" link.

### `src/pages/ResetPassword.tsx` (new)
- Public route. Reuses the same layout (LogoMark, GradientMeshBackground, CopyrightFooter, `layer-modal` card) as `Auth.tsx` for visual consistency.
- On mount: listen via `supabase.auth.onAuthStateChange` for the `PASSWORD_RECOVERY` event so the recovery session is established before the form submits.
- Form: new password + confirm new password (min 6 chars, must match).
- Submit calls `supabase.auth.updateUser({ password })`, then signs out and redirects to `/auth` with a success message — or, if you prefer, navigates to `/` since the user is already authenticated by the recovery session. Plan default: redirect to `/auth` and show "Password updated, please sign in." (safer; avoids confusion if they want to log in fresh).
- If no recovery session is detected after a short delay, show "This reset link is invalid or has expired" with a link back to `/auth`.

### `src/App.tsx`
- Add `<Route path="/reset-password" element={<ResetPassword />} />` (public, above the `*` catch-all).

## Notes on auth emails

Right now your project sends the **default Lovable password-reset email** — it works, but it's unbranded and comes from a generic sender. The reset link itself will use the `redirectTo` we set, so the flow above will work today.

If you later want the reset email to be **branded (TB4U logo, your colors, custom copy)** and sent from your own domain, that's a separate setup (custom email domain + auth email templates). Just say the word and I'll set that up after this lands. Not required for the feature to work.

## Out of scope

- Rate-limiting reset requests (Supabase already throttles per email).
- Re-authentication / 2FA before password change.
- Custom-branded reset email (see note above).
