import { useState, useCallback, useRef, useEffect } from "react";
import { Star, X, Loader2 } from "lucide-react";
import type { HoldingDisplay } from "@/hooks/usePortfolioData";
import { getCompanyProfile } from "@/services/marketData";
import { toast } from "sonner";

interface HoldingModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    ticker: string;
    company_name: string;
    shares: number;
    avg_cost_basis: number;
    conviction_rating: number;
    thesis?: string;
    target_allocation_pct?: number;
    date_added: string;
  }) => Promise<boolean | undefined>;
  initial?: HoldingDisplay | null;
  existingTickers?: string[];
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export function HoldingModal({ open, onClose, onSubmit, initial }: HoldingModalProps) {
  const [ticker, setTicker] = useState(initial?.ticker ?? "");
  const [companyName, setCompanyName] = useState(initial?.companyName ?? "");
  const [shares, setShares] = useState(initial?.shares?.toString() ?? "");
  const [avgCost, setAvgCost] = useState(initial?.avgCostBasis?.toString() ?? "");
  const [conviction, setConviction] = useState(initial?.convictionRating ?? 3);
  const [thesis, setThesis] = useState(initial?.thesis ?? "");
  const [targetPct, setTargetPct] = useState(initial?.targetAllocationPct?.toString() ?? "");
  const [purchaseDate, setPurchaseDate] = useState(initial?.purchaseDate || todayISO());
  const [saving, setSaving] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [tickerError, setTickerError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const today = todayISO();

  const lookupTicker = useCallback(async (symbol: string) => {
    if (!symbol || symbol.length < 1) return;
    setLookingUp(true);
    setTickerError(null);
    try {
      const profile = await getCompanyProfile(symbol.toUpperCase());
      if (profile) {
        if (!companyName) setCompanyName(profile.name);
        setLogo(profile.logo || null);
      } else {
        setTickerError("Ticker not found");
      }
    } catch {
      setTickerError("Could not look up ticker");
    } finally {
      setLookingUp(false);
    }
  }, [companyName]);

  // Debounced ticker lookup (300ms)
  const handleTickerChange = useCallback((value: string) => {
    setTicker(value.toUpperCase());
    setTickerError(null);
    clearTimeout(debounceRef.current);
    if (value.length >= 1) {
      debounceRef.current = setTimeout(() => lookupTicker(value), 300);
    }
  }, [lookupTicker]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setTicker(initial?.ticker ?? "");
      setCompanyName(initial?.companyName ?? "");
      setShares(initial?.shares?.toString() ?? "");
      setAvgCost(initial?.avgCostBasis?.toString() ?? "");
      setConviction(initial?.convictionRating ?? 3);
      setThesis(initial?.thesis ?? "");
      setTargetPct(initial?.targetAllocationPct?.toString() ?? "");
      setPurchaseDate(initial?.purchaseDate || todayISO());
      setLogo(null);
      setTickerError(null);
      setSaving(false);
    }
    return () => clearTimeout(debounceRef.current);
  }, [open, initial]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (purchaseDate > today) {
      toast.error("Purchase date cannot be in the future");
      return;
    }
    setSaving(true);
    const ok = await onSubmit({
      ticker,
      company_name: companyName,
      shares: parseFloat(shares),
      avg_cost_basis: parseFloat(avgCost),
      conviction_rating: conviction,
      thesis: thesis || undefined,
      target_allocation_pct: targetPct ? parseFloat(targetPct) : undefined,
      date_added: purchaseDate,
    });
    setSaving(false);
    if (ok) {
      toast.success(initial ? `${ticker} updated` : `${ticker} added to portfolio`);
      onClose();
    } else {
      toast.error(`Failed to ${initial ? "update" : "add"} ${ticker}`);
    }
  };

  const inputClass = "w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label={initial ? "Edit Holding" : "Add Holding"}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-foreground">
            {initial ? "Edit Holding" : "Add Holding"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Close"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Ticker Symbol</label>
              <div className="relative">
                {logo && <img src={logo} alt={`${ticker} logo`} className="absolute left-2.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded-sm object-contain" />}
                <input
                  value={ticker}
                  onChange={(e) => handleTickerChange(e.target.value)}
                  className={`${inputClass} ${logo ? "pl-9" : ""} ${tickerError ? "border-destructive" : ""}`}
                  placeholder="AAPL"
                  required
                  aria-invalid={!!tickerError}
                  aria-describedby={tickerError ? "ticker-error" : undefined}
                />
                {lookingUp && <Loader2 size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
              </div>
              {tickerError && <p id="ticker-error" className="mt-1 text-[11px] text-destructive">{tickerError}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Company Name</label>
              <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputClass} placeholder="Apple Inc." required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Shares</label>
              <input
                type="number" step="any" value={shares}
                onChange={(e) => setShares(e.target.value)}
                className={`${inputClass} ${initial ? "opacity-60 cursor-not-allowed" : ""}`}
                placeholder="100" required={!initial} min="0.0001"
                readOnly={!!initial} disabled={!!initial}
              />
              {initial && <p className="mt-1 text-[11px] text-muted-foreground">Calculated from lots</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Avg Cost / Share</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <input
                  type="number" step="any" value={avgCost}
                  onChange={(e) => setAvgCost(e.target.value)}
                  className={`${inputClass} pl-7 ${initial ? "opacity-60 cursor-not-allowed" : ""}`}
                  placeholder="150.00" required={!initial} min="0.01"
                  readOnly={!!initial} disabled={!!initial}
                />
              </div>
              {initial && <p className="mt-1 text-[11px] text-muted-foreground">Calculated from lots</p>}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Purchase Date</label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              max={today}
              required={!initial}
              readOnly={!!initial}
              disabled={!!initial}
              className={`${inputClass} ${initial ? "opacity-60 cursor-not-allowed" : ""}`}
            />
            {initial && <p className="mt-1 text-[11px] text-muted-foreground">Earliest lot date — edit lots to change</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Conviction Rating</label>
            <div className="flex gap-1" role="group" aria-label="Conviction rating">
              {[1, 2, 3, 4, 5].map((i) => (
                <button key={i} type="button" onClick={() => setConviction(i)} className="transition-transform hover:scale-110" aria-label={`${i} star${i !== 1 ? "s" : ""}`}>
                  <Star size={20} className={i <= conviction ? "fill-primary text-primary" : "text-muted-foreground/30 hover:text-muted-foreground/60"} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Investment Thesis <span className="text-muted-foreground/60">(optional)</span></label>
            <textarea value={thesis} onChange={(e) => setThesis(e.target.value)} className={`${inputClass} resize-none h-16`} placeholder="Why did you buy this? What's your edge?" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Target Allocation % <span className="text-muted-foreground/60">(optional)</span></label>
            <input type="number" step="any" value={targetPct} onChange={(e) => setTargetPct(e.target.value)} className={inputClass} placeholder="What % of your portfolio should this be?" min="0" max="100" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
              {saving ? "Saving..." : initial ? "Save Changes" : "Add to Portfolio"}
            </button>
            <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
