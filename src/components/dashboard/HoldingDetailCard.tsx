import { useState, useEffect, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { Pencil, BookOpen, Bell, Trash2, ExternalLink, Loader2, Shield, CheckCircle2 } from "lucide-react";
import type { HoldingDisplay } from "@/hooks/usePortfolioData";
import { getCandles, getCompanyNews, getBasicFinancials, getCompanyProfile, type NewsArticle, type BasicFinancials, type CompanyProfile } from "@/services/marketData";
import { calcDivSafety, DivSafetyBadge } from "@/components/dashboard/DivSafety";
import { TaxLotsPanel } from "@/components/dashboard/TaxLotsPanel";

type TimeRange = "1D" | "1W" | "1M" | "3M" | "1Y";
const RANGES: TimeRange[] = ["1D", "1W", "1M", "3M", "1Y"];

const fmtMcap = (n: number) => {
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(1) + "T";
  if (n >= 1e3) return "$" + (n / 1e3).toFixed(1) + "B";
  return "$" + n.toFixed(0) + "M";
};

const timeAgo = (unix: number) => {
  const diff = Math.floor((Date.now() / 1000 - unix) / 60);
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
};

interface HoldingDetailCardProps {
  holding: HoldingDisplay;
  onEdit: () => void;
  onDelete: () => void;
  onLogTrade?: () => void;
}

export function HoldingDetailCard({ holding, onEdit, onDelete, onLogTrade }: HoldingDetailCardProps) {
  const [range, setRange] = useState<TimeRange>("1M");
  const [chartData, setChartData] = useState<{ time: string; price: number }[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [financials, setFinancials] = useState<BasicFinancials | null>(null);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);

  const fetchChart = useCallback(async (r: TimeRange) => {
    setChartLoading(true);
    try {
      const candles = await getCandles(holding.ticker, r);
      if (candles && candles.t) {
        const points = candles.t.map((t, i) => {
          const d = new Date(t * 1000);
          const label = r === "1D"
            ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
            : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          return { time: label, price: candles.c[i] };
        });
        setChartData(points);
      } else {
        setChartData([]);
      }
    } catch { setChartData([]); }
    setChartLoading(false);
  }, [holding.ticker]);

  useEffect(() => { fetchChart(range); }, [range, fetchChart]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setNewsLoading(true);
      const [n, f, p] = await Promise.all([
        getCompanyNews(holding.ticker).catch(() => []),
        getBasicFinancials(holding.ticker).catch(() => null),
        getCompanyProfile(holding.ticker).catch(() => null),
      ]);
      if (cancelled) return;
      setNews(n);
      setFinancials(f);
      setProfile(p);
      setNewsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [holding.ticker]);

  const firstPrice = chartData[0]?.price ?? holding.currentPrice;
  const lastPrice = chartData[chartData.length - 1]?.price ?? holding.currentPrice;
  const chartGain = lastPrice >= firstPrice;
  const chartColor = chartGain ? "hsl(142, 71%, 45%)" : "hsl(0, 84%, 60%)";

  const w52High = financials?.["52WeekHigh"] ?? 0;
  const w52Low = financials?.["52WeekLow"] ?? 0;
  const w52Range = w52High - w52Low;
  const w52Pct = w52Range > 0 ? ((holding.currentPrice - w52Low) / w52Range) * 100 : 50;

  return (
    <div className="bg-secondary/20 border-b border-border" onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-col sm:flex-row gap-4 px-3 sm:px-5 py-4">
        {/* Chart */}
        <div className="sm:flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-2">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="h-[160px] sm:h-[180px]">
          {chartLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-xs text-muted-foreground">No chart data available</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={`fill-${holding.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColor} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" tick={{ fontSize: 9, fill: "hsl(215, 20%, 65%)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={40} />
                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 9, fill: "hsl(215, 20%, 65%)" }} axisLine={false} tickLine={false} width={45} tickFormatter={(v) => `$${v.toFixed(0)}`} />
                <ReTooltip
                  contentStyle={{ backgroundColor: "hsl(240, 16%, 8%)", border: "1px solid hsl(240, 12%, 16%)", borderRadius: 6, fontSize: 11, color: "hsl(215, 28%, 90%)" }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, "Price"]}
                  labelStyle={{ color: "hsl(215, 16%, 65%)", fontSize: 10 }}
                />
                <Area type="monotone" dataKey="price" stroke={chartColor} strokeWidth={1.5} fill={`url(#fill-${holding.id})`} dot={false} activeDot={{ r: 3, fill: chartColor, stroke: "hsl(240, 16%, 8%)", strokeWidth: 2 }} isAnimationActive={true} animationDuration={800} animationEasing="ease-out" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="sm:flex-1 min-w-0 flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-x-4 gap-y-2">
          <Stat label="Market Cap" value={profile ? fmtMcap(profile.marketCapitalization) : "—"} />
          <Stat label="P/E Ratio" value={financials?.peNormalizedAnnual?.toFixed(1) ?? "—"} />
          <Stat label="Div Yield" value={financials?.dividendYieldIndicatedAnnual != null ? financials.dividendYieldIndicatedAnnual.toFixed(2) + "%" : "—"} />
        </div>

        {w52Range > 0 && (
          <div className="space-y-0.5">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>${w52Low.toFixed(0)}</span>
              <span className="text-[10px] font-medium text-muted-foreground">52W Range</span>
              <span>${w52High.toFixed(0)}</span>
            </div>
            <div className="relative h-1.5 rounded-full bg-secondary">
              <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary border border-card" style={{ left: `${Math.min(Math.max(w52Pct, 2), 98)}%` }} />
            </div>
          </div>
        )}

        {financials?.dividendYieldIndicatedAnnual != null && financials.dividendYieldIndicatedAnnual > 0 && (() => {
          const safety = calcDivSafety(financials.dividendYieldIndicatedAnnual!, financials.payoutRatioAnnual ?? null, financials.dividendGrowthRate5Y ?? null);
          if (!safety) return null;
          return (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Dividend Safety</span>
                <DivSafetyBadge rating={safety.rating} />
                <span className="font-mono text-[10px] text-muted-foreground">({safety.score.toFixed(1)}/10)</span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-[10px]">
                <div><span className="text-muted-foreground">Payout: </span><span className="font-mono text-foreground">{financials.payoutRatioAnnual?.toFixed(0) ?? "—"}%</span></div>
                <div><span className="text-muted-foreground">Yield: </span><span className="font-mono text-foreground">{financials.dividendYieldIndicatedAnnual!.toFixed(2)}%</span></div>
                <div><span className="text-muted-foreground">5Y Growth: </span><span className="font-mono text-foreground">{safety.growthLabel}</span></div>
              </div>
              <p className="text-[10px] text-muted-foreground italic">{safety.summary}</p>
            </div>
          );
        })()}

        <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Latest News</span>
          {newsLoading ? (
            <div className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 size={12} className="animate-spin" /> Loading…</div>
          ) : news.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No recent news</p>
          ) : (
            news.slice(0, 3).map((n) => (
              <a key={n.id || n.datetime} href={n.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-1.5 group/news py-1 hover:bg-secondary/50 rounded px-1 -mx-1 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-foreground truncate group-hover/news:text-primary transition-colors">{n.headline}</p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{n.source}</span><span>·</span><span>{timeAgo(n.datetime)}</span>
                  </div>
                </div>
                <ExternalLink size={10} className="mt-0.5 text-muted-foreground/50 shrink-0" />
              </a>
            ))
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-2 pt-1 border-t border-border/50 flex-wrap">
          <ActionBtn icon={Pencil} label="Edit" onClick={onEdit} />
          <ActionBtn icon={BookOpen} label="Log Trade" onClick={() => onLogTrade?.()} />
          <ActionBtn icon={Bell} label="Alert" onClick={() => {}} />
          <ActionBtn icon={Trash2} label="Remove" onClick={onDelete} destructive />
        </div>
      </div>

      <div className="px-3 sm:px-5 pb-4">
        <TaxLotsPanel holdingId={holding.id} ticker={holding.ticker} currentPrice={holding.currentPrice} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="font-mono text-xs text-foreground">{value}</p>
    </div>
  );
}

function ActionBtn({ icon: Icon, label, onClick, destructive }: { icon: any; label: string; onClick: () => void; destructive?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors ${
        destructive ? "text-destructive hover:bg-destructive/10" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      }`}
    >
      <Icon size={12} /> {label}
    </button>
  );
}
