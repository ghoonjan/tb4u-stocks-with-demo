## Goal

Stop relying on Lovable's default signup confirmation email (which today rendered without a visible button for atri@me.com) and replace it with a custom, branded auth email template that has a guaranteed confirmation button. As a side benefit, this moves sending off the shared default SMTP — improving deliverability and removing the silent rate limits that likely caused today's missing email to gurdeeph@hotmail.com.

## Why this, not a code patch

- The signup emails sent May 9–11 were Lovable's **default** template — there is no custom template in the project to "revert" to.
- The codebase calls `supabase.auth.signUp` exactly as before; nothing on our side changed.
- The button issue and the missing email today both originate outside our code, so the only durable fix is to own the template and the sender.

## Steps

1. **Configure a sender email domain** (one-time setup, blocks everything below).
   - Triggered via the email setup dialog. DNS records are added at the domain registrar; verification may take up to ~72h but scaffolding and deploying can proceed immediately.

2. **Scaffold the auth email templates** under `supabase/functions/_shared/email-templates/` and create `supabase/functions/auth-email-hook/`.
   - All 6 standard templates (signup, magic-link, recovery, invite, email-change, reauthentication) are generated.

3. **Brand the signup template** to match TB4U:
   - White email body (per email best practice).
   - TB4U logo at top.
   - Headline + short body copy matching the app's tone.
   - A **prominent confirmation button** wired to `{{ .ConfirmationURL }}` with both a styled `<a>` and a fallback plain-text URL so it works even if a mail client strips the button styling.
   - Brand colors pulled from `src/index.css` / `tailwind.config.ts`.

4. **Deploy `auth-email-hook`** so Supabase Auth routes signup emails through our template instead of the default.

5. **Verify**:
   - Sign up a fresh test address and confirm the email arrives with a working button.
   - The user can monitor delivery in Cloud → Emails.

## What this does NOT change

- No changes to `src/pages/Auth.tsx`, signup flow, or any business logic.
- No changes to RLS, the user-onboarding trigger, or portfolios bootstrap.
- The `emailRedirectTo` value remains `window.location.origin`.

## Open question (please confirm before I start)

The custom-domain setup is the blocking step. Two options:

- **A. Use a subdomain of an existing domain you own** (e.g. `notify.tb4u.com`) — recommended. You'll add a couple of DNS records at your registrar.
- **B. Buy a domain through Lovable** — simplest if you don't already own one.

Tell me which you'd like (or paste the domain) and I'll proceed.
