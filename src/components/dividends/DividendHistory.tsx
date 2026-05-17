import { useState } from 'react';
import { useDividends } from '@/hooks/useDividends';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, DollarSign, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface DividendHistoryProps {
  holdingId: string;
  ticker: string;
}

export function DividendHistory({ holdingId, ticker }: DividendHistoryProps) {
  const { dividends, loading, deleteDividend } = useDividends(holdingId);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const success = await deleteDividend(id);
    if (success) {
      toast.success('Dividend entry removed');
    } else {
      toast.error('Failed to delete dividend');
    }
    setDeletingId(null);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const totalIncome = dividends.reduce(
    (sum, d) => sum + Number(d.total_amount),
    0,
  );

  if (loading) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        Loading dividend history...
      </div>
    );
  }

  if (dividends.length === 0) {
    return (
      <div className="text-center py-10 rounded-2xl border border-dashed border-border">
        <DollarSign className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm font-medium text-foreground">
          No dividends logged for {ticker} yet
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Use the form above to log your first dividend
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-3">
        <div>
          <p className="text-xs text-muted-foreground">
            Total Income from {ticker}
          </p>
          <p className="text-xl font-semibold text-primary">
            ${totalIncome.toFixed(2)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Payments</p>
          <p className="text-lg font-semibold text-foreground">
            {dividends.length}
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {dividends.map((dividend) => (
          <li
            key={dividend.id}
            className="flex items-start justify-between gap-3 rounded-2xl border border-border p-3"
          >
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-foreground">
                  ${Number(dividend.total_amount).toFixed(2)}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({Number(dividend.amount_per_share).toFixed(4)} ×{' '}
                  {Number(dividend.shares_at_time).toFixed(4)} shares)
                </span>
                {dividend.is_reinvested && (
                  <Badge variant="secondary" className="gap-1">
                    <RefreshCw className="h-3 w-3" />
                    DRIP
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Ex: {formatDate(dividend.ex_date)}
                {dividend.pay_date && ` · Paid: ${formatDate(dividend.pay_date)}`}
                {' · '}
                {dividend.frequency}
              </p>
              {dividend.notes && (
                <p className="text-xs text-muted-foreground italic">
                  {dividend.notes}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(dividend.id)}
              disabled={deletingId === dividend.id}
              aria-label="Delete dividend"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
