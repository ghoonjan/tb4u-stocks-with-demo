import { useEffect, useMemo, useState } from 'react';
import { useDividends } from '@/hooks/useDividends';
import { usePortfolioData } from '@/hooks/usePortfolioData';
import { useAnalyticsData } from '@/hooks/useAnalyticsData';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { syncDividendsForUserWithToast } from '@/lib/dividendSync';
import {
  DollarSign,
  TrendingUp,
  Calendar,
  PiggyBank,
  ArrowUpDown,
  AlertTriangle,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  RefreshCw,
} from 'lucide-react';

type SortKey =
  | 'ticker'
  | 'shares'
  | 'divPerShare'
  | 'yieldPct'
  | 'projectedAnnual'
  | 'actualReceived'
  | 'payoutHealth'
  | 'growth5Y';

type SortDir = 'asc' | 'desc';

function healthTier(ratio: number | null): number {
  if (ratio === null) return 4;
  if (ratio < 60) return 0;
  if (ratio < 80) return 1;
  if (ratio <= 100) return 2;
  return 3;
}

function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

const fmtUSD = (n: number) =>
  `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`;

const FALLBACK_FREQ_MULTIPLIER: Record<string, number> = {
  monthly: 12,
  quarterly: 4,
  'semi-annual': 2,
  annual: 1,
  special: 1,
  other: 4,
};

interface Row {
  ticker: string;
  shares: number;
  divPerShare: number;
  yieldPct: number;
  projectedAnnual: number;
  actualReceived: number;
  payoutRatio: number | null;
  growth5Y: number | null;
}

export function DividendDashboard() {
  const { dividends, loading: divLoading, getSummary, fetchDividends } = useDividends();
  const { holdings, loading: portfolioLoading } = usePortfolioData();
  const { analytics, loading: analyticsLoading, lastUpdated } = useAnalyticsData(holdings);
  const [sortKey, setSortKey] = useState<SortKey>('payoutHealth');
  const [sortDir, setSortDir] = useState<SortDir>('asc'); // asc = healthy first
  const [syncing, setSyncing] = useState(false);
  const [allRows, setAllRows] = useState<Row[]>([]);
  const [rowsLoading, setRowsLoading] = useState(true);
  const finnhubLoading = portfolioLoading || analyticsLoading || divLoading;

  const handleRefreshDividends = async () => {
    setSyncing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await syncDividendsForUserWithToast(user.id);
        await fetchDividends();
      }
    } finally {
      setSyncing(false);
    }
  };

  const summary = useMemo(() => getSummary(), [getSummary]);

  // Bust dividend cache on mount so fallback always sees fresh data
  useEffect(() => {
    try {
      const keys = Object.keys(localStorage);
      for (const k of keys) {
        if (k.toLowerCase().includes('dividend')) {
          localStorage.removeItem(k);
        }
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!finnhubLoading && finnhubRows.length === 0 && holdings.length > 0) {
      // Finnhub returned nothing — skip waiting and run fallback for all
    } else if (finnhubLoading) {
      return;
    }

    if (finnhubTickers === null || fallbackStartedRef.current || fallbackHasRun.current) {
      return;
    }

    let cancelled = false;
    fallbackStartedRef.current = true;

    const fetchFallbackRows = async () => {
      if (holdings.length === 0) {
        setFallbackRows([]);
        fallbackHasRun.current = true;
        setFallbackLoading(false);
        return;
      }

      const missingHoldings = holdings.filter(
        (holding) => !finnhubTickers.includes(holding.ticker.toUpperCase()),
      );

      const {
        data: { user: _userForLog },
      } = await supabase.auth.getUser();
      console.log('[dividendDashboard] fallback check:', {
        finnhubTickers,
        finnhubRowsLength: finnhubRows.length,
        holdingsLength: holdings?.length,
        userId: _userForLog?.id,
      });

      if (missingHoldings.length === 0) {
        setFallbackRows([]);
        fallbackHasRun.current = true;
        setFallbackLoading(false);
        return;
      }

      setFallbackLoading(true);

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (!cancelled) {
            setFallbackRows([]);
            fallbackHasRun.current = true;
          }
          return;
        }

        const holdingById = new Map(missingHoldings.map((holding) => [holding.id, holding]));
        const fallbackHoldingIds = missingHoldings.map((holding) => holding.id);
        const { data, error } = await supabase
          .from('dividends')
          .select('ticker, amount_per_share, frequency, total_amount, ex_date, holding_id')
          .eq('user_id', user.id)
          .in('holding_id', fallbackHoldingIds)
          .order('holding_id', { ascending: true })
          .order('ex_date', { ascending: false });

        console.log('[dividendDashboard] fallback Run 2 query params:', {
          excludedTickers: finnhubTickers,
          holdingIdsQueried: fallbackHoldingIds,
          rawSupabaseResponse: data,
          error,
        });

        console.log('[dividendDashboard] fallback query:', {
          holdingIds: fallbackHoldingIds,
          queryFilter: 'holding_id in (...)',
          resultCount: data?.length,
          error,
        });

        console.log('[dividendDashboard] fallback query result:', {
          fallbackHoldingIds,
          fallbackDividendsCount: data?.length,
          fallbackError: error,
          fallbackTickers: data?.map((d) => d.ticker),
        });

        if (error) throw error;


        const now = new Date();
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - 12);
        const latestByHoldingId = new Map<
          string,
          { ticker: string; amount_per_share: number; frequency: string; ex_date: string }
        >();
        const actualByHoldingId = new Map<string, number>();

        for (const dividend of data || []) {
          if (!dividend.holding_id || !holdingById.has(dividend.holding_id)) continue;

          const latest = latestByHoldingId.get(dividend.holding_id);
          if (!latest || dividend.ex_date > latest.ex_date) {
            latestByHoldingId.set(dividend.holding_id, {
              ticker: dividend.ticker,
              amount_per_share: Number(dividend.amount_per_share),
              frequency: dividend.frequency || 'quarterly',
              ex_date: dividend.ex_date,
            });
          }

          const [year, month, day] = dividend.ex_date
            .split('-')
            .map((value) => parseInt(value, 10));
          const exDate = new Date(year, month - 1, day);
          if (exDate >= cutoff && exDate <= now) {
            actualByHoldingId.set(
              dividend.holding_id,
              (actualByHoldingId.get(dividend.holding_id) || 0) + Number(dividend.total_amount),
            );
          }
        }

        const builtFallbackRows = missingHoldings.flatMap((holding) => {
          const latest = latestByHoldingId.get(holding.id);
          if (!latest) return [];

          const frequencyMultiplier = FALLBACK_FREQ_MULTIPLIER[latest.frequency] ?? 4;
          const annualDivPerShare = latest.amount_per_share * frequencyMultiplier;

          return [
            {
              ticker: latest.ticker || holding.ticker,
              shares: holding.shares,
              divPerShare: latest.amount_per_share,
              yieldPct:
                holding.currentPrice > 0
                  ? (annualDivPerShare / holding.currentPrice) * 100
                  : 0,
              projectedAnnual: annualDivPerShare * holding.shares,
              actualReceived: actualByHoldingId.get(holding.id) || 0,
              payoutRatio: null,
              growth5Y: null,
            },
          ];
        });

        if (!cancelled) {
          console.log('[dividendDashboard] fallback rows built:', {
            fallbackRowCount: builtFallbackRows.length,
            tickers: builtFallbackRows.map((r) => r.ticker),
          });
          setFallbackRows(builtFallbackRows);
          fallbackHasRun.current = true;
        }

      } catch {
        if (!cancelled) {
          setFallbackRows([]);
          fallbackHasRun.current = true;
        }
      } finally {
        if (!cancelled) {
          setFallbackLoading(false);
        }
      }
    };

    fetchFallbackRows();

    return () => {
      cancelled = true;
    };
  }, [finnhubLoading, finnhubRows.length, finnhubTickers, holdings]);

  const unsortedRows = useMemo(
    () => [...finnhubRows, ...fallbackRows],
    [finnhubRows, fallbackRows],
  );

  const totalProjectedAnnual = useMemo(
    () => unsortedRows.reduce((sum, row) => sum + row.projectedAnnual, 0),
    [unsortedRows],
  );

  const rows = useMemo(() => {
    const arr = [...unsortedRows];
    const dirMul = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let primary = 0;
      switch (sortKey) {
        case 'ticker':
          primary = a.ticker.localeCompare(b.ticker) * dirMul;
          break;
        case 'shares':
          primary = (a.shares - b.shares) * dirMul;
          break;
        case 'divPerShare':
          primary = (a.divPerShare - b.divPerShare) * dirMul;
          break;
        case 'yieldPct':
          primary = (a.yieldPct - b.yieldPct) * dirMul;
          break;
        case 'projectedAnnual':
          primary = (a.projectedAnnual - b.projectedAnnual) * dirMul;
          break;
        case 'actualReceived':
          primary = (a.actualReceived - b.actualReceived) * dirMul;
          break;
        case 'growth5Y': {
          const ag = a.growth5Y;
          const bg = b.growth5Y;
          if (ag === null && bg === null) primary = 0;
          else if (ag === null) primary = 1; // nulls last
          else if (bg === null) primary = -1;
          else primary = (ag - bg) * dirMul;
          break;
        }
        case 'payoutHealth':
        default: {
          // Sort by numeric payout ratio; nulls always last
          const ar = a.payoutRatio;
          const br = b.payoutRatio;
          if (ar === null && br === null) primary = 0;
          else if (ar === null) primary = 1;
          else if (br === null) primary = -1;
          else primary = (ar - br) * dirMul;
          break;
        }
      }
      if (primary !== 0) return primary;
      // Tiebreaker: projected annual desc
      return b.projectedAnnual - a.projectedAnnual;
    });
    return arr;
  }, [unsortedRows, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // Default direction per column: payoutHealth=asc (healthy first), others=desc
      setSortDir(key === 'ticker' || key === 'payoutHealth' ? 'asc' : 'desc');
    }
  };


  const loading = finnhubLoading || fallbackLoading;

  if (loading) {
    return (
      <div className="text-center py-10 text-sm text-muted-foreground">
        Loading dividend data...
      </div>
    );
  }

  const actualLast12M = summary.totalYTD;
  const actualAllTime = summary.totalAllTime;
  const projectedMonthly = totalProjectedAnnual / 12;
  const difference = actualLast12M - totalProjectedAnnual;
  const diffColor = difference >= 0 ? 'text-emerald-500' : 'text-red-500';

  // Health stats
  const healthyCount = rows.filter(
    (r) => r.payoutRatio !== null && r.payoutRatio < 60,
  ).length;
  const totalWithRatio = rows.filter((r) => r.payoutRatio !== null).length;
  const concerning = rows.filter(
    (r) => r.payoutRatio !== null && r.payoutRatio >= 60,
  );
  const concerningCount = concerning.length;

  const maxMonth = Math.max(
    ...summary.monthlyBreakdown.map((m) => m.total),
    1,
  );

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      year: '2-digit',
    });
  };

  const noData = rows.length === 0 && dividends.length === 0;
  if (noData) {
    return (
      <div className="text-center py-12 rounded-2xl border border-dashed border-border">
        <PiggyBank className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-base font-medium text-foreground">
          No dividend data yet
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Add dividend-paying holdings or log a dividend to see analytics
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefreshDividends}
          disabled={syncing}
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing…' : 'Refresh Dividends'}
        </Button>
      </div>
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPICard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Projected Annual"
          value={fmtUSD(totalProjectedAnnual)}
          color="text-emerald-500"
        />
        <KPICard
          icon={<Calendar className="h-4 w-4" />}
          label="Projected Monthly"
          value={fmtUSD(projectedMonthly)}
          color="text-emerald-500"
        />
        <KPICard
          icon={<DollarSign className="h-4 w-4" />}
          label="Actual Last 12 Months"
          value={fmtUSD(actualLast12M)}
          color="text-emerald-500"
        />
        <KPICard
          icon={<PiggyBank className="h-4 w-4" />}
          label="Actual All-Time"
          value={fmtUSD(actualAllTime)}
          color="text-emerald-500"
        />
        <KPICard
          icon={<ArrowUpDown className="h-4 w-4" />}
          label="Difference"
          value={fmtUSD(difference)}
          color={diffColor}
        />
      </div>

      {/* Holdings Dividend Breakdown */}
      {rows.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">
            Holdings Dividend Breakdown
          </h3>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <SortableTh sortKey="ticker" current={sortKey} dir={sortDir} onSort={handleSort} align="left" className="pr-3">Ticker</SortableTh>
                  <SortableTh sortKey="shares" current={sortKey} dir={sortDir} onSort={handleSort} align="right" className="px-3">Shares</SortableTh>
                  <SortableTh sortKey="divPerShare" current={sortKey} dir={sortDir} onSort={handleSort} align="right" className="px-3">Div/Share</SortableTh>
                  <SortableTh sortKey="yieldPct" current={sortKey} dir={sortDir} onSort={handleSort} align="right" className="px-3">Yield</SortableTh>
                  <SortableTh sortKey="projectedAnnual" current={sortKey} dir={sortDir} onSort={handleSort} align="right" className="px-3">Projected Annual</SortableTh>
                  <SortableTh sortKey="actualReceived" current={sortKey} dir={sortDir} onSort={handleSort} align="right" className="px-3">Actual (12M)</SortableTh>
                  <SortableTh sortKey="payoutHealth" current={sortKey} dir={sortDir} onSort={handleSort} align="center" className="px-3">Payout Health</SortableTh>
                  <SortableTh sortKey="growth5Y" current={sortKey} dir={sortDir} onSort={handleSort} align="right" className="pl-3">5Y Growth</SortableTh>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.ticker}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="py-2 pr-3 font-semibold text-foreground">
                      {r.ticker}
                    </td>
                    <td className="py-2 px-3 text-right text-foreground">
                      {r.shares}
                    </td>
                    <td className="py-2 px-3 text-right text-foreground">
                      {r.divPerShare > 0 ? `$${r.divPerShare.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-2 px-3 text-right text-foreground">
                      {r.yieldPct > 0 ? `${r.yieldPct.toFixed(2)}%` : '—'}
                    </td>
                    <td className="py-2 px-3 text-right text-emerald-500 font-medium">
                      {fmtUSD(r.projectedAnnual)}
                    </td>
                    <td className="py-2 px-3 text-right text-foreground">
                      {fmtUSD(r.actualReceived)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <PayoutBadge ratio={r.payoutRatio} />
                    </td>
                    <td className="py-2 pl-3 text-right">
                      <GrowthCell growth={r.growth5Y} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {rows.map((r) => (
              <div
                key={r.ticker}
                className="rounded-xl border border-border p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-foreground">
                    {r.ticker}
                  </span>
                  <PayoutBadge ratio={r.payoutRatio} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Field label="Shares" value={String(r.shares)} />
                  <Field
                    label="Yield"
                    value={r.yieldPct > 0 ? `${r.yieldPct.toFixed(2)}%` : '—'}
                  />
                  <Field
                    label="Div/Share"
                    value={
                      r.divPerShare > 0 ? `$${r.divPerShare.toFixed(2)}` : '—'
                    }
                  />
                  <Field
                    label="5Y Growth"
                    valueNode={<GrowthCell growth={r.growth5Y} />}
                  />
                  <Field
                    label="Projected Annual"
                    value={fmtUSD(r.projectedAnnual)}
                    valueClassName="text-emerald-500 font-medium"
                  />
                  <Field
                    label="Actual (12M)"
                    value={fmtUSD(r.actualReceived)}
                  />
                </div>
              </div>
            ))}
          </div>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground mt-3">
              Last updated: {formatRelativeTime(lastUpdated)}
            </p>
          )}
        </section>
      )}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">
          Monthly Dividend Income (Last 12 Months)
        </h3>
        {summary.monthlyBreakdown.length > 0 ? (
          <div className="space-y-2">
            {summary.monthlyBreakdown.map((month) => {
              const percentage = (month.total / maxMonth) * 100;
              return (
                <div
                  key={month.month}
                  className="grid grid-cols-[64px_1fr] items-center gap-3"
                >
                  <span className="text-xs text-muted-foreground">
                    {formatMonth(month.month)}
                  </span>
                  <div className="relative h-6 rounded-full bg-muted/50 overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary/70 to-primary flex items-center justify-end pr-2"
                      style={{ width: `${Math.max(percentage, 8)}%` }}
                    >
                      <span className="text-[10px] font-medium text-primary-foreground">
                        ${month.total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No logged dividend payments yet
          </p>
        )}
      </section>

      {/* Health Summary */}
      {rows.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">
            Dividend Health Summary
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>
                {healthyCount} of {totalWithRatio} dividend positions rated
                Healthy
              </span>
            </div>
            <div className="flex items-center gap-2 text-foreground">
              <AlertTriangle
                className={`h-4 w-4 ${
                  concerningCount > 0 ? 'text-red-500' : 'text-muted-foreground'
                }`}
              />
              <span>
                {concerningCount} position{concerningCount === 1 ? '' : 's'}{' '}
                with concerning payout ratios
              </span>
            </div>
            {concerning.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {concerning.map((r) => (
                  <li
                    key={r.ticker}
                    className="flex items-start gap-2 text-xs text-red-500"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>
                      <span className="font-semibold">{r.ticker}</span> — payout
                      ratio {r.payoutRatio!.toFixed(0)}% — dividend may be at
                      risk
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  valueNode,
  valueClassName,
}: {
  label: string;
  value?: string;
  valueNode?: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-muted-foreground">{label}</span>
      {valueNode ? (
        valueNode
      ) : (
        <span className={valueClassName ?? 'text-foreground'}>{value}</span>
      )}
    </div>
  );
}

function PayoutBadge({ ratio }: { ratio: number | null }) {
  if (ratio === null) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        N/A
      </Badge>
    );
  }
  if (ratio < 60) {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-500 border-transparent hover:bg-emerald-500/20">
        Healthy {ratio.toFixed(0)}%
      </Badge>
    );
  }
  if (ratio < 80) {
    return (
      <Badge className="bg-yellow-500/15 text-yellow-500 border-transparent hover:bg-yellow-500/20">
        Moderate {ratio.toFixed(0)}%
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-500/15 text-red-500 border-transparent hover:bg-red-500/20">
      At Risk {ratio.toFixed(0)}%
    </Badge>
  );
}

function GrowthCell({ growth }: { growth: number | null }) {
  if (growth === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  const color =
    growth > 0
      ? 'text-emerald-500'
      : growth < 0
        ? 'text-red-500'
        : 'text-muted-foreground';
  return <span className={color}>{growth.toFixed(2)}%</span>;
}

function KPICard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className={`flex items-center gap-2 text-xs ${color}`}>
        {icon}
        <span className="text-muted-foreground">{label}</span>
      </div>
      <p className={`mt-2 text-lg font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function SortableTh({
  sortKey,
  current,
  dir,
  onSort,
  align,
  className,
  children,
}: {
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  align: 'left' | 'right' | 'center';
  className?: string;
  children: React.ReactNode;
}) {
  const active = current === sortKey;
  const alignClass =
    align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center';
  const flexJustify =
    align === 'left'
      ? 'justify-start'
      : align === 'right'
        ? 'justify-end'
        : 'justify-center';
  return (
    <th className={`${alignClass} py-2 ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 ${flexJustify} w-full hover:text-foreground transition-colors ${
          active ? 'text-foreground' : ''
        }`}
      >
        <span>{children}</span>
        {active ? (
          dir === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
  );
}
