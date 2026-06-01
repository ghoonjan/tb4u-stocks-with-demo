import { useMemo, useState } from "react";
import {
  Wallet,
  Lightbulb,
  TrendingUp,
  PieChart as PieIcon,
  DollarSign,
  Eye,
  Receipt,
  Info,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip } from "recharts";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { HoldingsTable } from "@/components/dashboard/HoldingsTable";
import PortfolioInsights from "@/components/dashboard/PortfolioInsights";
import { WatchlistPanel } from "@/components/dashboard/WatchlistPanel";
import { TaxLotsPanel } from "@/components/dashboard/TaxLotsPanel";
import { TaxOpportunitiesSection } from "@/components/dashboard/TaxOpportunities";
import { DividendDashboard } from "@/components/dividends/DividendDashboard";
import { useSectorLookup, resolveSector } from "@/hooks/useSectorLookup";
import { SECTOR_COLORS, CHART_TOOLTIP_STYLE, CHART_TOOLTIP_ITEM_STYLE } from "@/constants";
import type { HoldingDisplay, DbWatchlistItem } from "@/hooks/usePortfolioData";
import type { StockQuote, BasicFinancials } from "@/services/marketData";

type TabKey =
  | "holdings"
  | "insights"
  | "performance"
  | "sectors"
  | "dividends"
  | "watchlist"
  | "taxlots";

interface TabDef {
  key: TabKey;
  label: string;
  icon: React.ElementType;
  description: string;
}

const TABS: TabDef[] = [
  { key: "holdings", label: "Holdings", icon: Wallet, description: "All positions in your portfolio with live prices and P/L." },
  { key: "insights", label: "Insights", icon: Lightbulb, description: "Automated insights about concentration, country mix, and alerts." },
  { key: "performance", label: "Performance", icon: TrendingUp, description: "Simple return, time-weighted return, and win/loss summary." },
  { key: "sectors", label: "Sectors", icon: PieIcon, description: "Sector allocation breakdown across your holdings." },
  { key: "dividends", label: "Dividends", icon: DollarSign, description: "Dividend income, history, and upcoming payments." },
  { key: "watchlist", label: "Watchlist", icon: Eye, description: "Tickers you're tracking but don't own yet." },
  { key: "taxlots", label: "Tax Lots", icon: Receipt, description: "Per-lot cost basis, holding period, and tax-loss opportunities." },
];

export interface DashboardMainTabsProps {
  // holdings
  holdings: HoldingDisplay[];
  loading: boolean;
  analyticsMap: Map<string, unknown>;
  onAddHolding: () => void;
  onEditHolding: (h: HoldingDisplay) => void;
  onDeleteHolding: (h: HoldingDisplay) => void;
  onAddToWatchlist: (ticker: string, companyName: string) => void;
  onLogTrade: (h?: HoldingDisplay) => void;
  // watchlist
  watchlist: DbWatchlistItem[];
  watchlistQuotes: Map<string, StockQuote>;
  watchlistFinancials: Map<string, BasicFinancials>;
  onAddWatchlist: () => void;
  onDeleteWatchlist: (id: string) => void;
  onUpdateWatchlistTarget: (id: string, price: number | null) => void;
  onAddWatchlistToPortfolio: (ticker: string, companyName: string) => void;
  // perf
  simpleReturn: number | null;
  twr: number | null;
  twrAvailable: boolean;
}

export function DashboardMainTabs(props: DashboardMainTabsProps) {
  const [tab, setTab] = useState<TabKey>("holdings");
  const [openTip, setOpenTip] = useState<TabKey | null>(null);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="w-full">
        {/* Tab bar */}
        <div
          role="tablist"
          aria-label="Dashboard sections"
          className="flex items-center gap-1 overflow-x-auto whitespace-nowrap border-b border-border scrollbar-thin -mx-2 px-2 sm:mx-0 sm:px-0"
          style={{ scrollbarWidth: "thin" }}
        >
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            const tipOpen = openTip === t.key;
            return (
              <div key={t.key} className="relative shrink-0 flex items-center">
                <button
                  role="tab"
                  aria-selected={active}
                  aria-controls={`dash-panel-${t.key}`}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2.5 text-xs sm:text-sm font-medium transition-colors relative",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon size={14} />
                  {t.label}
                  {active && (
                    <span className="absolute left-2 right-2 -bottom-px h-[2px] bg-primary rounded-full" />
                  )}
                </button>
                <Tooltip open={tipOpen} onOpenChange={(o) => setOpenTip(o ? t.key : null)}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={`About ${t.label}`}
                      className="mr-1 p-1 text-muted-foreground/70 hover:text-foreground transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenTip((prev) => (prev === t.key ? null : t.key));
                      }}
                    >
                      <Info size={12} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    className="max-w-[280px] text-xs whitespace-normal break-words leading-snug"
                  >
                    {t.description}
                  </TooltipContent>
                </Tooltip>
              </div>
            );
          })}
        </div>

        {/* Tab panels */}
        <div className="mt-3" id={`dash-panel-${tab}`} role="tabpanel">
          {tab === "holdings" && (
            <HoldingsTable
              holdings={props.holdings}
              loading={props.loading}
              onAddHolding={props.onAddHolding}
              onEditHolding={props.onEditHolding}
              onDeleteHolding={props.onDeleteHolding}
              onAddToWatchlist={props.onAddToWatchlist}
              onLogTrade={props.onLogTrade}
              analyticsMap={props.analyticsMap as never}
            />
          )}

          {tab === "insights" && (
            <PortfolioInsights
              holdings={props.holdings}
              quotes={
                new Map<string, StockQuote>(
                  props.holdings.map((h) => [
                    h.ticker,
                    { c: h.currentPrice, d: 0, dp: 0, h: 0, l: 0, o: 0, pc: 0 },
                  ]),
                )
              }
            />
          )}

          {tab === "performance" && (
            <PerformancePanel
              holdings={props.holdings}
              simpleReturn={props.simpleReturn}
              twr={props.twr}
              twrAvailable={props.twrAvailable}
            />
          )}

          {tab === "sectors" && <SectorsPanel holdings={props.holdings} />}

          {tab === "dividends" && <DividendDashboard />}

          {tab === "watchlist" && (
            <WatchlistPanel
              items={props.watchlist}
              quotes={props.watchlistQuotes}
              financialsMap={props.watchlistFinancials}
              loading={props.loading}
              onAdd={props.onAddWatchlist}
              onDelete={props.onDeleteWatchlist}
              onUpdateTargetPrice={props.onUpdateWatchlistTarget}
              onAddToPortfolio={props.onAddWatchlistToPortfolio}
              defaultOpen
            />
          )}

          {tab === "taxlots" && <TaxLotsTabPanel holdings={props.holdings} />}
        </div>
      </div>
    </TooltipProvider>
  );
}

/* -------------------- Performance -------------------- */

function PerformancePanel({
  holdings,
  simpleReturn,
  twr,
  twrAvailable,
}: {
  holdings: HoldingDisplay[];
  simpleReturn: number | null;
  twr: number | null;
  twrAvailable: boolean;
}) {
  const winners = holdings.filter((h) => h.totalPLDollar >= 0);
  const losers = holdings.filter((h) => h.totalPLDollar < 0);
  const totalGain = winners.reduce((s, h) => s + h.totalPLDollar, 0);
  const totalLoss = losers.reduce((s, h) => s + h.totalPLDollar, 0);
  const winPct = holdings.length > 0 ? (winners.length / holdings.length) * 100 : 0;

  const fmtMoney = (n: number) =>
    "$" + Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
  const fmtPct = (n: number | null) =>
    n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

  if (holdings.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Add holdings to see performance metrics.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Simple Return</p>
        <p
          className={cn(
            "mt-1 font-mono text-2xl font-bold",
            (simpleReturn ?? 0) >= 0 ? "text-gain" : "text-loss",
          )}
        >
          {fmtPct(simpleReturn)}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">Total return on current holdings.</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Time-Weighted Return
        </p>
        <p
          className={cn(
            "mt-1 font-mono text-2xl font-bold",
            (twr ?? 0) >= 0 ? "text-gain" : "text-loss",
          )}
        >
          {twrAvailable ? fmtPct(twr) : "—"}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {twrAvailable ? "Removes the effect of cash flows." : "Needs more trade history."}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 sm:col-span-2">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
          Win / Loss
        </p>
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 h-3 rounded-full bg-loss/20 overflow-hidden">
            <div className="h-full bg-gain rounded-full transition-all" style={{ width: `${winPct}%` }} />
          </div>
          <span className="font-mono text-xs text-foreground whitespace-nowrap">
            {winners.length}W / {losers.length}L
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          {winners.length} of {holdings.length} positions profitable ({winPct.toFixed(0)}%)
        </p>
        <div className="flex flex-wrap gap-4 text-xs">
          <div>
            <span className="text-muted-foreground">Unrealized gains: </span>
            <span className="font-mono text-gain">+{fmtMoney(totalGain)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Unrealized losses: </span>
            <span className="font-mono text-loss">-{fmtMoney(Math.abs(totalLoss))}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------- Sectors -------------------- */

function SectorsPanel({ holdings }: { holdings: HoldingDisplay[] }) {
  const tickers = useMemo(() => holdings.map((h) => h.ticker), [holdings]);
  const { lookup } = useSectorLookup(tickers);

  const sectorData = useMemo(() => {
    const map = new Map<string, number>();
    holdings.forEach((h) => {
      const sector = resolveSector(h.ticker, lookup);
      map.set(sector, (map.get(sector) ?? 0) + h.weight);
    });
    return [...map.entries()]
      .map(([name, value], i) => ({
        name,
        value: +value.toFixed(1),
        fill: SECTOR_COLORS[i % SECTOR_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [holdings, lookup]);

  if (holdings.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Add holdings to see your sector allocation.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        Sector Allocation
      </h4>
      <div className="grid gap-4 md:grid-cols-2 items-center">
        <div className="h-[220px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={sectorData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {sectorData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <RTooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                formatter={(v: number) => `${v.toFixed(1)}%`}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="font-mono text-2xl font-bold text-foreground">{sectorData.length}</p>
              <p className="text-[10px] text-muted-foreground">sectors</p>
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          {sectorData.map((s) => (
            <div key={s.name} className="flex items-center gap-2 text-xs">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ background: s.fill }}
                aria-hidden="true"
              />
              <span className="text-foreground flex-1">{s.name}</span>
              <span className="font-mono text-muted-foreground">{s.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* -------------------- Tax Lots -------------------- */

function TaxLotsTabPanel({ holdings }: { holdings: HoldingDisplay[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(holdings[0]?.id ?? null);
  const selected = holdings.find((h) => h.id === selectedId) ?? holdings[0];

  if (holdings.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Add holdings to view tax lots and opportunities.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <TaxOpportunitiesSection holdings={holdings} />
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Lots for
          </span>
          <select
            value={selected?.id ?? ""}
            onChange={(e) => setSelectedId(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
          >
            {holdings.map((h) => (
              <option key={h.id} value={h.id}>
                {h.ticker}
              </option>
            ))}
          </select>
        </div>
        {selected && (
          <TaxLotsPanel
            holdingId={selected.id}
            ticker={selected.ticker}
            currentPrice={selected.currentPrice}
          />
        )}
      </div>
    </div>
  );
}
