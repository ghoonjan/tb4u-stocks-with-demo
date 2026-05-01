import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LogoMark } from "@/components/LogoMark";
import { GradientMeshBackground } from "@/components/GradientMeshBackground";
import CopyrightFooter from "@/components/CopyrightFooter";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" && session) {
        setHasRecoverySession(true);
      }
    });

    // Check existing session (recovery link establishes one)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      if (session) {
        setHasRecoverySession(true);
      } else {
        // give onAuthStateChange a moment, then mark invalid
        setTimeout(() => {
          if (active) setHasRecoverySession((prev) => prev ?? false);
        }, 1500);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    await supabase.auth.signOut();
    navigate("/auth?reset=success");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background relative">
      <GradientMeshBackground />
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm relative z-10">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="animate-logo-float mb-4">
              <LogoMark size={80} />
            </div>
            <h1
              className="text-2xl font-extrabold tracking-[-0.02em] uppercase"
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                textShadow: "0 0 40px rgba(99,102,241,0.15)",
              }}
            >
              TB4U
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">Set a new password</p>
          </div>

          <div className="layer-modal p-6">
            {hasRecoverySession === false ? (
              <div className="space-y-4">
                <h2 className="text-base font-semibold text-foreground">Link invalid or expired</h2>
                <p className="text-xs text-muted-foreground">
                  This password reset link is no longer valid. Request a new one from the sign-in page.
                </p>
                <button
                  onClick={() => navigate("/auth")}
                  className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Back to sign in
                </button>
              </div>
            ) : (
              <>
                <h2 className="mb-6 text-base font-semibold text-foreground">Choose a new password</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      New password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="••••••••"
                      required
                      minLength={6}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Confirm new password
                    </label>
                    <input
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="••••••••"
                      required
                      minLength={6}
                    />
                  </div>

                  {error && (
                    <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-loss">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loading || hasRecoverySession === null}
                    className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {loading ? "Updating..." : "Update password"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
      <CopyrightFooter />
    </div>
  );
};

export default ResetPassword;
