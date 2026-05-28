import { useCallback, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileDown, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  TEMPLATE_CSV,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  parseCsv,
  validateAndNormalizeRows,
  groupByTicker,
  executeImport,
  downloadCsv,
  type ParsedRow,
  type DuplicateResolution,
} from "@/lib/portfolioCsv";
import { syncDividendsForUser } from "@/lib/dividendSync";
import { supabase } from "@/integrations/supabase/client";
import { getCompanyProfile, getBasicFinancials } from "@/services/marketData";

interface Props {
  open: boolean;
  onClose: () => void;
  portfolioId: string | null;
  existingHoldings: { id: string; ticker: string; shares: number; avg_cost_basis: number }[];
  onImported: () => void;
}

export function ImportPortfolioModal({ open, onClose, portfolioId, existingHoldings, onImported }: Props) {
  const [parsedRows, setParsedRows] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resolutions, setResolutions] = useState<Record<string, DuplicateResolution>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setParsedRows(null);
    setFileName("");
    setResolutions({});
    setImporting(false);
  }, []);

  const handleClose = useCallback(() => {
    if (importing) return;
    reset();
    onClose();
  }, [importing, onClose, reset]);

  const handleFile = useCallback(async (file: File) => {
    if (file.size > MAX_IMPORT_BYTES) {
      toast.error("File too large", { description: "Maximum file size is 5 MB." });
      return;
    }
    const text = await file.text();
    const raw = parseCsv(text);
    if (raw.length <= 1) {
      toast.error("Empty CSV", { description: "No data rows found." });
      return;
    }
    if (raw.length - 1 > MAX_IMPORT_ROWS) {
      toast.error("Too many rows", { description: `Maximum ${MAX_IMPORT_ROWS} rows per import.` });
      return;
    }
    const validated = validateAndNormalizeRows(raw);
    setParsedRows(validated);
    setFileName(file.name);
  }, []);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const summary = useMemo(() => {
    if (!parsedRows) return null;
    const errors = parsedRows.filter((r) => r.errors.length > 0).length;
    const validRows = parsedRows.filter((r) => r.errors.length === 0);
    const tickers = new Set(validRows.map((r) => r.ticker));
    return { errors, lots: validRows.length, positions: tickers.size, total: parsedRows.length };
  }, [parsedRows]);

  const groups = useMemo(() => (parsedRows ? groupByTicker(parsedRows) : []), [parsedRows]);

  const duplicates = useMemo(() => {
    const existingSet = new Set(existingHoldings.map((h) => h.ticker.toUpperCase()));
    return groups.filter((g) => existingSet.has(g.ticker));
  }, [groups, existingHoldings]);

  const handleImport = async () => {
    if (!portfolioId || !parsedRows || !summary) return;
    if (summary.errors > 0) return;

    setImporting(true);
    const res = await executeImport({
      portfolioId,
      groups,
      existingHoldings,
      resolutions,
    });
    setImporting(false);

    if (!res.ok) {
      toast.error("Import failed", { description: res.error });
      return;
    }
    const { inserted_holdings, inserted_lots, skipped_tickers } = res.progress;
    const lotLabel = inserted_lots === 1 ? "tax lot" : "tax lots";
    toast.success(`Imported ${inserted_holdings} positions with ${inserted_lots} ${lotLabel}`, {
      description: skipped_tickers.length > 0 ? `Skipped: ${skipped_tickers.join(", ")}` : undefined,
    });

    // Post-import enrichment: seed dividend history for new tickers and warm
    // the sector/yield cache so the donut chart and Income page populate
    // immediately — mirroring what the template-clone path provides.
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const newTickers = Array.from(
          new Set(groups.filter((g) => resolutions[g.ticker] !== "skip").map((g) => g.ticker)),
        );
        // Warm sector/financials cache (also populates stock_lookup via background enrich)
        await Promise.allSettled(
          newTickers.flatMap((t) => [getCompanyProfile(t), getBasicFinancials(t)]),
        );
        // Invalidate the localStorage analytics cache so the next render refetches
        try { localStorage.removeItem("dividend_analytics_cache"); } catch { /* ignore */ }
        // Seed dividend history rows for all current holdings (idempotent)
        await syncDividendsForUser(user.id);
      }
    } catch (err) {
      console.warn("[ImportPortfolioModal] post-import enrichment failed", err);
    }

    onImported();
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Portfolio</DialogTitle>
          <DialogDescription>
            Upload a CSV file matching our template format. Need to import from Fidelity, Schwab, or
            another brokerage? More formats coming soon!
          </DialogDescription>
        </DialogHeader>

        {!parsedRows && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => downloadCsv("portfolio_template.csv", TEMPLATE_CSV)}
              className="inline-flex items-center gap-2 text-xs text-primary hover:underline"
            >
              <FileDown size={14} /> Download Template CSV
            </button>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors ${
                dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
            >
              <Upload className="text-muted-foreground" />
              <p className="text-sm text-foreground">Drag &amp; drop your CSV here</p>
              <p className="text-xs text-muted-foreground">or click to browse · max 5MB · {MAX_IMPORT_ROWS} rows</p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={onInputChange}
              />
            </div>
          </div>
        )}

        {parsedRows && summary && (
          <div className="flex-1 overflow-hidden flex flex-col gap-3 min-h-0">
            <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-start gap-2 text-sm">
                {summary.errors === 0 ? (
                  <CheckCircle2 size={18} className="text-gain mt-0.5" />
                ) : (
                  <AlertCircle size={18} className="text-loss mt-0.5" />
                )}
                <div>
                  <p className="font-medium text-foreground">
                    Found {summary.positions} positions with {summary.lots} tax {summary.lots === 1 ? "lot" : "lots"}. {summary.errors} errors to fix.
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{fileName}</p>
                </div>
              </div>
              <button
                onClick={reset}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <X size={14} /> Choose different file
              </button>
            </div>

            {duplicates.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-3 space-y-2 max-h-48 overflow-y-auto">
                <p className="text-xs font-semibold text-foreground">Duplicate tickers detected</p>
                {duplicates.map((g) => {
                  const existing = existingHoldings.find((h) => h.ticker.toUpperCase() === g.ticker)!;
                  const merged = existing.shares + g.totalShares;
                  return (
                    <div key={g.ticker} className="flex flex-wrap items-center gap-3 text-xs">
                      <span className="font-mono font-semibold w-16">{g.ticker}</span>
                      <span className="text-muted-foreground">
                        Current: {existing.shares} sh @ ${Number(existing.avg_cost_basis).toFixed(2)} → Incoming: {g.totalShares} sh
                      </span>
                      <select
                        value={resolutions[g.ticker] ?? "merge"}
                        onChange={(e) =>
                          setResolutions((prev) => ({ ...prev, [g.ticker]: e.target.value as DuplicateResolution }))
                        }
                        className="ml-auto rounded-md border border-border bg-background px-2 py-1 text-xs"
                      >
                        <option value="merge">Merge → {merged} sh, {g.rows.length} new {g.rows.length === 1 ? "lot" : "lots"}</option>
                        <option value="skip">Skip this ticker</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex-1 overflow-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Row</th>
                    <th className="px-2 py-1.5 text-left">Ticker</th>
                    <th className="px-2 py-1.5 text-left">Date</th>
                    <th className="px-2 py-1.5 text-right">Shares</th>
                    <th className="px-2 py-1.5 text-right">Remaining</th>
                    <th className="px-2 py-1.5 text-right">Cost</th>
                    <th className="px-2 py-1.5 text-left">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((r) => {
                    const bad = r.errors.length > 0;
                    return (
                      <tr key={r.rowIndex} className={bad ? "bg-loss/10" : "bg-gain/5"}>
                        <td className="px-2 py-1 text-muted-foreground">{r.rowIndex}</td>
                        <td className="px-2 py-1 font-mono">{r.ticker || <span className="text-loss">—</span>}</td>
                        <td className="px-2 py-1 font-mono">{r.purchased_at}</td>
                        <td className="px-2 py-1 text-right font-mono">{r.shares ?? ""}</td>
                        <td className="px-2 py-1 text-right font-mono">{r.shares_remaining ?? ""}</td>
                        <td className="px-2 py-1 text-right font-mono">{r.cost_basis_per_share ?? ""}</td>
                        <td className="px-2 py-1">
                          {r.errors.map((e, i) => (
                            <div key={i} className="text-loss">{e}</div>
                          ))}
                          {r.warnings.map((w, i) => (
                            <div key={i} className="text-warning">{w}</div>
                          ))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" size="sm" onClick={handleClose} disabled={importing}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleImport}
                disabled={summary.errors > 0 || importing || !portfolioId}
              >
                {importing ? <><Loader2 className="animate-spin" /> Importing…</> : "Import"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
