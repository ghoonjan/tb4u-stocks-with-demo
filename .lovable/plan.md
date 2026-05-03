# Phase 4 — Prompt 1: Profiles & Template Flag

Reconciled with existing schema. Admin: `saxplayingurd@gmail.com`. Roles stay in `user_roles`. `full_name` added as new column (does not touch `display_name`).

## Migration

1. **profiles** — add columns:
   - `full_name TEXT`
   - `has_been_initialized BOOLEAN NOT NULL DEFAULT false`

2. **portfolios** — add column:
   - `is_template BOOLEAN NOT NULL DEFAULT false`

3. **handle_new_user()** — update trigger function so new profile rows get `has_been_initialized = false` (explicit, matches default). No other behavior change.

4. **Backfill (admin user)** — look up `auth.users` row for `saxplayingurd@gmail.com`:
   - Set their `profiles.has_been_initialized = true`.
   - Ensure a `user_roles` row with `role = 'super_admin'` exists (insert if missing). No `role` column added to `profiles`.
   - Mark their **oldest** `portfolios` row (by `created_at`) as `is_template = true`. If none exists, skip (do not auto-create).

5. **Watchlist** — skipped (no parent container exists; spec acknowledged).

## Safety

- Pure `ALTER TABLE … ADD COLUMN` + targeted `UPDATE`/`INSERT` — no drops, no data loss.
- All new columns have safe defaults so existing rows and inserts keep working.
- `src/integrations/supabase/types.ts` regenerates automatically.

## Post-migration verification (I will run via read_query)

- `profiles` row for admin → `has_been_initialized = true`.
- `user_roles` for admin includes `super_admin`.
- Admin's first `portfolios` row → `is_template = true`.
- App still loads; existing holdings unaffected.

## Out of scope (later prompts)

- UI changes, onboarding flow wiring, template cloning logic.