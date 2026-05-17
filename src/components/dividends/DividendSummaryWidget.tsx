import { useMemo } from 'react';
import { useDividends } from '@/hooks/useDividends';
import { DollarSign, TrendingUp, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export function DividendSummaryWidget() {
  const { dividends, loading, getSummary } = useDividends();
  const summary = useMemo(() => getSummary(), [getSummary]);
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 animate-pulse">
        <div className="h-5 w-40 bg-muted rounded mb-4" />
        <div className="h-24 bg-muted/50 rounded" />
      </div>
    );
  }

  if (dividends.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            Dividend Income
          </h3>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate('/income')}
            className="text-xs"
          >
            View All <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          No dividends logged yet. Open a holding to log your first dividend.
        </p>
      </div>
    );
  }

  const recentMonths = summary.monthlyBreakdown.slice(-3);
  const maxRecent = Math.max(...recentMonths.map((m) => m.total), 1);

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'short' });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" />
          Dividend Income
        </h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => navigate('/income')}
          className="text-xs"
        >
          View All <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-muted/50 p-3">
          <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
            <DollarSign className="h-3 w-3" />
            YTD Income
          </div>
          <div className="text-lg font-bold text-primary">
            ${summary.totalYTD.toFixed(2)}
          </div>
        </div>
        <div className="rounded-xl bg-muted/50 p-3">
          <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
            <TrendingUp className="h-3 w-3" />
            Projected Annual
          </div>
          <div className="text-lg font-bold text-foreground">
            ${summary.projectedAnnual.toFixed(2)}
          </div>
        </div>
      </div>

      {recentMonths.length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-2">Last 3 Months</div>
          <div className="space-y-2">
            {recentMonths.map((month) => {
              const pct = (month.total / maxRecent) * 100;
              return (
                <div key={month.month} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-10">
                    {formatMonth(month.month)}
                  </span>
                  <div className="flex-1 h-6 bg-muted/40 rounded-md overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary/70 to-primary flex items-center justify-end pr-2 text-xs font-medium text-primary-foreground"
                      style={{ width: `${Math.max(pct, 8)}%` }}
                    >
                      ${month.total.toFixed(0)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {summary.byHolding.length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-2">Top Payers</div>
          <div className="space-y-1.5">
            {summary.byHolding.slice(0, 3).map((h) => (
              <div
                key={h.ticker}
                className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2"
              >
                <span className="text-sm font-medium text-foreground">{h.ticker}</span>
                <span className="text-sm font-semibold text-primary">
                  ${h.total.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
