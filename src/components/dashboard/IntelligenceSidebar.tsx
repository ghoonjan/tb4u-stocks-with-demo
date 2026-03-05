import { useState, useEffect, useMemo } from "react";
import { Newspaper, CalendarDays, BarChart3, DollarSign, AlertTriangle, ExternalLink, Loader2, ChevronDown, Landmark, TrendingUp, Clock, AlertCircle } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import type { HoldingDisplay } from "@/hooks/usePortfolioData";
import { useNewsFeed } from "@/hooks/useNewsFeed";
import { useEventsData, fetchEarningsSurprises, type CalendarEvent, type EventType } from "@/hooks/useEventsData";
import { useAnalyticsData } from "@/hooks/useAnalyticsData";
import type { EarningsSurprise } from "@/services/marketData";
import { TaxOpportunitiesSection } from "@/components/dashboard/TaxOpportunities";
import { DiversificationSection, EtfXRaySection } from "@/components/dashboard/CorrelationAnalysis";
import { calcDivSafety, DivSafetyBadge } from "@/components/dashboard/DivSafety";
import { SECTOR_COLORS, CHART_TOOLTIP_STYLE, CHART_TOOLTIP_ITEM_STYLE } from "@/constants";

type Tab = "news" | "events" | "analytics";

const SentimentDot = ({ sentiment }: { sentiment: "Bullish" | "Bearish" | "Neutral" }) => {
  const color = { Bullish: "bg-gain", Bearish: "bg-loss", Neutral: "bg-muted-foreground" }[sentiment];
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${color} shrink-0`} title={sentiment} aria-label={sentiment} />;
};

const timeAgo = (unix: number) => {
  const diff = Math.floor((Date.now() / 1000 - unix) / 60);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  const days = Math.floor(diff / 1440);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
};

function NewsTab({ tickers }: { tickers: string[] }) {
  const { items, loading, refreshing } = useNewsFeed(tickers);
  const [filter, setFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(15);

  const filtered = filter ? items.filter((n) => n.tickers.includes(filter)) : items;
  const visible = filtered.slice(0, visibleCount);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2">
        <Loader2 size={18} className="animate-spin text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground">Loading news…</span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center px-4">
        <Newspaper size={24} className="text-muted-foreground/40 mb-2" />
        <p className="text-xs text-muted-foreground">No recent news for your holdings</p>
        <p className="text-[10px] text-muted-foreground/60 mt-1">News will appear here once available. Check back later.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 flex-wrap pb-1" role="group" aria-label="Filter by ticker">
        <button
          onClick={() => setFilter(null)}
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
            !filter ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
          }`}
        >
          All
        </button>
        {tickers.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(filter === t ? null : t)}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
              filter === t ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
        {refreshing && <Loader2 size={11} className="animate-spin text-muted-foreground ml-auto" />}
      </div>

      {visible.map((n) => {
        const isExpanded = expandedId === n.id;
        return (
          <div
            key={n.id}
            className="rounded-md px-3 py-2.5 transition-colors hover:bg-secondary/50 cursor-pointer animate-in fade-in duration-200"
            onClick={() => setExpandedId(isExpanded ? null : n.id)}
            role="article"
          >
            <div className="flex items-center gap-1.5 mb-1">
              {n.tickers.map((t) => (
                <span key={t} className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">{t}</span>
              ))}
              <SentimentDot sentiment={n.sentiment} />
              <span className="ml-auto text-[10px] text-muted-foreground whitespace-nowrap">{timeAgo(n.datetime)}</span>
            </div>
            <p className={`text-xs text-foreground leading-relaxed ${isExpanded ? "" : "line-clamp-2"}`}>{n.headline}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{n.source}</p>

            {isExpanded && (
              <div className="mt-2 pt-2 border-t border-border/50 animate-in fade-in slide-in-from-top-1 duration-150">
                {n.summary && (
                  <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">
                    {n.summary.length > 200 ? n.summary.slice(0, 200) + "…" : n.summary}
                  </p>
                )}
                <a
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors"
                >
                  Read Full Article <ExternalLink size={10} />
                </a>
              </div>
            )}
          </div>
        );
      })}

      {visibleCount < filtered.length && (
        <button
          onClick={() => setVisibleCount((c) => c + 15)}
          className="w-full flex items-center justify-center gap-1 py-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown size={12} /> Load more ({filtered.length - visibleCount} remaining)
        </button>
      )}
    </div>
  );
}

const EVENT_CONFIG: Record<EventType, { icon: React.ElementType; color: string; bg: string; border: string; emoji: string }> = {
  earnings: { icon: BarChart3, color: "text-warning", bg: "bg-warning/10", border: "border-warning/30", emoji: "📊" },
  dividend: { icon: DollarSign, color: "text-gain", bg: "bg-gain/10", border: "border-gain/30", emoji: "💰" },
  fed: { icon: Landmark, color: "text-loss", bg: "bg-loss/10", border: "border-loss/30", emoji: "🏛️" },
  economic: { icon: TrendingUp, color: "text-primary", bg: "bg-primary/10", border: "border-primary/30", emoji: "📈" },
};

function daysUntil(dateStr: string): number {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  return Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
}

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function EarningsDetail({ ticker }: { ticker: string }) {
  const [surprises, setSurprises] = useState<EarningsSurprise[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetchEarningsSurprises(ticker).then((s) => { setSurprises(s.slice(0, 4)); setLoading(false); }).catch(() => setLoading(false));
  }, [ticker]);

  if (loading) return <div className="py-1"><Loader2 size={12} className="animate-spin text-muted-foreground" /></div>;
  if (surprises.length === 0) return <p className="text-[10px] text-muted-foreground">No historical earnings data</p>;

  return (
    <div className="space-y-1 mt-1.5">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Last {surprises.length} Quarters</p>
      <div className="grid grid-cols-4 gap-1">
        {surprises.map((s) => {
          const beat = s.actual > s.estimate;
          const miss = s.actual < s.estimate;
          return (
            <div key={s.period} className="rounded border border-border/50 bg-secondary/30 p-1.5 text-center">
              <p className="text-[9px] text-muted-foreground">Q{s.quarter} '{String(s.year).slice(2)}</p>
              <p className={`font-mono text-[11px] font-semibold ${beat ? "text-gain" : miss ? "text-loss" : "text-foreground"}`}>
                ${s.actual?.toFixed(2) ?? "—"}
              </p>
              <p className="text-[9px] text-muted-foreground">est ${s.estimate?.toFixed(2) ?? "—"}</p>
              {beat && <span className="text-[9px] text-gain font-medium">✓ Beat</span>}
              {miss && <span className="text-[9px] text-loss font-medium">✗ Miss</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventsTab({ holdingTickers, watchlistTickers }: { holdingTickers: string[]; watchlistTickers: string[] }) {
  const { events, loading } = useEventsData(holdingTickers, watchlistTickers);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2">
        <Loader2 size={18} className="animate-spin text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground">Loading events…</span>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center px-4">
        <CalendarDays size={24} className="text-muted-foreground/40 mb-2" />
        <p className="text-xs text-muted-foreground">Clear skies ahead</p>
        <p className="text-[10px] text-muted-foreground/60 mt-1">No major events for your holdings in the next 30 days.</p>
      </div>
    );
  }

  const grouped = new Map<string, CalendarEvent[]>();
  events.forEach((e) => {
    const list = grouped.get(e.date) ?? [];
    list.push(e);
    grouped.set(e.date, list);
  });

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-3">
      {[...grouped.entries()].map(([date, evts]) => {
        const days = daysUntil(date);
        const isToday = date === todayStr;
        const isUpcoming = days >= 0 && days <= 2;

        return (
          <div key={date}>
            <div className={`flex items-center justify-between px-2 py-1 rounded ${isToday ? "bg-primary/10 border border-primary/20" : ""}`}>
              <span className={`text-[11px] font-semibold ${isToday ? "text-primary" : "text-foreground"}`}>
                {isToday ? "Today" : formatDateHeader(date)}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {days === 0 ? "today" : days === 1 ? "tomorrow" : days > 0 ? `in ${days}d` : `${Math.abs(days)}d ago`}
              </span>
            </div>

            <div className="space-y-0.5 mt-0.5">
              {evts.map((evt) => {
                const cfg = EVENT_CONFIG[evt.type];
                const Icon = cfg.icon;
                const isExpanded = expandedId === evt.id;

                return (
                  <div key={evt.id}>
                    <div
                      onClick={() => evt.type === "earnings" ? setExpandedId(isExpanded ? null : evt.id) : undefined}
                      className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 transition-colors hover:bg-secondary/50 ${evt.type === "earnings" ? "cursor-pointer" : ""}`}
                    >
                      <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${cfg.bg} border ${cfg.border} shrink-0`}>
                        <Icon size={13} className={cfg.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {evt.ticker && (
                            <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">{evt.ticker}</span>
                          )}
                          <p className="text-xs font-medium text-foreground truncate">{evt.title}</p>
                        </div>
                        {evt.description && <p className="text-[10px] text-muted-foreground truncate">{evt.description}</p>}
                        {evt.epsEstimate != null && (
                          <p className="text-[10px] text-muted-foreground">
                            EPS est: <span className="font-mono text-foreground">${evt.epsEstimate.toFixed(2)}</span>
                            {evt.hour && <span className="ml-1">({evt.hour === "bmo" ? "Before Open" : evt.hour === "amc" ? "After Close" : ""})</span>}
                          </p>
                        )}
                      </div>
                      {isUpcoming && !isToday && (
                        <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[9px] font-semibold text-warning uppercase shrink-0">Soon</span>
                      )}
                    </div>

                    {isExpanded && evt.ticker && (
                      <div className="ml-10 mr-2 mb-1 px-2 py-2 rounded-md bg-secondary/30 border border-border/50 animate-in fade-in slide-in-from-top-1 duration-150">
                        <EarningsDetail ticker={evt.ticker} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const fmtDollar = (n: number) => "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function AnalyticsTab({ holdings }: { holdings: HoldingDisplay[] }) {
  const { analytics, loading } = useAnalyticsData(holdings);

  const sectorData = useMemo(() => {
    const sectorMap = new Map<string, number>();
    holdings.forEach((h) => {
      const sector = analytics.get(h.ticker)?.sector ?? "Other";
      sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + h.weight);
    });
    return [...sectorMap.entries()]
      .map(([name, value], i) => ({ name, value: +value.toFixed(1), fill: SECTOR_COLORS[i % SECTOR_COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  }, [holdings, analytics]);

  const topConc = useMemo(() => [...holdings].sort((a, b) => b.weight - a.weight).slice(0, 5), [holdings]);
  const top3Pct = topConc.slice(0, 3).reduce((s, h) => s + h.weight, 0);
  const highConc = topConc.find((h) => h.weight > 20);

  const driftHoldings = useMemo(() =>
    holdings.filter((h) => h.targetAllocationPct != null).map((h) => {
      const drift = Math.abs(h.weight - (h.targetAllocationPct ?? 0));
      const action = h.weight < (h.targetAllocationPct ?? 0) ? "Buy" : h.weight > (h.targetAllocationPct ?? 0) ? "Sell" : "Hold";
      return { ...h, drift, action };
    }),
  [holdings]);
  const avgDrift = driftHoldings.length > 0 ? driftHoldings.reduce((s, h) => s + h.drift, 0) / driftHoldings.length : 0;
  const driftColor = avgDrift <= 2 ? "text-gain" : avgDrift <= 5 ? "text-warning" : "text-loss";
  const driftLabel = avgDrift <= 2 ? "On Target" : avgDrift <= 5 ? "Minor Drift" : "Rebalance Needed";

  const mismatches = useMemo(() => {
    return holdings.filter((h) => {
      if (h.convictionRating >= 5 && h.weight < 10) return true;
      if (h.convictionRating >= 4 && h.weight < 5) return true;
      if (h.convictionRating <= 2 && h.weight > 15) return true;
      if (h.convictionRating <= 1 && h.weight > 5) return true;
      return false;
    }).map((h) => {
      const isUnderweight = h.convictionRating >= 4;
      return {
        ticker: h.ticker,
        conviction: h.convictionRating,
        weight: h.weight,
        isUnderweight,
        message: isUnderweight
          ? `Conviction ${h.convictionRating}/5 but only ${h.weight.toFixed(1)}% — Sizing below conviction`
          : `Conviction ${h.convictionRating}/5 but ${h.weight.toFixed(1)}% — Overweight low-conviction`,
      };
    });
  }, [holdings]);

  const annualDiv = useMemo(() => {
    let total = 0;
    holdings.forEach((h) => {
      const a = analytics.get(h.ticker);
      if (a) total += a.divPerShare * h.shares;
    });
    return total;
  }, [holdings, analytics]);

  const winners = holdings.filter((h) => h.totalPLDollar >= 0);
  const losers = holdings.filter((h) => h.totalPLDollar < 0);
  const totalGain = winners.reduce((s, h) => s + h.totalPLDollar, 0);
  const totalLoss = losers.reduce((s, h) => s + h.totalPLDollar, 0);
  const winPct = holdings.length > 0 ? (winners.length / holdings.length) * 100 : 0;

  if (holdings.length === 0) {
    return <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">Add holdings to see analytics</div>;
  }

  return (
    <div className="space-y-3">
      <TaxOpportunitiesSection holdings={holdings} />
      <DiversificationSection holdings={holdings} analytics={analytics} loading={loading} />
      <EtfXRaySection holdings={holdings} />

      {/* Sector Allocation */}
      <div className="rounded-lg border border-border bg-secondary/30 p-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Sector Allocation</h4>
        {loading ? (
          <div className="flex items-center justify-center h-[140px]"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <div className="h-[140px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sectorData} cx="50%" cy="50%" innerRadius={38} outerRadius={58} paddingAngle={3} dataKey="value" stroke="none">
                    {sectorData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} itemStyle={CHART_TOOLTIP_ITEM_STYLE} formatter={(v: number) => `${v.toFixed(1)}%`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <p className="font-mono text-lg font-bold text-foreground">{sectorData.length}</p>
                  <p className="text-[9px] text-muted-foreground">sectors</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
              {sectorData.map((s) => (
                <div key={s.name} className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.fill }} aria-hidden="true" />
                  <span className="text-[10px] text-muted-foreground">{s.name} <span className="font-mono">{s.value}%</span></span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Concentration */}
      <div className="rounded-lg border border-border bg-secondary/30 p-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Concentration</h4>
        <div className="h-[110px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topConc} layout="vertical" margin={{ left: 4, right: 8 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="ticker" width={40} tick={{ fill: "hsl(215 25% 91%)", fontSize: 11, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
              <Bar dataKey="weight" radius={[0, 4, 4, 0]} barSize={14}>
                {topConc.map((_, i) => (
                  <Cell key={i} fill={`hsl(217, 91%, ${60 - i * 7}%)`} />
                ))}
              </Bar>
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} itemStyle={CHART_TOOLTIP_ITEM_STYLE} formatter={(v: number) => `${v.toFixed(1)}%`} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {highConc && (
          <div className="mt-2 rounded-md border border-loss/30 bg-loss/5 px-2.5 py-1.5 flex items-start gap-1.5">
            <AlertCircle size={12} className="text-loss shrink-0 mt-0.5" />
            <p className="text-[10px] text-loss">High Concentration: {highConc.ticker} is {highConc.weight.toFixed(1)}% of your portfolio.</p>
          </div>
        )}
        {!highConc && top3Pct > 50 && (
          <div className="mt-2 rounded-md border border-warning/30 bg-warning/5 px-2.5 py-1.5 flex items-start gap-1.5">
            <AlertCircle size={12} className="text-warning shrink-0 mt-0.5" />
            <p className="text-[10px] text-warning">Top 3 positions represent {top3Pct.toFixed(1)}% of your portfolio.</p>
          </div>
        )}
      </div>

      {/* Drift */}
      <div className="rounded-lg border border-border bg-secondary/30 p-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Portfolio Drift</h4>
        {driftHoldings.length === 0 ? (
          <p className="text-[10px] text-muted-foreground">No target allocations set. Edit holdings to set targets.</p>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-2">
              <div className="relative h-14 w-14">
                <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90" aria-hidden="true">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(240,12%,16%)" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor"
                    className={driftColor}
                    strokeWidth="3" strokeLinecap="round"
                    strokeDasharray={`${Math.min(avgDrift * 10, 97)} 97`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`font-mono text-sm font-bold ${driftColor}`}>{avgDrift.toFixed(1)}%</span>
                </div>
              </div>
              <div>
                <p className={`text-xs font-medium ${driftColor}`}>{driftLabel}</p>
                <p className="text-[10px] text-muted-foreground">avg drift from targets</p>
              </div>
            </div>
            <div className="space-y-1">
              {driftHoldings.sort((a, b) => b.drift - a.drift).slice(0, 5).map((h) => (
                <div key={h.id} className="flex items-center text-[10px] gap-2">
                  <span className="font-mono font-semibold text-foreground w-10">{h.ticker}</span>
                  <span className="text-muted-foreground w-10 text-right">{h.targetAllocationPct?.toFixed(0)}%</span>
                  <span className="text-foreground w-10 text-right">{h.weight.toFixed(1)}%</span>
                  <span className={`font-mono w-10 text-right ${h.drift > 3 ? "text-loss" : "text-muted-foreground"}`}>{h.drift.toFixed(1)}%</span>
                  <span className={`text-[9px] font-medium ${h.action === "Buy" ? "text-gain" : h.action === "Sell" ? "text-loss" : "text-muted-foreground"}`}>{h.action}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Conviction Mismatches */}
      {mismatches.length > 0 && (
        <div className="rounded-lg border border-border bg-secondary/30 p-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Conviction Mismatches</h4>
          <div className="space-y-1.5">
            {mismatches.map((m) => (
              <div key={m.ticker} className="flex items-start gap-1.5 rounded-md border border-warning/20 bg-warning/5 px-2 py-1.5">
                <AlertCircle size={11} className="text-warning shrink-0 mt-0.5" />
                <p className="text-[10px] text-warning/90">
                  <span className="font-semibold">{m.ticker}:</span> {m.message}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dividend Income */}
      <div className="rounded-lg border border-border bg-secondary/30 p-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Dividend Income</h4>
        {loading ? (
          <Loader2 size={14} className="animate-spin text-muted-foreground" />
        ) : annualDiv > 0 ? (
          <>
            <div className="flex items-baseline gap-3">
              <div>
                <p className="font-mono text-lg font-bold text-gain">{fmtDollar(annualDiv)}</p>
                <p className="text-[10px] text-muted-foreground">est. annual</p>
              </div>
              <div>
                <p className="font-mono text-sm font-semibold text-gain">{fmtDollar(annualDiv / 12)}</p>
                <p className="text-[10px] text-muted-foreground">est. monthly</p>
              </div>
            </div>
            {(() => {
              const divHoldings = holdings.filter((h) => {
                const a = analytics.get(h.ticker);
                return a && a.divYield > 0;
              });
              if (divHoldings.length === 0) return null;
              const safeties = divHoldings.map((h) => {
                const a = analytics.get(h.ticker)!;
                return { ticker: h.ticker, safety: calcDivSafety(a.divYield, a.payoutRatio, a.divGrowth5Y) };
              }).filter((s) => s.safety != null);
              const strong = safeties.filter((s) => s.safety!.rating === "Strong").length;
              const weak = safeties.filter((s) => s.safety!.rating === "Weak");
              return (
                <div className="mt-2 space-y-1">
                  <p className="text-[10px] text-muted-foreground">
                    {strong} of {safeties.length} dividend positions rated <span className="text-gain font-semibold">Strong</span>
                    {weak.length > 0 && <>, {weak.length} rated <span className="text-loss font-semibold">Weak</span></>}
                  </p>
                  {weak.map((w) => (
                    <div key={w.ticker} className="flex items-start gap-1.5 text-[10px]">
                      <AlertTriangle size={10} className="text-loss shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">
                        <span className="text-foreground font-semibold">{w.ticker}</span> dividend may be at risk — payout ratio {w.safety!.payoutLabel.toLowerCase()}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </>
        ) : (
          <p className="text-[10px] text-muted-foreground">No dividend-paying holdings</p>
        )}
      </div>

      {/* Win/Loss */}
      <div className="rounded-lg border border-border bg-secondary/30 p-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Win / Loss Ratio</h4>
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 h-3 rounded-full bg-loss/20 overflow-hidden">
            <div className="h-full bg-gain rounded-full transition-all" style={{ width: `${winPct}%` }} />
          </div>
          <span className="font-mono text-xs text-foreground whitespace-nowrap">{winners.length}W / {losers.length}L</span>
        </div>
        <p className="text-[10px] text-muted-foreground mb-1.5">
          {winners.length} of {holdings.length} positions profitable ({winPct.toFixed(0)}%)
        </p>
        <div className="flex gap-4 text-[10px]">
          <div>
            <span className="text-muted-foreground">Unrealized gains: </span>
            <span className="font-mono text-gain">+{fmtDollar(totalGain)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Unrealized losses: </span>
            <span className="font-mono text-loss">-{fmtDollar(Math.abs(totalLoss))}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface IntelligenceSidebarProps {
  holdings?: HoldingDisplay[];
  watchlistTickers?: string[];
  briefingCard?: React.ReactNode;
}

export function IntelligenceSidebar({ holdings = [], watchlistTickers = [], briefingCard }: IntelligenceSidebarProps) {
  const [activeTab, setActiveTab] = useState<Tab>("news");
  const tickers = [...new Set(holdings.map((h) => h.ticker))];

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "news", label: "News", icon: Newspaper },
    { key: "events", label: "Events", icon: CalendarDays },
    { key: "analytics", label: "Analytics", icon: BarChart3 },
  ];

  return (
    <div className="h-full flex flex-col gap-3">
      {briefingCard}
      <div className="rounded-lg border border-border bg-card overflow-hidden flex-1 flex flex-col">
        <div className="flex border-b border-border" role="tablist" aria-label="Intelligence tabs">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                role="tab"
                aria-selected={active}
                aria-controls={`tabpanel-${t.key}`}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors relative ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={13} />
                {t.label}
                {active && (
                  <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-primary rounded-full" />
                )}
              </button>
            );
          })}
        </div>
        <div className="flex-1 overflow-y-auto p-2 tab-content-enter" key={activeTab} role="tabpanel" id={`tabpanel-${activeTab}`}>
          {activeTab === "news" && <NewsTab tickers={tickers} />}
          {activeTab === "events" && <EventsTab holdingTickers={tickers} watchlistTickers={watchlistTickers} />}
          {activeTab === "analytics" && <AnalyticsTab holdings={holdings} />}
        </div>
      </div>
    </div>
  );
}
