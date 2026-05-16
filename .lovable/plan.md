# Fix failing verification emails

## Root cause

The `auth-email-hook` is deployed and the domain is verified, but the email **queue infrastructure** was never provisioned. The hook tries to call `public.enqueue_email(...)` and insert into `email_send_log`, neither of which exist — so every signup/recovery email fails with `PGRST202`.

This is why today's signup got no email but `atri@me.com` (created days ago via the default Lovable email path) did.

## Fix

1. Provision the managed email queue infrastructure — creates the `email_send_log`, `email_send_state`, `suppressed_emails`, `email_unsubscribe_tokens` tables, the `auth_emails` / `transactional_emails` pgmq queues, the `enqueue_email` RPC, the `process-email-queue` dispatcher Edge Function, and its pg_cron schedule.
2. Re-deploy `auth-email-hook` so it picks up the now-available RPC cleanly.
3. You test a fresh signup; we watch progress in **Cloud → Emails**.

No app code or template changes — the templates are fine, they just have nothing to write to.

## Note on Live

Queue infra (cron + vault secret) is provisioned per environment. After Test is fixed and you re-publish, the publish flow provisions the prod cron job automatically.
