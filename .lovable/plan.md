# Phase 4 — Prompt 2: `clone_template_for_user` function

Create a Supabase migration that adds a SECURITY DEFINER function which clones the template portfolio (and its holdings) into a freshly-signed-up user's account.

## Schema reality check

- `tax_lots` table — does **not** exist → step 5 is a no-op (skipped).
- `watchlist` table — exists, but has **no** `is_template` column and no parent container → step 6 is a no-op (skipped). Per spec ("If no watchlist template exists ... skip"), this is correct behavior.
- `holdings` has no `user_id` column (ownership is via `portfolio_id → portfolios.user_id`), so we only set `portfolio_id` on cloned rows. The spec's "user_id = target_user_id" line doesn't apply to this schema.

## Function: `public.clone_template_for_user(target_user_id uuid) returns boolean`

Behavior, in order:

1. **Auth guard** — if `target_user_id <> auth.uid()` → raise `exception` (users can only initialize themselves).
2. **Already initialized?** — `SELECT has_been_initialized FROM profiles WHERE id = target_user_id`. If `true`, return `false`.
3. **Find template** — `SELECT id FROM portfolios WHERE is_template = true LIMIT 1`. If none, set `profiles.has_been_initialized = true` for the user and return `false`.
4. **Create new portfolio** for target user: `name = 'My Portfolio'`, `is_template = false`. Capture new id.
5. **Clone holdings** — single `INSERT … SELECT` from template's holdings into the new portfolio, copying: `ticker, company_name, shares, avg_cost_basis, conviction_rating, thesis, target_allocation_pct, notes, date_added`. New UUID per row; `portfolio_id` = new portfolio id.
6. **tax_lots** — skipped (table absent).
7. **watchlist** — skipped (no template marker).
8. **Mark initialized** — `UPDATE profiles SET has_been_initialized = true WHERE id = target_user_id`.
9. **Return `true`**.

## Security

- `SECURITY DEFINER`, `SET search_path = public`.
- Internal `auth.uid()` check prevents one user from initializing another.
- `GRANT EXECUTE ON FUNCTION public.clone_template_for_user(uuid) TO authenticated;`
- `REVOKE … FROM public, anon` for safety.

## Out of scope

- No call site yet — wired from the app in Prompt 3.
- No data changes; pure schema/function migration.
