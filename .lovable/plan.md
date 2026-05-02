## Goal
Grant super_admin access to `925cashflow4you@gmail.com` (user id `6f4111d1-3cb3-4220-9b0b-2c7c4667d03c`).

## Current state
- Account exists in `profiles`.
- No rows in `user_roles` for this user.
- Role system uses the `app_role` enum + `user_roles` table, gated by `is_super_admin()` and `has_role()` SECURITY DEFINER functions (already in place).

## Change
Run a single migration that inserts a `super_admin` role for this user, idempotently:

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('6f4111d1-3cb3-4220-9b0b-2c7c4667d03c', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

## Verification
After migration runs, query `user_roles` to confirm the row exists. The user will then be able to access `/admin` (gated by `ProtectedAdminRoute` + `useUserRole`) on next sign-in / page load.

## Notes
- No code changes needed — purely a data change.
- If `(user_id, role)` doesn't have a unique constraint, the `ON CONFLICT` will be adjusted to a `WHERE NOT EXISTS` guard instead.