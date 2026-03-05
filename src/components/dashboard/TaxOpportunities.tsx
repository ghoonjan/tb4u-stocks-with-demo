import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { HoldingDisplay } from "@/hooks/usePortfolioData";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

interface TaxOpportunity {
  ticker: string;
  unrealizedLoss: number;
  taxSavings: number;
  daysSinceLastBuy: number | null;
  washSaleRisk: boolean;
}

const TAX_RATE = 0.30;

export function TaxOpportunitiesSection({ holdings }: { holdings: HoldingDisplay[] }) {
  const [recentBuys, setRecentBuys] = useState<Map<string, Date>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const { data: trades } = await supabase
        .from("trade_journal")
        .select("ticker, created_at, action")
        .eq("user_id", session.user.id)
        .eq("action", "BUY")
        .gte("created_at", thirtyDaysAgo);

      const map = new Map<string, Date>();
      (trades ?? []).forEach((t) => {
        const existing = map.get(t.ticker);
        const d = new Date(t.created_at);
        if (!existing || d > existing) map.set(t.ticker, d);
      });
      setRecentBuys(map);
      setLoading(false);
    })();
  }, []);

  const opportunities = useMemo<TaxOpportunity[]>(() => {
    return holdings
      .filter((h) => h.totalPLDollar < 0)
      .map((h) => {
        const loss = Math.abs(h.totalPLDollar);
        const lastBuyDate = recentBuys.get(h.ticker);
        const daysSinceLastBuy = lastBuyDate
          ? Math.floor((Date.now() - lastBuyDate.getTime()) / 86_400_000)
          : null;
        return {
          ticker: h.ticker,
          unrealizedLoss: loss,
          taxSavings: loss * TAX_RATE,
          daysSinceLastBuy,
          washSaleRisk: daysSinceLastBuy != null && daysSinceLastBuy <= 30,
        };
      })
      .sort((a, b) => b.unrealizedLoss - a.unrealizedLoss);
  }, [holdings, recentBuys]);

  const totalLoss = opportunities.reduce((s, o) => s + o.unrealizedLoss, 0);
  const totalSavings = opportunities.reduce((s, o) => s + o.taxSavings, 0);

  const fmtDollar = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-3">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Tax Opportunities</h4>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 size={14} className="animate-spin text-muted-foreground" />
        </div>
      ) : opportunities.length === 0 ? (
        <div className="text-center py-3">
          <p className="text-xs text-foreground">No tax-loss harvesting opportunities right now.</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">All positions are profitable! 🎉</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="rounded-md bg-loss/5 border border-loss/20 px-3 py-2 mb-2">
            <p className="text-[11px] text-muted-foreground">
              You have <span className="font-mono text-loss font-semibold">{fmtDollar(totalLoss)}</span> in harvestable losses across{" "}
              <span className="text-foreground font-semibold">{opportunities.length}</span> position{opportunities.length !== 1 ? "s" : ""}.
              Estimated tax savings: <span className="font-mono text-gain font-semibold">{fmtDollar(totalSavings)}</span>
            </p>
          </div>

          {/* List */}
          <div className="space-y-1.5">
            {opportunities.map((o) => (
              <div key={o.ticker} className="flex items-center gap-2 rounded-md px-2 py-1.5 bg-secondary/30">
                <span className="font-mono text-xs font-semibold text-foreground w-12">{o.ticker}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-loss font-mono">-{fmtDollar(o.unrealizedLoss)}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-gain font-mono">~{fmtDollar(o.taxSavings)} savings</span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {o.washSaleRisk ? (
                      <>
                        <AlertTriangle size={10} className="text-warning shrink-0" />
                        <span className="text-[10px] text-warning">Wash Sale Risk — purchased within 30 days</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={10} className="text-gain shrink-0" />
                        <span className="text-[10px] text-gain">Safe to harvest</span>
                      </>
                    )}
                    {o.daysSinceLastBuy != null && (
                      <span className="text-[10px] text-muted-foreground ml-1">({o.daysSinceLastBuy}d since last buy)</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Disclaimer */}
      <p className="text-[9px] text-muted-foreground/60 mt-2 leading-relaxed">
        This is not tax advice. Consult a tax professional before making tax-related investment decisions.
      </p>
    </div>
  );
}
