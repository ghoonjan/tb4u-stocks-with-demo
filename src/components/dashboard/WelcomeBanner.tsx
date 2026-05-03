import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { ConfirmDialog } from "@/components/dashboard/ConfirmDialog";
import { toast } from "sonner";
import { X, Sparkles } from "lucide-react";

interface Props {
  userId: string;
  portfolioId: string | null;
  hasHoldings: boolean;
  isInitialized: boolean;
  onExploreHoldings: () => void;
  onViewWatchlist: () => void;
  onCleared: () => void | Promise<void>;
}

const storageKey = (userId: string) => `welcome_banner_dismissed_${userId}`;

export function WelcomeBanner({
  userId,
  portfolioId,
  hasHoldings,
  isInitialized,
  onExploreHoldings,
  onViewWatchlist,
  onCleared,
}: Props) {
  const { loading: roleLoading, isSuperAdmin } = useUserRole();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(storageKey(userId)) === "true";
    } catch {
      return false;
    }
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(storageKey(userId)) === "true");
    } catch {
      // ignore
    }
  }, [userId]);

  const dismiss = () => {
    try {
      localStorage.setItem(storageKey(userId), "true");
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  if (roleLoading || isSuperAdmin || !isInitialized || dismissed || !hasHoldings) {
    return null;
  }

  const handleStartFresh = async () => {
    if (!portfolioId) return;
    setClearing(true);

    // Snapshot current holdings so we can restore them on Undo.
    const { data: snapshot, error: snapErr } = await supabase
      .from("holdings")
      .select("ticker, company_name, shares, avg_cost_basis, conviction_rating, thesis, target_allocation_pct, notes, date_added")
      .eq("portfolio_id", portfolioId);

    if (snapErr) {
      setClearing(false);
      setConfirmOpen(false);
      console.error("[WelcomeBanner] snapshot failed", snapErr);
      toast.error("Could not clear holdings");
      return;
    }

    const { error } = await supabase
      .from("holdings")
      .delete()
      .eq("portfolio_id", portfolioId);
    setClearing(false);
    setConfirmOpen(false);

    if (error) {
      console.error("[WelcomeBanner] clear failed", error);
      toast.error("Could not clear holdings");
      return;
    }

    dismiss();
    await onCleared();

    const restore = async () => {
      if (!snapshot || snapshot.length === 0) return;
      const { error: restoreErr } = await supabase
        .from("holdings")
        .insert(snapshot.map((h) => ({ ...h, portfolio_id: portfolioId })));
      if (restoreErr) {
        console.error("[WelcomeBanner] restore failed", restoreErr);
        toast.error("Could not restore holdings");
        return;
      }
      toast.success("Sample holdings restored");
      await onCleared();
    };

    toast("Portfolio cleared", {
      description: "Add your own holdings to get started!",
      duration: 8000,
      action: snapshot && snapshot.length > 0
        ? { label: "Undo", onClick: () => { void restore(); } }
        : undefined,
    });
  };


  return (
    <>
      <div className="mx-auto w-full max-w-[1600px] px-2 sm:px-4 pt-3">
        <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-4 sm:p-5 backdrop-blur-sm">
          <button
            onClick={dismiss}
            aria-label="Dismiss welcome banner"
            className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X size={16} />
          </button>

          <div className="flex items-start gap-3 pr-8">
            <div className="hidden sm:flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-primary">
              <Sparkles size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-foreground">
                👋 Welcome to your portfolio!
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                We've loaded sample holdings to help you get started. These are yours now — edit, add, or remove them freely.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => { onExploreHoldings(); dismiss(); }}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Explore Holdings
                </button>
                <button
                  onClick={() => { onViewWatchlist(); dismiss(); }}
                  className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/80"
                >
                  View Watchlist
                </button>
                <button
                  onClick={() => setConfirmOpen(true)}
                  className="rounded-md border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  Start Fresh
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Remove all sample holdings?"
        message="You'll start with an empty portfolio."
        confirmLabel={clearing ? "Removing…" : "Remove all"}
        destructive
        onConfirm={handleStartFresh}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
