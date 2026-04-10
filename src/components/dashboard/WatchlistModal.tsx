import { useState, useCallback, useRef, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { getCompanyProfile } from "@/services/marketData";

interface WatchlistModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { ticker: string; company_name?: string; target_price?: number; notes?: string }) => Promise<boolean | undefined>;
  maxReached?: boolean;
}

export function WatchlistModal({ open, onClose, onSubmit, maxReached }: WatchlistModalProps) {
  const [ticker, setTicker] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [tickerError, setTickerError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

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

  const handleTickerChange = useCallback((value: string) => {
    setTicker(value.toUpperCase());
    setTickerError(null);
    clearTimeout(debounceRef.current);
    if (value.length >= 1) {
      debounceRef.current = setTimeout(() => lookupTicker(value), 300);
    }
  }, [lookupTicker]);

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const ok = await onSubmit({
      ticker,
      company_name: companyName || undefined,
      target_price: targetPrice ? parseFloat(targetPrice) : undefined,
      notes: notes || undefined,
    });
    setSaving(false);
    if (ok) {
      setTicker(""); setCompanyName(""); setTargetPrice(""); setNotes(""); setLogo(null);
      onClose();
    }
  };

  const inputClass = "w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Add to Watchlist">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-foreground">Add to Watchlist</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close"><X size={18} /></button>
        </div>
        {maxReached ? (
          <p className="text-sm text-muted-foreground text-center py-4">Watchlist is full (30/30). Remove items to add more.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Ticker Symbol</label>
              <div className="relative">
                {logo && <img src={logo} alt={`${ticker} logo`} className="absolute left-2.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded-sm object-contain" />}
                <input
                  value={ticker}
                  onChange={(e) => handleTickerChange(e.target.value)}
                  className={`${inputClass} ${logo ? "pl-9" : ""} ${tickerError ? "border-destructive" : ""}`}
                  placeholder="GOOGL"
                  required
                  aria-invalid={!!tickerError}
                />
                {lookingUp && <Loader2 size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
              </div>
              {tickerError && <p className="mt-1 text-[11px] text-destructive">{tickerError}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Company Name <span className="text-muted-foreground/60">(auto-filled)</span></label>
              <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputClass} placeholder="Alphabet Inc." />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Target Price <span className="text-muted-foreground/60">(optional)</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <input type="number" step="any" value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} className={`${inputClass} pl-7`} placeholder="150.00" min="0.01" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes <span className="text-muted-foreground/60">(optional)</span></label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputClass} resize-none h-14`} placeholder="Why are you watching this?" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving} className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{saving ? "Adding..." : "Add to Watchlist"}</button>
              <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">Cancel</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
