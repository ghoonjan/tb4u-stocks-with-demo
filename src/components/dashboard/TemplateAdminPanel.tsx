import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { Star, AlertTriangle } from "lucide-react";

type PortfolioRow = {
  id: string;
  name: string;
  is_template: boolean;
  holdings_count: number;
};

interface Props {
  userId: string;
}

export function TemplateAdminPanel({ userId }: Props) {
  const { loading: roleLoading, isSuperAdmin } = useUserRole();
  const [portfolios, setPortfolios] = useState<PortfolioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("portfolios")
      .select("id, name, is_template, holdings(count)")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[TemplateAdminPanel] load failed", error);
      setPortfolios([]);
    } else {
      setPortfolios(
        (data ?? []).map((p: { id: string; name: string; is_template: boolean; holdings: { count: number }[] | null }) => ({
          id: p.id,
          name: p.name,
          is_template: p.is_template,
          holdings_count: p.holdings?.[0]?.count ?? 0,
        }))
      );
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!roleLoading && isSuperAdmin) void load();
  }, [roleLoading, isSuperAdmin, load]);

  const setAsTemplate = async (id: string) => {
    setBusyId(id);
    try {
      const { error: clearErr } = await supabase
        .from("portfolios")
        .update({ is_template: false })
        .eq("user_id", userId)
        .eq("is_template", true);
      if (clearErr) throw clearErr;

      const { error: setErr } = await supabase
        .from("portfolios")
        .update({ is_template: true })
        .eq("id", id);
      if (setErr) throw setErr;

      toast("Template updated", { description: "New users will now receive this portfolio" });
      await load();
    } catch (err) {
      console.error("[TemplateAdminPanel] set template failed", err);
      toast.error("Failed to update template");
    } finally {
      setBusyId(null);
    }
  };

  if (roleLoading || !isSuperAdmin || loading || portfolios.length === 0) {
    return null;
  }

  const template = portfolios.find((p) => p.is_template) ?? null;
  const others = portfolios.filter((p) => p.id !== template?.id);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-2 sm:px-4 pt-3">
      <div className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-3 sm:p-4 space-y-3">
        {template ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">{template.name}</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-gain/30 bg-gain/15 px-2 py-0.5 text-[11px] font-medium text-gain">
              <Star size={11} className="fill-current" /> Template Portfolio
            </span>
            <p className="basis-full text-xs text-muted-foreground">
              New users receive a copy of this portfolio on their first login
            </p>
            <p className="basis-full text-[11px] text-muted-foreground">
              {template.holdings_count} {template.holdings_count === 1 ? "holding" : "holdings"} will be cloned
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-warning">
            <AlertTriangle size={13} />
            <span>No template set — new users will start with an empty portfolio.</span>
          </div>
        )}

        {others.length > 0 && (
          <div className="space-y-1.5 border-t border-border/60 pt-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Other portfolios</p>
            {others.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3">
                <span className="text-sm text-foreground truncate">
                  {p.name}{" "}
                  <span className="text-[11px] text-muted-foreground">
                    ({p.holdings_count} {p.holdings_count === 1 ? "holding" : "holdings"})
                  </span>
                </span>
                <button
                  onClick={() => setAsTemplate(p.id)}
                  disabled={busyId === p.id}
                  className="rounded-md border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary/80 hover:text-foreground disabled:opacity-50"
                >
                  {busyId === p.id ? "Setting…" : "Set as Template"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
