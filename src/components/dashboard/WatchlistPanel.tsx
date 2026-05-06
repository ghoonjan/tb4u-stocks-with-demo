import { useState, useMemo, useRef, useEffect, Fragment } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2, ChevronsUpDown, Target, Pencil, Check, X, ArrowRightLeft, Loader2, ExternalLink } from "lucide-react";
import { EmptyWatchlist } from "@/components/dashboard/EmptyStates";
import type { DbWatchlistItem } from "@/hooks/usePortfolioData";
import type { StockQuote, BasicFinancials, NewsArticle } from "@/services/marketData";
import { getCandles, getCompanyNews, getBasicFinancials } from "@/services/marketData";
import { AreaChart, Area, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer } from "recharts";

const fmt = (n: number, d = 2) =>
  n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

type SortKey = "ticker" | "currentPrice" | "dayChange" | "distanceToTarget" | "pe" | "divYield";
type SortDir = "asc" | "desc";

interface WatchlistItemWithQuote extends DbWatchlistItem {
  quote: StockQuote | null;
  financials: BasicFinancials | null;
}

interface WatchlistPanelProps {
  items: DbWatchlistItem[];
  quotes: Map<string, StockQuote>;
  financialsMap: Map<string, BasicFinancials>;
  loading: boolean;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onUpdateTargetPrice: (id: string, price: number | null) => void;
  onAddToPortfolio: (ticker: string, companyName: string) => void;
}

const MAX_WATCHLIST = 30;

function SortHeader({ label, sortKey, currentSort, currentDir, onSort, className = "" }: {
  label: string; sortKey: SortKey; currentSort: SortKey; currentDir: SortDir; onSort: (k: SortKey) => void; className?: string;
}) {
  const active = currentSort === sortKey;
  return (
    <button onClick={() => onSort(sortKey)} className={`flex items-center gap-1 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground transition-colors ${className}`}>
      {label}
      {active ? (currentDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ChevronsUpDown size={10} className="opacity-30" />}
    </button>
  );
}

type TimeRange = "1D" | "1W" | "1M";

function WatchlistDetailCard({ item, quote }: { item: DbWatchlistItem; quote: StockQuote | null }) {
  const [range, setRange] = useState<TimeRange>("1M");
  const [chartData, setChartData] = useState<{ time: string; price: number }[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [financials, setFinancials] = useState<BasicFinancials | null>(null);

  useEffect(() => {
    let cancelled = false;
    setChartLoading(true);
    getCandles(item.ticker, range).then((candles) => {
      if (cancelled) return;
      if (candles && candles.t) {
        setChartData(candles.t.map((t, i) => {
          const d = new Date(t * 1000);
          const label = range === "1D"
            ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
            : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          return { time: label, price: candles.c[i] };
        }));
      } else setChartData([]);
      setChartLoading(false);
    }).catch(() => { if (!cancelled) { setChartData([]); setChartLoading(false); } });
    return () => { cancelled = true; };
  }, [item.ticker, range]);

  useEffect(() => {
    let cancelled = false;
    setNewsLoading(true);
    Promise.all([
      getCompanyNews(item.ticker).catch(() => []),
      getBasicFinancials(item.ticker).catch(() => null),
    ]).then(([n, f]) => {
      if (cancelled) return;
      setNews(n);
      setFinancials(f);
      setNewsLoading(false);
    });
    return () => { cancelled = true; };
  }, [item.ticker]);

  const firstPrice = chartData[0]?.price ?? (quote?.c ?? 0);
  const lastPrice = chartData[chartData.length - 1]?.price ?? (quote?.c ?? 0);
  const chartGain = lastPrice >= firstPrice;
  const chartColor = chartGain ? "hsl(142, 71%, 45%)" : "hsl(0, 84%, 60%)";

  const w52High = financials?.["52WeekHigh"] ?? 0;
  const w52Low = financials?.["52WeekLow"] ?? 0;
  const w52Range = w52High - w52Low;
  const w52Pct = w52Range > 0 ? (((quote?.c ?? 0) - w52Low) / w52Range) * 100 : 50;

  return (
    <div className="flex gap-4 px-5 py-4 bg-secondary/20 border-b border-border" onClick={(e) => e.stopPropagation()}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-2">
          {(["1D", "1W", "1M"] as TimeRange[]).map((r) => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
              {r}
            </button>
          ))}
        </div>
        <div className="h-[140px]">
          {chartLoading ? (
            <div className="flex items-center justify-center h-full"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-xs text-muted-foreground">No chart data</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={`wl-fill-${item.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColor} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" tick={{ fontSize: 9, fill: "hsl(215, 20%, 65%)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={40} />
                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 9, fill: "hsl(215, 20%, 65%)" }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => `$${v.toFixed(0)}`} />
                <ReTooltip contentStyle={{ backgroundColor: "hsl(240,16%,8%)", border: "1px solid hsl(240,12%,16%)", borderRadius: 6, fontSize: 11, color: "hsl(215,28%,90%)" }} formatter={(value: number) => [`$${value.toFixed(2)}`, "Price"]} />
                <Area type="monotone" dataKey="price" stroke={chartColor} strokeWidth={1.5} fill={`url(#wl-fill-${item.id})`} dot={false} activeDot={{ r: 3, fill: chartColor, stroke: "hsl(240,16%,8%)", strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="grid grid-cols-3 gap-x-4 gap-y-1">
          <div><p className="text-[10px] text-muted-foreground">Open</p><p className="font-mono text-xs text-foreground">${quote?.o?.toFixed(2) ?? "—"}</p></div>
          <div><p className="text-[10px] text-muted-foreground">High</p><p className="font-mono text-xs text-foreground">${quote?.h?.toFixed(2) ?? "—"}</p></div>
          <div><p className="text-[10px] text-muted-foreground">Low</p><p className="font-mono text-xs text-foreground">${quote?.l?.toFixed(2) ?? "—"}</p></div>
          <div><p className="text-[10px] text-muted-foreground">P/E</p><p className="font-mono text-xs text-foreground">{financials?.peNormalizedAnnual?.toFixed(1) ?? "—"}</p></div>
          <div><p className="text-[10px] text-muted-foreground">Div Yield</p><p className="font-mono text-xs text-foreground">{financials?.dividendYieldIndicatedAnnual ? financials.dividendYieldIndicatedAnnual.toFixed(2) + "%" : "—"}</p></div>
          <div><p className="text-[10px] text-muted-foreground">Prev Close</p><p className="font-mono text-xs text-foreground">${quote?.pc?.toFixed(2) ?? "—"}</p></div>
        </div>
        {w52Range > 0 && (
          <div className="space-y-0.5">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>${w52Low.toFixed(0)}</span>
              <span className="font-medium">52W Range</span>
              <span>${w52High.toFixed(0)}</span>
            </div>
            <div className="relative h-1.5 rounded-full bg-secondary">
              <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary border border-card" style={{ left: `${Math.min(Math.max(w52Pct, 2), 98)}%` }} />
            </div>
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Headlines</span>
          {newsLoading ? (
            <div className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 size={12} className="animate-spin" /> Loading…</div>
          ) : news.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No recent news</p>
          ) : (
            news.slice(0, 3).map((n) => (
              <a key={n.id || n.datetime} href={n.url} target="_blank" rel="noopener noreferrer"
                className="flex items-start gap-1.5 group/news py-1 hover:bg-secondary/50 rounded px-1 -mx-1 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-foreground truncate group-hover/news:text-primary transition-colors">{n.headline}</p>
                  <span className="text-[10px] text-muted-foreground">{n.source}</span>
                </div>
                <ExternalLink size={10} className="mt-0.5 text-muted-foreground/50 shrink-0" />
              </a>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function InlineTargetEdit({ value, onSave, onCancel }: { value: number | null; onSave: (v: number | null) => void; onCancel: () => void }) {
  const [val, setVal] = useState(value?.toString() ?? "");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <span className="text-muted-foreground text-xs">$</span>
      <input ref={ref} type="number" step="any" min="0.01" value={val} onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onSave(val ? parseFloat(val) : null); if (e.key === "Escape") onCancel(); }}
        className="w-16 rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-xs text-foreground focus:border-primary focus:outline-none" />
      <button onClick={() => onSave(val ? parseFloat(val) : null)} className="text-gain hover:text-gain/80"><Check size={12} /></button>
      <button onClick={onCancel} className="text-muted-foreground hover:text-foreground"><X size={12} /></button>
    </div>
  );
}

export function WatchlistPanel({ items, quotes, financialsMap, loading, onAdd, onDelete, onUpdateTargetPrice, onAddToPortfolio }: WatchlistPanelProps) {
  const [open, setOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("ticker");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const enriched: WatchlistItemWithQuote[] = useMemo(() =>
    items.map((w) => ({ ...w, quote: quotes.get(w.ticker) ?? null, financials: financialsMap.get(w.ticker) ?? null })),
    [items, quotes, financialsMap]);

  const sorted = useMemo(() => {
    return [...enriched].sort((a, b) => {
      let av: number, bv: number;
      switch (sortKey) {
        case "ticker": return sortDir === "asc" ? a.ticker.localeCompare(b.ticker) : b.ticker.localeCompare(a.ticker);
        case "currentPrice": av = a.quote?.c ?? 0; bv = b.quote?.c ?? 0; break;
        case "dayChange": av = a.quote?.dp ?? 0; bv = b.quote?.dp ?? 0; break;
        case "distanceToTarget": {
          const da = a.target_price && a.quote ? ((a.quote.c - a.target_price) / a.target_price) * 100 : 999;
          const db = b.target_price && b.quote ? ((b.quote.c - b.target_price) / b.target_price) * 100 : 999;
          av = da; bv = db; break;
        }
        case "pe": av = a.financials?.peNormalizedAnnual ?? 999; bv = b.financials?.peNormalizedAnnual ?? 999; break;
        case "divYield": av = a.financials?.dividendYieldIndicatedAnnual ?? 0; bv = b.financials?.dividendYieldIndicatedAnnual ?? 0; break;
        default: av = 0; bv = 0;
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [enriched, sortKey, sortDir]);

  // Check target hits
  const targetHits = useMemo(() => {
    const hits = new Set<string>();
    items.forEach((w) => {
      const q = quotes.get(w.ticker);
      if (w.target_price && q && q.c <= w.target_price) hits.add(w.id);
    });
    return hits;
  }, [items, quotes]);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <div className="flex items-center gap-2">
          <span>Watchlist ({items.length}/{MAX_WATCHLIST})</span>
          {targetHits.size > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-gain/15 px-2 py-0.5 text-[10px] font-semibold text-gain animate-pulse">
              <Target size={10} /> {targetHits.size} target{targetHits.size !== 1 ? "s" : ""} hit!
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {items.length < MAX_WATCHLIST && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); onAdd(); }}
              className="rounded-md border border-border px-2 py-0.5 text-[10px] hover:border-primary hover:text-primary transition-colors"
            >
              <Plus size={10} className="inline mr-0.5" /> Add
            </span>
          )}
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      <div className={`overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${open ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`}>
        {loading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-8 rounded bg-secondary animate-pulse" />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyWatchlist onAdd={onAdd} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] table-fixed">
              <colgroup>
                <col style={{ width: 130 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 60 }} />
                <col style={{ width: 60 }} />
                <col style={{ width: 90 }} />
              </colgroup>
              <thead>
                <tr className="border-t border-border">
                  <th className="py-2 px-4 text-left"><SortHeader label="Ticker" sortKey="ticker" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} /></th>
                  <th className="py-2 px-3 text-right"><SortHeader label="Price" sortKey="currentPrice" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-end" /></th>
                  <th className="py-2 px-3 text-right"><SortHeader label="Day Chg" sortKey="dayChange" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-end" /></th>
                  <th className="py-2 px-3 text-right">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Target</span>
                  </th>
                  <th className="py-2 px-3 text-right"><SortHeader label="Distance" sortKey="distanceToTarget" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-end" /></th>
                  <th className="py-2 px-3 text-right">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">52W Range</span>
                  </th>
                  <th className="py-2 px-3 text-right"><SortHeader label="P/E" sortKey="pe" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-end" /></th>
                  <th className="py-2 px-3 text-right"><SortHeader label="Yield" sortKey="divYield" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-end" /></th>
                  <th className="py-2 px-3" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((w) => {
                  const isExpanded = expandedId === w.id;
                  const isHit = targetHits.has(w.id);
                  const q = w.quote;
                  const fin = w.financials;
                  const distancePct = w.target_price && q ? ((q.c - w.target_price) / w.target_price) * 100 : null;
                  const w52High = fin?.["52WeekHigh"] ?? 0;
                  const w52Low = fin?.["52WeekLow"] ?? 0;
                  const w52Range = w52High - w52Low;
                  const w52Pct = w52Range > 0 ? ((q?.c ?? 0) - w52Low) / w52Range * 100 : 50;

                  return (
                    <Fragment key={w.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : w.id)}
                        className={`group border-t border-border/50 cursor-pointer transition-colors hover:bg-secondary/50 relative ${isHit ? "bg-gain/5" : ""}`}
                      >
                        <td className="py-2.5 px-4 relative">
                          {isHit && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gain rounded-r" />}
                          <div className="flex items-center gap-1.5">
                            {isHit && <Target size={12} className="text-gain shrink-0" />}
                            <div>
                              <span className="text-sm font-bold text-foreground">{w.ticker}</span>
                              {w.company_name && <p className="text-[10px] text-muted-foreground truncate max-w-[100px]">{w.company_name}</p>}
                            </div>
                          </div>
                          {isHit && <p className="text-[9px] font-semibold text-gain mt-0.5">🎯 Target hit!</p>}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-sm text-foreground">
                          {q ? `$${fmt(q.c)}` : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {q ? (
                            <>
                              <span className={`font-mono text-sm ${q.d >= 0 ? "text-gain" : "text-loss"}`}>
                                {q.d >= 0 ? "+" : ""}{fmt(q.d)}
                              </span>
                              <span className={`font-mono text-[11px] ml-1 ${q.dp >= 0 ? "text-gain" : "text-loss"}`}>
                                {q.dp >= 0 ? "+" : ""}{fmt(q.dp)}%
                              </span>
                            </>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                          {editingTargetId === w.id ? (
                            <InlineTargetEdit
                              value={w.target_price}
                              onSave={(v) => { onUpdateTargetPrice(w.id, v); setEditingTargetId(null); }}
                              onCancel={() => setEditingTargetId(null)}
                            />
                          ) : (
                            <button
                              onClick={() => setEditingTargetId(w.id)}
                              className="group/edit font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
                              title="Click to edit"
                            >
                              {w.target_price ? `$${fmt(w.target_price)}` : "Set"}
                              <Pencil size={9} className="inline ml-1 opacity-0 group-hover/edit:opacity-100 transition-opacity" />
                            </button>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {distancePct !== null ? (
                            <span className={`font-mono text-xs font-medium ${distancePct <= 0 ? "text-gain" : "text-warning"}`}>
                              {distancePct <= 0
                                ? `${fmt(Math.abs(distancePct))}% below`
                                : `+${fmt(distancePct)}% above`}
                            </span>
                          ) : <span className="text-muted-foreground/40 text-[10px]">—</span>}
                        </td>
                        <td className="py-2.5 px-3">
                          {w52Range > 0 ? (
                            <div className="w-16 ml-auto">
                              <div className="relative h-1 rounded-full bg-secondary">
                                <div className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary border border-card" style={{ left: `${Math.min(Math.max(w52Pct, 2), 98)}%` }} />
                              </div>
                              <div className="flex justify-between text-[8px] text-muted-foreground mt-0.5">
                                <span>${w52Low.toFixed(0)}</span>
                                <span>${w52High.toFixed(0)}</span>
                              </div>
                            </div>
                          ) : <span className="text-muted-foreground/40 text-[10px]">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-xs text-muted-foreground">
                          {fin?.peNormalizedAnnual?.toFixed(1) ?? "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-xs text-muted-foreground">
                          {fin?.dividendYieldIndicatedAnnual ? `${fin.dividendYieldIndicatedAnnual.toFixed(2)}%` : "—"}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={(e) => { e.stopPropagation(); onAddToPortfolio(w.ticker, w.company_name ?? ""); }}
                              className="rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 hover:border-primary hover:text-primary transition-all flex items-center gap-0.5"
                              title="Add to Portfolio"
                            >
                              <ArrowRightLeft size={10} /> Portfolio
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onDelete(w.id); }}
                              className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={9} className="p-0">
                          <div className={`overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${isExpanded ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"}`}>
                            {isExpanded && <WatchlistDetailCard item={w} quote={q} />}
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
