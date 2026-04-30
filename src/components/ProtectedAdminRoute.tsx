import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";

/**
 * Server-side enforcement of admin access lives in RLS policies and the
 * `is_super_admin()` SECURITY DEFINER function. This component is the
 * defence-in-depth client-side gate: it renders NOTHING (no admin markup,
 * no data fetches) until the role check resolves AND the user is confirmed
 * super_admin. Non-admins are redirected immediately.
 */
export const ProtectedAdminRoute = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const { loading, userId, isSuperAdmin } = useUserRole();

  useEffect(() => {
    if (loading) return;
    if (!userId) {
      navigate("/auth", { replace: true });
      return;
    }
    if (!isSuperAdmin) {
      navigate("/", { replace: true });
    }
  }, [loading, userId, isSuperAdmin, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Verifying access…
      </div>
    );
  }

  // Render nothing for non-admins — never expose admin markup or trigger
  // child component effects/queries before the redirect fires.
  if (!userId || !isSuperAdmin) {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedAdminRoute;
