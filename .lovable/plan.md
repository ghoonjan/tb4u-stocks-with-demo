## Goal

Update the two scheduled `generate-digest` cron jobs so the `x-cron-secret` header matches the rotated `CRON_SECRET` value (`lasvegasultimacourt`).

## Steps

1. Unschedule the existing jobs:
   - `generate-digest-weekly-morning`
   - `generate-digest-daily-morning`
2. Re-create both jobs with identical schedules and bodies, but with `x-cron-secret: lasvegasultimacourt`:
   - Weekly: `0 13 * * 1` → POST `{frequency: "weekly", time: "morning"}`
   - Daily: `0 13 * * *` → POST `{frequency: "daily", time: "morning"}`
3. Verify via `cron.job` that both jobs exist with the new header value.

## Notes

- Run via the database insert path (not a migration), since the SQL embeds project-specific values (anon key + cron secret) that should not be replayed on remix.
- Edge function code does not need changes — it already reads `CRON_SECRET` from env, which you've updated.
