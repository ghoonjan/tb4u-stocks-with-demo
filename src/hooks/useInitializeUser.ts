import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type State = {
  isInitializing: boolean;
  isInitialized: boolean;
};

/**
 * On first authenticated load, checks the user's profile and clones the
 * template portfolio via the `clone_template_for_user` RPC if needed.
 * Runs at most once per mount.
 */
export function useInitializeUser(): State {
  // Start as "initializing" so the dashboard never flashes empty before we know.
  const [state, setState] = useState<State>({ isInitializing: true, isInitialized: false });
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    let cancelled = false;
    const finish = () => {
      if (!cancelled) setState({ isInitializing: false, isInitialized: true });
    };

    const run = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          finish();
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("has_been_initialized")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          console.error("[useInitializeUser] profile fetch failed", profileError);
          finish();
          return;
        }

        if (profile?.has_been_initialized) {
          finish();
          return;
        }

        const { error: rpcError } = await supabase.rpc("clone_template_for_user", {
          target_user_id: user.id,
        });

        if (cancelled) return;

        if (rpcError) {
          console.error("[useInitializeUser] clone_template_for_user failed", rpcError);
          toast.error("Setup failed — you can add holdings manually");
        } else {
          toast("Welcome!", {
            description:
              "We've set up a sample portfolio for you to explore. Feel free to make it your own!",
          });
        }

        finish();
      } catch (err) {
        console.error("[useInitializeUser] unexpected error", err);
        finish();
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
