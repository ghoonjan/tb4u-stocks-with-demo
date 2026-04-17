import { useState, useEffect, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp, TrendingDown, ChevronDown } from "lucide-react";
import { EmptyJournal } from "@/components/dashboard/EmptyStates";
import { getQuote } from "@/services/marketData";
import type { Tables } from "@/integrations/supabase/types";
import { GRADE_COLORS } from "@/constants";

type Trade = Tables<"trade_journal">;
type Filter = "all" | "BUY" | "SELL" | string;

export function TradeJournalPanel({ open, onClose, refreshKey }: { open: boolean; onClose: () => void; refreshKey: number }) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentPrices, setCurrentPrices] = useState<Map<string, number>>(new Map());
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("trade_journal")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });
      const items = data ?? [];
      setTrades(items);
      setLoading(false);

      const sellTickers = [...new Set(items.filter((t) => t.action === "SELL").map((t) => t.ticker))];
      const prices = new Map<string, number>();
      for (const ticker of sellTickers) {
        try {
          const q = await getQuote(ticker);
          prices.set(ticker, q.c);
        } catch { /* skip */ }
      }
      setCurrentPrices(prices);
    })();
  }, [open, refreshKey]);

  const tickers = useMemo(() => [...new Set(trades.map((t) => t.ticker))], [trades]);

  const filtered = useMemo(() => {
    if (filter === "all") return trades;
    if (filter === "BUY" || filter === "SELL") return trades.filter((t) => t.action === filter);
    return trades.filter((t) => t.ticker === filter);
  }, [trades, filter]);

  const visible = filtered.slice(0, visibleCount);

  const stats = useMemo(() => {
    const sells = trades.filter((t) => t.action === "SELL");
    const goodSells = sells.filter((t) => {
      const cur = currentPrices.get(t.ticker);
      return cur != null && t.price_at_action != null && cur < t.price_at_action;
    });
    const grades = sells.filter((t) => t.self_grade).map((t) => t.self_grade!);
    const gradeMap: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, F: 1 };
    const avgGrade = grades.length > 0
      ? Object.entries(gradeMap).reduce((best, [g, v]) => {
          const avg = grades.reduce((s, gr) => s + (gradeMap[gr] ?? 3), 0) / grades.length;
          return Math.abs(v - avg) < Math.abs(gradeMap[best] - avg) ? g : best;
        }, "C")
      : "—";
    const exitReasons = sells.map((t) => t.exit_reason).filter(Boolean) as string[];
    const reasonCounts = new Map<string, number>();
    exitReasons.forEach((r) => reasonCounts.set(r, (reasonCounts.get(r) ?? 0) + 1));
    const topReason = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

    return {
      total: trades.length,
      winRate: sells.length > 0 ? Math.round((goodSells.length / sells.length) * 100) : null,
      avgGrade,
      topReason: topReason.length > 25 ? topReason.slice(0, 25) + "…" : topReason,
    };
  }, [trades, currentPrices]);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="left" className="w-full max-w-[420px] sm:max-w-[460px] bg-card border-border p-0 flex flex-col">
        <SheetHeader className="p-4 pb-3 border-b border-border">
          <SheetTitle className="text-foreground">Trade Journal</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : trades.length === 0 ? (
          <EmptyJournal />
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2 px-4 py-3 border-b border-border bg-secondary/20">
              <MiniStat label="Total Trades" value={String(stats.total)} />
              <MiniStat label="Win Rate" value={stats.winRate != null ? `${stats.winRate}%` : "—"} />
              <MiniStat label="Avg Grade" value={stats.avgGrade} />
              <MiniStat label="Top Reason" value={stats.topReason} small />
            </div>

            <div className="flex items-center gap-1.5 px-4 py-2 flex-wrap border-b border-border/50" role="group" aria-label="Filter trades">
              {(["all", "BUY", "SELL"] as Filter[]).map((f) => (
                <FilterChip key={f} label={f === "all" ? "All" : f} active={filter === f} onClick={() => setFilter(f)} />
              ))}
              {tickers.map((t) => (
                <FilterChip key={t} label={t} active={filter === t} onClick={() => setFilter(filter === t ? "all" : t)} />
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {visible.map((trade) => {
                const isExpanded = expandedId === trade.id;
                const isBuy = trade.action === "BUY";
                const curPrice = currentPrices.get(trade.ticker);
                const priceDiff = !isBuy && curPrice && trade.price_at_action
                  ? ((curPrice - trade.price_at_action) / trade.price_at_action) * 100
                  : null;

                return (
                  <div
                    key={trade.id}
                    className="px-4 py-3 border-b border-border/30 hover:bg-secondary/30 cursor-pointer transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : trade.id)}
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter") setExpandedId(isExpanded ? null : trade.id); }}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${isBuy ? "bg-gain/15 text-gain" : "bg-loss/15 text-loss"}`}>
                        {trade.action}
                      </span>
                      <span className="font-mono text-xs font-semibold text-foreground">{trade.ticker}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {trade.shares} shares @ ${trade.price_at_action?.toFixed(2) ?? "—"}
                      </span>
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        {new Date(trade.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
                      </span>
                    </div>

                    {trade.thesis_at_time && !isExpanded && (
                      <p className="text-[11px] text-muted-foreground mt-1 truncate">{trade.thesis_at_time}</p>
                    )}

                    {!isBuy && (
                      <div className="flex items-center gap-2 mt-1">
                        {trade.exit_reason && (
                          <span className="text-[10px] text-muted-foreground bg-secondary rounded px-1.5 py-0.5">{trade.exit_reason.length > 30 ? trade.exit_reason.slice(0, 30) + "…" : trade.exit_reason}</span>
                        )}
                        {trade.self_grade && (
                          <span className={`text-[10px] font-bold rounded px-1.5 py-0.5 ${GRADE_COLORS[trade.self_grade] ?? "bg-secondary text-muted-foreground"}`}>
                            {trade.self_grade}
                          </span>
                        )}
                      </div>
                    )}

                    {!isBuy && priceDiff != null && (
                      <div className="flex items-center gap-1 mt-1.5 text-[11px]">
                        {priceDiff > 0 ? (
                          <>
                            <TrendingUp size={11} className="text-loss" />
                            <span className="text-loss">Stock up {priceDiff.toFixed(1)}% since you sold (${curPrice!.toFixed(2)})</span>
                          </>
                        ) : (
                          <>
                            <TrendingDown size={11} className="text-gain" />
                            <span className="text-gain">Stock down {Math.abs(priceDiff).toFixed(1)}% since you sold (${curPrice!.toFixed(2)})</span>
                          </>
                        )}
                      </div>
                    )}

                    {isExpanded && trade.thesis_at_time && (
                      <div className="mt-2 pt-2 border-t border-border/30 animate-in fade-in slide-in-from-top-1 duration-150">
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{trade.thesis_at_time}</p>
                      </div>
                    )}
                  </div>
                );
              })}

              {visibleCount < filtered.length && (
                <button
                  onClick={() => setVisibleCount((c) => c + 20)}
                  className="w-full flex items-center justify-center gap-1 py-3 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronDown size={12} /> Load more ({filtered.length - visibleCount} remaining)
                </button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MiniStat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="text-center">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`font-mono font-semibold text-foreground ${small ? "text-[10px]" : "text-xs"}`}>{value}</p>
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
        active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
