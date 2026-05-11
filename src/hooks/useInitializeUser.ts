import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type State = {
  isInitializing: boolean;
  isInitialized: boolean;
};

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

/**
 * On first authenticated load, checks the user's profile and clones the
 * template portfolio via the clone_template_for_user RPC if needed.
 * Retries up to MAX_RETRIES times on failure before giving up.
 */
export function useInitializeUser(): State {
  const [state, setState] = useState<State>({ isInitializing: true, isInitialized: false });
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    let cancelled = false;

    const finish = () => {
      if (!cancelled) setState({ isInitializing: false, isInitialized: true });
    };
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const attemptClone = async (userId: string): Promise<boolean> => {
      const { error } = await supabase.rpc("clone_template_for_user", {
        new_user_id: userId,
      });
      if (error) {
        console.error("[useInitializeUser] clone_template_for_user failed", error);
        return false;
      }
      return true;
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

        let success = false;
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          if (cancelled) return;
          success = await attemptClone(user.id);
          if (success || attempt === MAX_RETRIES) break;
          console.warn(
            `[useInitializeUser] Attempt ${attempt}/${MAX_RETRIES} failed, retrying in ${RETRY_DELAY_MS}ms...`
          );
          await delay(RETRY_DELAY_MS);
        }
        if (cancelled) return;

        if (success) {
          // Mark profile as initialized so this won't re-run on every page load
          await supabase
            .from("profiles")
            .update({ has_been_initialized: true })
            .eq("id", user.id);

          toast("Welcome!", {
            description:
              "We've set up a sample portfolio for you to explore. Feel free to make it your own!",
          });
        } else {
          toast.error("Setup failed -- you can add holdings manually");
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
