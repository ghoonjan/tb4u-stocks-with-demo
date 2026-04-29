## Goal

Create a super admin account (`saxplayingurd@gmail.com`) and a protected `/admin` page for it. Set up a proper roles system following Supabase security best practices (separate `user_roles` table, no role on `profiles`).

## What you'll get

1. A new login: **saxplayingurd@gmail.com** with a strong temporary password I'll generate (e.g. `TB4U-Admin-<random>!`). You log in once and immediately change it from the new admin page.
2. A new route **`/admin`** visible only to users with the `super_admin` role. It shows a list of all users (email, signup date), their role badges, and lets you grant/revoke `super_admin` on other accounts.
3. A "Change password" control on `/admin` so you can rotate the temp password right after first login.

## Steps

### 1. Database migration (roles system)
- Create enum `public.app_role` with values: `super_admin`, `admin`, `user`.
- Create table `public.user_roles (id, user_id → auth.users, role app_role, created_at)` with unique `(user_id, role)`.
- Enable RLS on `user_roles`.
- Create `SECURITY DEFINER` function `public.has_role(_user_id uuid, _role app_role) returns boolean` to safely check roles inside policies (avoids recursion).
- Create helper `public.is_super_admin(_user_id uuid)` for cleaner policy reads.
- RLS policies on `user_roles`:
  - SELECT: a user can see their own roles; super_admins can see all.
  - INSERT/UPDATE/DELETE: only super_admins.

### 2. Provision the super admin user
- Insert the new auth user `saxplayingurd@gmail.com` with email already confirmed and a generated strong password.
- The existing `handle_new_user` trigger (referenced in memory) will auto-create their `profiles` and `portfolios` rows.
- Insert a `user_roles` row granting `super_admin`.
- I'll print the temp password in chat once after creation. Change it immediately on first login.

### 3. Frontend
- Add `src/hooks/useUserRole.ts` — fetches current user's roles via `user_roles` select.
- Add `src/pages/Admin.tsx` — protected page:
  - Redirects to `/auth` if not signed in, to `/` if signed in but not `super_admin`.
  - Sections: **Your account** (change password via `supabase.auth.updateUser({ password })`), **Users** (list `profiles` + role badges, grant/revoke super_admin buttons).
- Register `/admin` route in `src/App.tsx`.
- Add a small "Admin" link in the dashboard header that only renders when `useUserRole()` returns `super_admin`.

### 4. Supporting RLS update
- Add a SELECT policy on `profiles` so super_admins can read all profile rows (needed for the user list). Keeps existing "users see own profile" policy intact.

## Technical notes

- Roles live in their own table per Supabase security guidance — never on `profiles`. All checks go through `has_role()` (SECURITY DEFINER, `search_path = public`) to prevent recursive RLS.
- Password is set via the admin API during the migration (using `crypt()` against `auth.users.encrypted_password`). Email is marked confirmed so you can sign in immediately without a verification link.
- No anonymous auth, no auto-confirm change for normal signups — only this one account is pre-confirmed.
- The `/admin` page uses the existing dark theme, LogoMark, GradientMeshBackground, and CopyrightFooter for visual consistency.

## After approval

Once you approve, I'll:
1. Run the schema migration.
2. Run the data migration that creates the user + assigns the role, and post the temp password in chat.
3. Add the hook, `/admin` page, header link, and route.
4. Confirm by signing-state checks; you log in at `/auth`, navigate to `/admin`, and rotate the password.
