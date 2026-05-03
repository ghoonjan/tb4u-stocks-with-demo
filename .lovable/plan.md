## Why /admin stopped working

The `/admin` route is gated by `ProtectedAdminRoute`, which checks the `user_roles` table for a `super_admin` row via the `is_super_admin()` function. That table is currently **empty** — no user has any role assigned, so the guard redirects everyone back to `/`.

## Fix

Insert a `super_admin` row in `public.user_roles` for `saxplayingurd@gmail.com`.

Steps:
1. Look up the user_id for `saxplayingurd@gmail.com` from `profiles`.
2. Insert `(user_id, 'super_admin')` into `user_roles`.
3. You log out / log back in (or just refresh) so `useUserRole` re-reads the role, then `/admin` will load.

No code or schema changes required — pure data seed.
