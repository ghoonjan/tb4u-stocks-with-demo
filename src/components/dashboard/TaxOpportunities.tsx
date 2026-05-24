import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { HoldingDisplay } from "@/hooks/usePortfolioData";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

type Status = "safe" | "wash_risk" | "review";

interface TaxOpportunity {
  ticker: string;
  unrealizedLoss: number;
  taxSavings: number;
  status: Status;
  reason: string;
  daysSincePurchase: number | null;
}

const TAX_RATE = 0.30;
const DAY_MS = 86_400_000;
const WASH_WINDOW_DAYS = 30;

export function TaxOpportunitiesSection({ holdings }: { holdings: HoldingDisplay[] }) {
  // Most-recent purchase date from tax_lots, keyed by holding.id
  const [lotDates, setLotDates] = useState<Map<string, Date>>(new Map());
  // Most-recent BUY or SELL in trade_journal within last 30 days, keyed by ticker
  const [recentTrades, setRecentTrades] = useState<Map<string, { date: Date; action: string }>>(new Map());
  const [hasTradeHistory, setHasTradeHistory] = useState(false);
  const [loading, setLoading] = useState(true);

  const losingHoldings = useMemo(
    () => holdings.filter((h) => h.totalPLDollar < 0),
    [holdings]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (!cancelled) setLoading(false);
        return;
      }

      const holdingIds = losingHoldings.map((h) => h.id);
      const tickers = losingHoldings.map((h) => h.ticker);

      const lotsPromise = holdingIds.length
        ? supabase
            .from("tax_lots")
            .select("holding_id, purchased_at")
            .in("holding_id", holdingIds)
        : Promise.resolve({ data: [] as { holding_id: string; purchased_at: string }[] });

      const windowStart = new Date(Date.now() - WASH_WINDOW_DAYS * DAY_MS).toISOString();
      const tradesPromise = tickers.length
        ? supabase
            .from("trade_journal")
            .select("ticker, created_at, action")
            .eq("user_id", session.user.id)
            .in("ticker", tickers)
            .gte("created_at", windowStart)
        : Promise.resolve({ data: [] as { ticker: string; created_at: string; action: string }[] });

      // Any trade history at all? Used to decide "Review needed" vs "Safe".
      const anyTradePromise = supabase
        .from("trade_journal")
        .select("id", { count: "exact", head: true })
        .eq("user_id", session.user.id);

      const [{ data: lots }, { data: trades }, anyTradeRes] = await Promise.all([
        lotsPromise,
        tradesPromise,
        anyTradePromise,
      ]);

      if (cancelled) return;

      const lm = new Map<string, Date>();
      (lots ?? []).forEach((l) => {
        const d = new Date(l.purchased_at);
        const cur = lm.get(l.holding_id);
        if (!cur || d > cur) lm.set(l.holding_id, d);
      });

      const tm = new Map<string, { date: Date; action: string }>();
      (trades ?? []).forEach((t) => {
        const d = new Date(t.created_at);
        const cur = tm.get(t.ticker);
        if (!cur || d > cur.date) tm.set(t.ticker, { date: d, action: t.action });
      });

      setLotDates(lm);
      setRecentTrades(tm);
      setHasTradeHistory(((anyTradeRes as { count?: number | null }).count ?? 0) > 0);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [losingHoldings]);

  const opportunities = useMemo<TaxOpportunity[]>(() => {
    const now = Date.now();
    return losingHoldings
      .map((h) => {
        const loss = Math.abs(h.totalPLDollar);
        // Prefer tax_lots purchase date; fall back to holding.purchaseDate
        const lotDate = lotDates.get(h.id);
        const fallback = h.purchaseDate ? new Date(`${h.purchaseDate}T00:00:00Z`) : null;
        const purchaseDate = lotDate ?? (fallback && !Number.isNaN(fallback.getTime()) ? fallback : null);

        const daysSincePurchase = purchaseDate
          ? Math.floor((now - purchaseDate.getTime()) / DAY_MS)
          : null;

        const recent = recentTrades.get(h.ticker);

        let status: Status;
        let reason: string;

        if (daysSincePurchase == null) {
          status = "review";
          reason = "Review needed — purchase date unavailable";
        } else if (daysSincePurchase <= WASH_WINDOW_DAYS) {
          status = "wash_risk";
          reason = `Wash sale risk — purchased ${daysSincePurchase}d ago`;
        } else if (recent) {
          status = "wash_risk";
          reason = `Wash sale risk — ${recent.action} ${Math.floor((now - recent.date.getTime()) / DAY_MS)}d ago`;
        } else if (!hasTradeHistory) {
          status = "review";
          reason = "Review needed — insufficient trade history to confirm wash sale";
        } else {
          status = "safe";
          reason = "Safe to harvest";
        }

        return {
          ticker: h.ticker,
          unrealizedLoss: loss,
          taxSavings: loss * TAX_RATE,
          status,
          reason,
          daysSincePurchase,
        };
      })
      .sort((a, b) => b.unrealizedLoss - a.unrealizedLoss);
  }, [losingHoldings, lotDates, recentTrades, hasTradeHistory]);

  const safeOpps = opportunities.filter((o) => o.status === "safe");
  const totalLoss = safeOpps.reduce((s, o) => s + o.unrealizedLoss, 0);
  const totalSavings = safeOpps.reduce((s, o) => s + o.taxSavings, 0);

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
          {/* Summary — based ONLY on truly safe positions */}
          <div className="rounded-md bg-loss/5 border border-loss/20 px-3 py-2 mb-2">
            {safeOpps.length > 0 ? (
              <p className="text-[11px] text-muted-foreground">
                You have <span className="font-mono text-loss font-semibold">{fmtDollar(totalLoss)}</span> in safely harvestable losses across{" "}
                <span className="text-foreground font-semibold">{safeOpps.length}</span> position{safeOpps.length !== 1 ? "s" : ""}.
                Estimated tax savings: <span className="font-mono text-gain font-semibold">{fmtDollar(totalSavings)}</span>
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                No positions are currently safe to harvest. {opportunities.length} losing position{opportunities.length !== 1 ? "s" : ""} need review (see below).
              </p>
            )}
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
                    {o.status === "safe" ? (
                      <>
                        <CheckCircle2 size={10} className="text-gain shrink-0" />
                        <span className="text-[10px] text-gain">{o.reason}</span>
                      </>
                    ) : o.status === "wash_risk" ? (
                      <>
                        <AlertTriangle size={10} className="text-warning shrink-0" />
                        <span className="text-[10px] text-warning">{o.reason}</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={10} className="text-warning shrink-0" />
                        <span className="text-[10px] text-warning">{o.reason}</span>
                      </>
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
        This is not tax advice. Wash sale rules also apply to substantially identical securities and across all your accounts (including IRAs and a spouse's). Consult a tax professional before making tax-related investment decisions.
      </p>
    </div>
  );
}
