import { useState } from 'react';
import { AddDividendForm } from '@/components/dividends/AddDividendForm';
import { DividendHistory } from '@/components/dividends/DividendHistory';
import { ChevronDown, ChevronUp, DollarSign, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DividendSectionProps {
  holdingId: string;
  ticker: string;
  currentShares: number;
}

export function DividendSection({ holdingId, ticker, currentShares }: DividendSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="rounded-2xl border border-border bg-card/50 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">
            Dividend Income — {ticker}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4 pt-0 space-y-4 border-t border-border">
          {!showForm ? (
            <div className="pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowForm(true)}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Log Dividend
              </Button>
            </div>
          ) : (
            <div className="pt-4">
              <AddDividendForm
                holdingId={holdingId}
                ticker={ticker}
                currentShares={currentShares}
                onSuccess={() => setShowForm(false)}
                onCancel={() => setShowForm(false)}
              />
            </div>
          )}

          <DividendHistory holdingId={holdingId} ticker={ticker} />
        </div>
      )}
    </div>
  );
}
