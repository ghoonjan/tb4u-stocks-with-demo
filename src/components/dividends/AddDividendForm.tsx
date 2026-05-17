import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useDividends, DividendInput } from '@/hooks/useDividends';
import { toast } from 'sonner';

interface AddDividendFormProps {
  holdingId: string;
  ticker: string;
  currentShares: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function AddDividendForm({
  holdingId,
  ticker,
  currentShares,
  onSuccess,
  onCancel,
}: AddDividendFormProps) {
  const { addDividend } = useDividends(holdingId);

  const [amountPerShare, setAmountPerShare] = useState('');
  const [sharesAtTime, setSharesAtTime] = useState(currentShares.toString());
  const [exDate, setExDate] = useState('');
  const [payDate, setPayDate] = useState('');
  const [frequency, setFrequency] = useState('quarterly');
  const [isReinvested, setIsReinvested] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const totalAmount =
    (parseFloat(amountPerShare) || 0) * (parseFloat(sharesAtTime) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amountPerShare || !exDate) {
      toast.error('Amount per share and ex-date are required');
      return;
    }

    setSubmitting(true);
    const input: DividendInput = {
      holding_id: holdingId,
      ticker,
      amount_per_share: parseFloat(amountPerShare),
      shares_at_time: parseFloat(sharesAtTime),
      ex_date: exDate,
      pay_date: payDate || null,
      frequency,
      is_reinvested: isReinvested,
      notes: notes || null,
    };

    const result = await addDividend(input);
    setSubmitting(false);

    if (result) {
      toast.success(
        `Dividend logged: $${totalAmount.toFixed(2)} from ${ticker}`,
      );
      setAmountPerShare('');
      setPayDate('');
      setExDate('');
      setNotes('');
      onSuccess?.();
    } else {
      toast.error('Failed to log dividend');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          Log Dividend — {ticker}
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="amount-per-share">Amount Per Share ($)</Label>
          <Input
            id="amount-per-share"
            type="number"
            step="0.0001"
            min="0"
            value={amountPerShare}
            onChange={(e) => setAmountPerShare(e.target.value)}
            placeholder="0.00"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="shares-at-time">Shares Held</Label>
          <Input
            id="shares-at-time"
            type="number"
            step="0.0001"
            min="0"
            value={sharesAtTime}
            onChange={(e) => setSharesAtTime(e.target.value)}
            required
          />
        </div>
      </div>

      {totalAmount > 0 && (
        <div className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-3">
          <span className="text-sm text-muted-foreground">Total Dividend</span>
          <span className="text-xl font-semibold text-primary">
            ${totalAmount.toFixed(2)}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ex-date">Ex-Date</Label>
          <Input
            id="ex-date"
            type="date"
            value={exDate}
            onChange={(e) => setExDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pay-date">Pay Date</Label>
          <Input
            id="pay-date"
            type="date"
            value={payDate}
            onChange={(e) => setPayDate(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="frequency">Frequency</Label>
        <Select value={frequency} onValueChange={setFrequency}>
          <SelectTrigger id="frequency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="quarterly">Quarterly</SelectItem>
            <SelectItem value="semi-annual">Semi-Annual</SelectItem>
            <SelectItem value="annual">Annual</SelectItem>
            <SelectItem value="special">Special</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-border px-4 py-3">
        <Label htmlFor="drip" className="cursor-pointer">
          Reinvested (DRIP)
        </Label>
        <Switch
          id="drip"
          checked={isReinvested}
          onCheckedChange={setIsReinvested}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Any context about this payment..."
        />
      </div>

      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Logging...' : 'Log Dividend'}
        </Button>
      </div>
    </form>
  );
}
