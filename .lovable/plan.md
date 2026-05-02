I found two separate root causes:

1. `/admin` is failing because the admin role itself exists, but the database function used inside the role policies (`is_super_admin`) had execute permission revoked from logged-in users. That makes role/profile reads return `403 permission denied for function is_super_admin`, so the client assumes the user is not an admin and redirects back to `/`.

2. The reset-password link is being handled by the Lovable project/editor auth layer instead of the app auth flow. The app currently points recovery links to `/reset-password` on `window.location.origin`, but on the preview domain that can be intercepted by the hosting/auth wrapper. We need to make the redirect URL explicitly target the app route and make the reset page handle the app auth recovery tokens more defensively.

Plan:

1. Fix database execute permissions for admin policy functions
   - Add a migration to grant `EXECUTE` on `public.has_role(uuid, public.app_role)` and `public.is_super_admin(uuid)` to the logged-in app user role.
   - Keep access revoked from anonymous/public users.
   - This preserves RLS security while allowing authenticated users to evaluate policies that depend on those functions.

2. Verify admin access path
   - Re-check that `925cashflow4you@gmail.com` still has `super_admin` in `user_roles`.
   - Confirm `/admin` no longer gets `403 permission denied for function is_super_admin` and no longer redirects for that account.

3. Make password reset target this app, not Lovable account auth
   - Update the forgot-password redirect URL to explicitly use the app’s configured URL and `/reset-password` route rather than relying only on the current preview origin.
   - Keep the reset form public and app-scoped.
   - Improve `/reset-password` handling so it waits for the app recovery session/token, handles hash/query recovery parameters, and displays a clear invalid/expired message only after the app auth flow has had a chance to initialize.

4. Prevent accidental app redirect during recovery
   - Adjust auth-page session redirect behavior so a recovery session doesn’t immediately bounce the user to `/` before they can set a new password.

5. Validation
   - Use browser/network checks to confirm `/admin` can read `user_roles` successfully.
   - Confirm the reset email action lands on the app’s `/reset-password` page and the form updates the app user password.