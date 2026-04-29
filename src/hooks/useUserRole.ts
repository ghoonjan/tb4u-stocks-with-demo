import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "admin" | "user";

export interface UseUserRoleResult {
  loading: boolean;
  userId: string | null;
  email: string | null;
  roles: AppRole[];
  isSuperAdmin: boolean;
}

export function useUserRole(): UseUserRoleResult {
  const [state, setState] = useState<UseUserRoleResult>({
    loading: true,
    userId: null,
    email: null,
    roles: [],
    isSuperAdmin: false,
  });

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user ?? null;

        if (!user) {
          if (active) setState({ loading: false, userId: null, email: null, roles: [], isSuperAdmin: false });
          return;
        }

        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        if (error) {
          if (active) setState({ loading: false, userId: user.id, email: user.email ?? null, roles: [], isSuperAdmin: false });
          return;
        }

        const roles = (data ?? []).map((r) => r.role as AppRole);
        if (active) {
          setState({
            loading: false,
            userId: user.id,
            email: user.email ?? null,
            roles,
            isSuperAdmin: roles.includes("super_admin"),
          });
        }
      } catch {
        if (active) setState({ loading: false, userId: null, email: null, roles: [], isSuperAdmin: false });
      }
    };

    void load();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      void load();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
