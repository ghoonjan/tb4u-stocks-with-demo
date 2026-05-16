## Issue 2 — long confirmation URL (root cause)

The auth hook currently uses `payload.data.url` directly. With the hook enabled, GoTrue hands us its raw verify URL:

```
https://phgznetefodexolvfzln.supabase.co/auth/v1/verify?redirect_to=…&token=…&type=signup
```

Before the hook was wired up, Lovable's default email path generated a friendlier link that pointed straight at your site. To get back to a clean, branded URL we need to build it ourselves from the token bits the hook already gives us.

**Fix:** in `auth-email-hook/index.ts`, construct the link as:

```
https://tb4u-folios.lovable.app/auth/confirm?token_hash={payload.data.token_hash}&type={emailType}&next=/dashboard
```

…and add a tiny `/auth/confirm` route in the app that calls `supabase.auth.verifyOtp({ token_hash, type })` then navigates to `next`. This is the recommended Supabase pattern for custom verify links and produces a short, on-brand URL.

For recovery emails, `next` becomes `/reset-password` instead of `/dashboard`.

## Issue 1 — missing "Confirm my email" button in real signup email

The button renders fine in the test/preview (same code path, same template). The most likely cause in the real send is an inbox-side quirk — typically:

- iCloud / Outlook stripping the styled `<a>` because the href contains a long token query string, or
- HSL `backgroundColor` on the button being dropped by the client.

**Fix:** harden the button so it survives strict email clients:
- swap `hsl(217, 91%, 55%)` → hex `#2f7bf6` (and matching glow hex) in `signup.tsx` (and the other 5 templates for consistency)
- wrap the `<Button>` in the standard VML/MSO bulletproof button table so Outlook + iCloud render it reliably
- shortening the URL (Issue 2 fix) also helps here, since the bare-link fallback becomes readable

Once shipped I'll also want one confirmation from you: which inbox saw the missing button (Gmail / iCloud / Outlook / other)? That tells us whether to add any further client-specific tweaks.

## Steps

1. Add `src/pages/AuthConfirm.tsx` + route `/auth/confirm` that calls `supabase.auth.verifyOtp` and redirects.
2. Update `supabase/functions/auth-email-hook/index.ts` to build `confirmationUrl` from `token_hash` + app origin (per email type).
3. Convert HSL colors → hex in all 6 templates; wrap the CTA in a bulletproof button table.
4. Deploy `auth-email-hook`.
5. You sign up with a fresh address and confirm both: short link + visible button.

No DB/migration changes; no template-name changes; no infra changes.
