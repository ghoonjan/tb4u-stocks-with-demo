import { memo, lazy, Suspense, useState } from "react";
import { ChevronDown, Loader2, MoreHorizontal, Pencil, Trash2, BookOpen, Eye, Star } from "lucide-react";
import type { HoldingDisplay } from "@/hooks/usePortfolioData";
import type { HoldingAnalytics } from "@/hooks/useAnalyticsData";
import { fmtDollar, fmtPct, fmtPL, plColor, plArrow } from "@/constants";
import { formatPurchaseDate, formatHoldingPeriod } from "@/hooks/portfolioUtils";
import { TermBadge } from "@/components/dashboard/TermBadge";

const HoldingDetailCard = lazy(() =>
  import("@/components/dashboard/HoldingDetailCard").then((m) => ({ default: m.HoldingDetailCard }))
);

interface MobileHoldingCardProps {
  h: HoldingDisplay;
  onEdit: () => void;
  onDelete: () => void;
  onLogTrade: () => void;
  onAddToWatchlist: () => void;
  analytics?: HoldingAnalytics;
}

export const MobileHoldingCard = memo(function MobileHoldingCard({
  h, onEdit, onDelete, onLogTrade, onAddToWatchlist, analytics,
}: MobileHoldingCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="border-b border-border/50">
      <div className="px-3 py-3 flex items-center gap-3" onClick={() => setExpanded(!expanded)}>
        {/* Left: ticker info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">{h.ticker}</span>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} size={8} className={i <= h.convictionRating ? "fill-primary text-primary" : "text-muted-foreground/30"} />
              ))}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground truncate">{h.companyName}</p>
        </div>

        {/* Right: price & P/L */}
        <div className="text-right shrink-0">
          <p className="font-mono text-sm text-foreground">{fmtDollar(h.currentPrice)}</p>
          <p className={`font-mono text-[11px] ${plColor(h.dayChangeDollar)}`}>
            {plArrow(h.dayChangeDollar)} {fmtPL(h.dayChangeDollar)} ({fmtPct(h.dayChangePct)})
          </p>
        </div>

        {/* Chevron */}
        <ChevronDown size={14} className={`text-muted-foreground transition-transform shrink-0 ${expanded ? "rotate-180" : ""}`} />
      </div>

      {/* Summary row */}
      <div className="px-3 pb-2 flex items-center gap-4 text-[10px]">
        <div>
          <span className="text-muted-foreground">Value: </span>
          <span className="font-mono text-foreground">{fmtDollar(h.positionValue)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">P&L: </span>
          <span className={`font-mono ${plColor(h.totalPLDollar)}`}>{fmtPL(h.totalPLDollar)} ({fmtPct(h.totalPLPct)})</span>
        </div>
        <div>
          <span className="text-muted-foreground">Wt: </span>
          <span className="font-mono text-foreground">{h.weight.toFixed(1)}%</span>
        </div>

        {/* Actions menu */}
        <div className="ml-auto relative">
          <button onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }} className="p-1 rounded text-muted-foreground hover:bg-secondary">
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-30 w-40 rounded-md border border-border bg-card py-1 shadow-lg animate-in fade-in zoom-in-95 duration-150">
              {[
                { label: "Edit", icon: Pencil, action: onEdit },
                { label: "Log Trade", icon: BookOpen, action: onLogTrade },
                { label: "Watch", icon: Eye, action: onAddToWatchlist },
                { label: "Remove", icon: Trash2, action: onDelete, destructive: true },
              ].map((item) => (
                <button key={item.label} onClick={(e) => { e.stopPropagation(); setMenuOpen(false); item.action(); }}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-secondary ${"destructive" in item && item.destructive ? "text-destructive" : "text-foreground"}`}>
                  <item.icon size={12} /> {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Purchase date / holding period row */}
      <div className="px-3 pb-2 flex items-center gap-2 text-[10px]">
        <span className="text-muted-foreground">Held:</span>
        <span className="text-foreground">{formatPurchaseDate(h.purchaseDate)}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{formatHoldingPeriod(h.holdingPeriodDays)}</span>
        <TermBadge isLongTerm={h.isLongTerm} className="ml-auto" />
      </div>

      {/* Expanded detail */}
      <div className={`overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${expanded ? "max-h-[2400px] opacity-100" : "max-h-0 opacity-0"}`}>
        {expanded && (
          <Suspense fallback={<div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>}>
            <HoldingDetailCard holding={h} onEdit={onEdit} onDelete={onDelete} onLogTrade={onLogTrade} />
          </Suspense>
        )}
      </div>
    </div>
  );
});
