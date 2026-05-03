## Goal
Allow super admins to delete test users (auth account + all related data) directly from the `/admin` user list.

## Why an edge function
Deleting from `auth.users` requires the Supabase service role key — it cannot be done from the browser client. We'll add a small edge function that:
1. Verifies the caller is authenticated and has `super_admin` role.
2. Refuses to delete the caller themselves.
3. Calls `supabase.auth.admin.deleteUser(targetUserId)` with the service role.

Because all our app tables key off `user_id` (and `holdings` cascades through `portfolios`), deleting the auth user plus the matching `profiles`/`portfolios`/`watchlist`/`alerts`/`trade_journal`/`daily_briefings`/`user_roles` rows is enough. The function will explicitly delete those rows first (no FKs to `auth.users` exist), then delete the auth user.

## Changes

### 1. New edge function: `supabase/functions/admin-delete-user/index.ts`
- POST `{ user_id: string }`
- Reads caller JWT from `Authorization` header, creates a user-scoped client to confirm identity.
- Uses service-role client to:
  - Verify caller has `super_admin` in `user_roles`.
  - Reject if `user_id === caller.id`.
  - Delete from `trade_journal`, `daily_briefings`, `alerts`, `watchlist`, `holdings` (via portfolio ids), `portfolios`, `user_roles`, `profiles` for that user_id.
  - `auth.admin.deleteUser(user_id)`.
- Returns `{ ok: true }` or `{ error }`.
- Add `[functions.admin-delete-user]` block in `supabase/config.toml` with `verify_jwt = true` (default behavior; explicit for clarity).

### 2. `src/pages/Admin.tsx`
- Add a "Delete" button in the Actions cell (red, hidden for the current user).
- Open the existing `ConfirmDialog` to confirm ("Delete {email}? This permanently removes their account and data.").
- On confirm, call `supabase.functions.invoke("admin-delete-user", { body: { user_id } })`, toast result, then `loadUsers()`.

### 3. No DB migration required
RLS and schema are unchanged. Service role bypasses RLS for the cleanup.

## UX
- Button: small destructive outline next to "Make super admin" / "Revoke admin".
- Disabled for own row.
- Confirm dialog clearly states the action is permanent.

## Out of scope
- Bulk delete / filtering test users by pattern. Can be added later if you want a "Delete all users created before X" tool.