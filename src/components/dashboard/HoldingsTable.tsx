import { useState, useMemo, useRef, useEffect, useCallback, Fragment, memo, lazy, Suspense, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Star, Plus, ChevronsUpDown, MoreHorizontal, Pencil, Trash2, BookOpen, Eye, Loader2 } from "lucide-react";
import type { HoldingDisplay } from "@/hooks/usePortfolioData";
import type { HoldingAnalytics } from "@/hooks/useAnalyticsData";
import { EmptyHoldings } from "@/components/dashboard/EmptyStates";
import { calcDivSafety, DivSafetyBadge } from "@/components/dashboard/DivSafety";
import { fmt, fmtDollar, fmtPct, fmtPL, plColor, plArrow } from "@/constants";
import { MobileHoldingCard } from "@/components/dashboard/MobileHoldingCard";
import { useIsMobile } from "@/hooks/use-mobile";

export type { HoldingDisplay };

const HoldingDetailCard = lazy(() =>
  import("@/components/dashboard/HoldingDetailCard").then((m) => ({ default: m.HoldingDetailCard }))
);

type SortKey = keyof HoldingDisplay;
type SortDir = "asc" | "desc";

function ConvictionStars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`Conviction ${rating} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={12} className={i <= rating ? "fill-primary text-primary" : "text-muted-foreground/30"} />
      ))}
    </div>
  );
}

function ScrollShadowWrapper({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const check = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [check]);

  return (
    <div className="relative">
      <div ref={scrollRef} onScroll={check} className="overflow-x-auto">
        {children}
      </div>
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-card/90 to-transparent transition-opacity duration-200"
        style={{ opacity: canScrollLeft ? 1 : 0 }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-card/90 to-transparent transition-opacity duration-200"
        style={{ opacity: canScrollRight ? 1 : 0 }}
      />
    </div>
  );
}

function SortHeader({ label, sortKey, currentSort, currentDir, onSort, className = "" }: {
  label: string; sortKey: SortKey; currentSort: SortKey; currentDir: SortDir; onSort: (k: SortKey) => void; className?: string;
}) {
  const active = currentSort === sortKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={`flex items-center gap-1 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground transition-colors ${className}`}
    >
      {label}
      {active ? (currentDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ChevronsUpDown size={10} className="opacity-30" />}
    </button>
  );
}

function RowMenu({ onEdit, onDelete, onLogTrade, onAddToWatchlist }: {
  onEdit: () => void; onDelete: () => void; onLogTrade: () => void; onAddToWatchlist: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);
  const items = [
    { label: "Edit Holding", icon: Pencil, action: onEdit },
    { label: "Remove Holding", icon: Trash2, action: onDelete, destructive: true },
    { label: "Log Trade", icon: BookOpen, action: onLogTrade },
    { label: "Add to Watchlist", icon: Eye, action: onAddToWatchlist },
  ];
  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="rounded-md p-1 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-secondary hover:text-foreground"
      >
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-44 rounded-md border border-border bg-card py-1 shadow-lg animate-in fade-in zoom-in-95 duration-150" role="menu">
          {items.map((item) => (
            <button key={item.label} onClick={(e) => { e.stopPropagation(); setOpen(false); item.action(); }}
              role="menuitem"
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-secondary ${item.destructive ? "text-destructive" : "text-foreground"}`}>
              <item.icon size={13} /> {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-0">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4 border-b border-border/50" style={{ animationDelay: `${i * 80}ms` }}>
          <div className="flex items-center gap-3 w-[150px]">
            <div className="h-4 w-14 rounded skeleton-shimmer" />
            <div className="h-3 w-20 rounded skeleton-shimmer" />
          </div>
          <div className="ml-auto flex gap-6">
            <div className="h-3 w-14 rounded skeleton-shimmer" />
            <div className="h-3 w-14 rounded skeleton-shimmer" />
            <div className="h-3 w-20 rounded skeleton-shimmer" />
            <div className="h-3 w-16 rounded skeleton-shimmer" />
            <div className="h-3 w-12 rounded skeleton-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MobileSkeleton() {
  return (
    <div className="space-y-0">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3 border-b border-border/50">
          <div className="flex-1">
            <div className="h-4 w-16 rounded skeleton-shimmer mb-1" />
            <div className="h-3 w-24 rounded skeleton-shimmer" />
          </div>
          <div className="text-right">
            <div className="h-4 w-16 rounded skeleton-shimmer mb-1" />
            <div className="h-3 w-20 rounded skeleton-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}

const HoldingRow = memo(function HoldingRow({
  h, isExpanded, onToggle, onEdit, onDelete, onLogTrade, onAddToWatchlist, analytics,
}: {
  h: HoldingDisplay; isExpanded: boolean; onToggle: () => void; onEdit: () => void; onDelete: () => void; onLogTrade: () => void; onAddToWatchlist: () => void; analytics?: HoldingAnalytics;
}) {
  return (
    <Fragment>
      <tr onClick={onToggle} className="group border-b border-border/50 cursor-pointer transition-colors hover:bg-overlay/50" tabIndex={0} role="row"
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}>
        <td className="py-3 px-4 relative cell-accent-border">
          <div>
            <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{h.ticker}</span>
            <p className="text-[11px] text-muted-foreground truncate max-w-[170px]">{h.companyName}</p>
          </div>
        </td>
        <td className="py-3 px-3 text-right font-mono text-sm text-foreground">{fmt(h.shares, h.shares % 1 !== 0 ? 4 : 0)}</td>
        <td className="py-3 px-3 text-right font-mono text-sm text-muted-foreground">{fmtDollar(h.avgCostBasis)}</td>
        <td className="py-3 px-3 text-right font-mono text-sm text-foreground">{fmtDollar(h.currentPrice)}</td>
        <td className="py-3 px-3 text-right">
          <span className={`font-mono text-sm ${plColor(h.dayChangeDollar)} ${Math.abs(h.dayChangePct) > 5 ? (h.dayChangePct > 0 ? "gain-shimmer" : "loss-pulse") : ""}`}>
            {plArrow(h.dayChangeDollar)} {fmtPL(h.dayChangeDollar)}
          </span>
          <span className={`font-mono text-[11px] ml-1 ${plColor(h.dayChangePct)}`}>{fmtPct(h.dayChangePct)}</span>
        </td>
        <td className="py-3 px-3 text-right">
          <span className={`font-mono text-sm ${plColor(h.totalPLDollar)}`}>{plArrow(h.totalPLDollar)} {fmtPL(h.totalPLDollar)}</span>
          <span className={`font-mono text-[11px] ml-1 ${plColor(h.totalPLPct)}`}>{fmtPct(h.totalPLPct)}</span>
        </td>
        <td className="py-3 px-3 text-right font-mono text-sm text-foreground">{fmtDollar(h.positionValue)}</td>
        <td className="py-3 px-3 text-right font-mono text-sm text-foreground">{fmt(h.weight, 1)}%</td>
        <td className="py-3 px-3"><div className="flex justify-center"><ConvictionStars rating={h.convictionRating} /></div></td>
        <td className="py-3 px-3">
          <div className="flex justify-center">
            {(() => {
              if (!analytics || analytics.divYield <= 0) return <span className="text-[10px] text-muted-foreground/40">—</span>;
              const safety = calcDivSafety(analytics.divYield, analytics.payoutRatio, analytics.divGrowth5Y);
              return <DivSafetyBadge rating={safety?.rating ?? null} />;
            })()}
          </div>
        </td>
        <td className="py-3 px-3">
          <RowMenu onEdit={onEdit} onDelete={onDelete} onLogTrade={onLogTrade} onAddToWatchlist={onAddToWatchlist} />
        </td>
      </tr>
      <tr>
        <td colSpan={11} className="p-0">
          <div className={`overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${isExpanded ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"}`}>
            {isExpanded && (
              <Suspense fallback={<div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-muted-foreground" /><span className="ml-2 text-xs text-muted-foreground">Loading chart data…</span></div>}>
                <HoldingDetailCard holding={h} onEdit={onEdit} onDelete={onDelete} onLogTrade={onLogTrade} />
              </Suspense>
            )}
          </div>
        </td>
      </tr>
    </Fragment>
  );
});

interface HoldingsTableProps {
  holdings: HoldingDisplay[];
  loading: boolean;
  onAddHolding: () => void;
  onEditHolding: (h: HoldingDisplay) => void;
  onDeleteHolding: (h: HoldingDisplay) => void;
  onAddToWatchlist: (ticker: string, companyName: string) => void;
  onLogTrade?: (h: HoldingDisplay) => void;
  analyticsMap?: Map<string, HoldingAnalytics>;
}

export function HoldingsTable({ holdings, loading, onAddHolding, onEditHolding, onDeleteHolding, onAddToWatchlist, onLogTrade, analyticsMap }: HoldingsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("weight");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const sorted = useMemo(() => {
    return [...holdings].sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc" ? String(av ?? "").localeCompare(String(bv ?? "")) : String(bv ?? "").localeCompare(String(av ?? ""));
    });
  }, [holdings, sortKey, sortDir]);

  return (
    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden" style={{ boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.04)" }}>
      {loading ? (
        isMobile ? <MobileSkeleton /> : <TableSkeleton />
      ) : holdings.length === 0 ? (
        <EmptyHoldings onAdd={onAddHolding} />
      ) : isMobile ? (
        /* Mobile card layout */
        <div>
          {/* Mobile sort bar */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card/80 overflow-x-auto scrollbar-none">
            <span className="text-[10px] text-muted-foreground uppercase shrink-0">Sort:</span>
            {([
              ["weight", "Weight"],
              ["dayChangePct", "Day"],
              ["totalPLPct", "P&L"],
              ["positionValue", "Value"],
              ["ticker", "Name"],
            ] as [SortKey, string][]).map(([key, label]) => (
              <button key={key} onClick={() => handleSort(key)}
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${sortKey === key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                {label} {sortKey === key && (sortDir === "asc" ? "↑" : "↓")}
              </button>
            ))}
          </div>

          {sorted.map((h) => (
            <MobileHoldingCard
              key={h.id}
              h={h}
              onEdit={() => onEditHolding(h)}
              onDelete={() => onDeleteHolding(h)}
              onLogTrade={() => onLogTrade?.(h)}
              onAddToWatchlist={() => onAddToWatchlist(h.ticker, h.companyName)}
              analytics={analyticsMap?.get(h.ticker)}
            />
          ))}
        </div>
      ) : (
        /* Desktop table */
        <ScrollShadowWrapper>
          <table className="w-full min-w-[1200px]" role="table">
            <colgroup>
              <col style={{ width: 200 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 65 }} />
              <col style={{ width: 85 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 80 }} />
            </colgroup>
            <thead>
              <tr className="border-b border-border">
                <th className="py-3 px-4 text-left sticky top-0 z-10 bg-card"><SortHeader label="Ticker" sortKey="ticker" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} /></th>
                <th className="py-3 px-3 text-right sticky top-0 z-10 bg-card"><SortHeader label="Shares" sortKey="shares" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-end" /></th>
                <th className="py-3 px-3 text-right sticky top-0 z-10 bg-card"><SortHeader label="Avg Cost" sortKey="avgCostBasis" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-end" /></th>
                <th className="py-3 px-3 text-right sticky top-0 z-10 bg-card"><SortHeader label="Price" sortKey="currentPrice" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-end" /></th>
                <th className="py-3 px-3 text-right sticky top-0 z-10 bg-card"><SortHeader label="Day Chg" sortKey="dayChangeDollar" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-end" /></th>
                <th className="py-3 px-3 text-right sticky top-0 z-10 bg-card"><SortHeader label="Total P&L" sortKey="totalPLDollar" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-end" /></th>
                <th className="py-3 px-3 text-right sticky top-0 z-10 bg-card"><SortHeader label="Value" sortKey="positionValue" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-end" /></th>
                <th className="py-3 px-3 text-right sticky top-0 z-10 bg-card"><SortHeader label="Wt%" sortKey="weight" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-end" /></th>
                <th className="py-3 px-3 text-center sticky top-0 z-10 bg-card"><span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Conv.</span></th>
                <th className="py-3 px-3 text-center sticky top-0 z-10 bg-card"><span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Div</span></th>
                <th className="py-3 px-3 sticky top-0 z-10 bg-card" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((h) => (
                <HoldingRow
                  key={h.id}
                  h={h}
                  isExpanded={expandedId === h.id}
                  onToggle={() => setExpandedId(expandedId === h.id ? null : h.id)}
                  onEdit={() => onEditHolding(h)}
                  onDelete={() => onDeleteHolding(h)}
                  onLogTrade={() => onLogTrade?.(h)}
                  onAddToWatchlist={() => onAddToWatchlist(h.ticker, h.companyName)}
                  analytics={analyticsMap?.get(h.ticker)}
                />
              ))}
            </tbody>
          </table>
        </ScrollShadowWrapper>
      )}
      {!loading && holdings.length > 0 && (
        <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-t border-border">
          <span className="text-xs text-muted-foreground">{holdings.length} holding{holdings.length !== 1 ? "s" : ""}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onAddHolding(); }}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus size={13} /> Add Holding
          </button>
        </div>
      )}
    </div>
  );
}
