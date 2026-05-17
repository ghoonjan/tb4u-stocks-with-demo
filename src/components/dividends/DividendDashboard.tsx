import { useMemo } from 'react';
import { useDividends } from '@/hooks/useDividends';
import { DollarSign, TrendingUp, Calendar, PiggyBank } from 'lucide-react';

export function DividendDashboard() {
  const { dividends, loading, getSummary } = useDividends();
  const summary = useMemo(() => getSummary(), [getSummary]);

  if (loading) {
    return (
      <div className="text-center py-10 text-sm text-muted-foreground">
        Loading dividend data...
      </div>
    );
  }

  if (dividends.length === 0) {
    return (
      <div className="text-center py-12 rounded-2xl border border-dashed border-border">
        <PiggyBank className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-base font-medium text-foreground">
          No dividends logged yet
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Open any holding and log your first dividend to see income analytics
        </p>
      </div>
    );
  }

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

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          icon={<DollarSign className="h-4 w-4" />}
          label="YTD Income"
          value={`$${summary.totalYTD.toFixed(2)}`}
          color="text-emerald-500"
        />
        <KPICard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Projected Annual"
          value={`$${summary.projectedAnnual.toFixed(2)}`}
          color="text-blue-500"
        />
        <KPICard
          icon={<Calendar className="h-4 w-4" />}
          label="Avg Monthly"
          value={`$${summary.averageMonthly.toFixed(2)}`}
          color="text-purple-500"
        />
        <KPICard
          icon={<PiggyBank className="h-4 w-4" />}
          label="All-Time Income"
          value={`$${summary.totalAllTime.toFixed(2)}`}
          color="text-amber-500"
        />
      </div>

      {/* Monthly Income Chart */}
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
          <p className="text-sm text-muted-foreground">No monthly data yet</p>
        )}
      </section>

      {/* Top Holdings by Income */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">
          Income by Holding
        </h3>
        <div className="space-y-2">
          {summary.byHolding.slice(0, 10).map((holding, index) => {
            const percentage =
              summary.totalAllTime > 0
                ? (holding.total / summary.totalAllTime) * 100
                : 0;
            return (
              <div
                key={holding.ticker}
                className="grid grid-cols-[60px_1fr_80px] items-center gap-3"
              >
                <span className="text-xs font-semibold text-foreground">
                  {holding.ticker}
                </span>
                <div className="relative h-6 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full flex items-center justify-end pr-2"
                    style={{
                      width: `${Math.max(percentage, 8)}%`,
                      backgroundColor: getBarColor(index),
                    }}
                  >
                    <span className="text-[10px] font-medium text-white">
                      ${holding.total.toFixed(2)}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground text-right">
                  {holding.count} payment{holding.count !== 1 ? 's' : ''}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
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
      <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function getBarColor(index: number): string {
  const colors = [
    '#22c55e',
    '#3b82f6',
    '#a855f7',
    '#f59e0b',
    '#ef4444',
    '#06b6d4',
    '#ec4899',
    '#14b8a6',
    '#f97316',
    '#8b5cf6',
  ];
  return colors[index % colors.length];
}
