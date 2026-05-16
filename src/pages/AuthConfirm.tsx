import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

type OtpType = "signup" | "magiclink" | "recovery" | "invite" | "email_change" | "email";

const AuthConfirm = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token_hash = params.get("token_hash");
    const type = (params.get("type") || "signup") as OtpType;
    const next = params.get("next") || "/";

    if (!token_hash) {
      setError("Missing confirmation token.");
      return;
    }

    (async () => {
      const { error } = await supabase.auth.verifyOtp({ token_hash, type });
      if (error) {
        setError(error.message);
        return;
      }
      navigate(next, { replace: true });
    })();
  }, [params, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
      <div className="text-center space-y-4 max-w-md">
        {error ? (
          <>
            <h1 className="text-2xl font-semibold">Confirmation failed</h1>
            <p className="text-muted-foreground">{error}</p>
            <button
              onClick={() => navigate("/auth")}
              className="text-primary underline"
            >
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <h1 className="text-xl font-semibold">Confirming your email…</h1>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthConfirm;
