## Goal

Set up the database scheduler to call the `generate-digest` edge function on a regular cadence, sending the `x-cron-secret` header so the function's new authentication check accepts the request.

## What I'll do

1. **Enable scheduling extensions** — turn on `pg_cron` (job scheduler) and `pg_net` (HTTP from Postgres) in the database.

2. **Schedule two recurring jobs** that POST to `generate-digest`:
   - **Weekly digest** — every Monday at 13:00 UTC, body `{frequency: "weekly", time: "morning"}`
   - **Daily digest** — every day at 13:00 UTC, body `{frequency: "daily", time: "morning"}`

   Each request includes the `x-cron-secret: ultimacourtlasvegas` header so it matches the `CRON_SECRET` value the edge function checks.

3. **Clean up duplicates** — unschedule any prior jobs with the same names first, so re-running is safe.

4. **Verify** — query `cron.job` to confirm both jobs are registered, then trigger a one-off test invocation of `generate-digest` with the secret header to confirm it returns 200 (not 401).

## Technical detail

The cron SQL is run via the database insert path (not a migration file), per project guidance, because it embeds the project's anon key and the cron secret value — those are user-/project-specific and should not be replayed on remixes.

The job SQL pattern:

```sql
SELECT cron.schedule(
  'generate-digest-weekly-morning',
  '0 13 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://ajzuilphicwhvphjkeqv.supabase.co/functions/v1/generate-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', '<project anon key>',
      'x-cron-secret', 'ultimacourtlasvegas'
    ),
    body := jsonb_build_object('frequency', 'weekly', 'time', 'morning')
  );
  $$
);
```

## Notes

- If you ever rotate `CRON_SECRET`, the scheduled jobs must be re-created with the new value (I can do that on request).
- Times are UTC. 13:00 UTC ≈ 9 AM Eastern / 6 AM Pacific. Tell me if you want different send times.
