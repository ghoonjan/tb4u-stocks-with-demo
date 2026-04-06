import { useState, useRef, useCallback, useMemo } from "react";
import { X, Download, Copy, Link2, Check, Shield } from "lucide-react";
import html2canvas from "html2canvas";
import type { HoldingDisplay } from "@/hooks/usePortfolioData";

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  holdings: HoldingDisplay[];
  simpleReturn: number | null;
  twr: number | null;
  twrAvailable: boolean;
  spyDp?: number;
}

const fmt = (n: number, d = 1) => n.toFixed(d);

export function ShareModal({ open, onClose, holdings, simpleReturn, twr, twrAvailable, spyDp = 0 }: ShareModalProps) {
  const [tab, setTab] = useState<"image" | "link">("image");
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const top5 = useMemo(() => [...holdings].sort((a, b) => b.weight - a.weight).slice(0, 5), [holdings]);

  const winners = holdings.filter((h) => h.totalPLDollar >= 0).length;
  const winRate = holdings.length > 0 ? winners : 0;
  const totalPositions = holdings.length;

  const avgConviction = useMemo(() => {
    if (holdings.length === 0) return 0;
    return holdings.reduce((s, h) => s + h.convictionRating, 0) / holdings.length;
  }, [holdings]);

  const sectorMap = useMemo(() => {
    const m = new Map<string, number>();
    holdings.forEach((h) => {
      // Use a simplified sector approach based on weight
      const sector = "Holdings"; // placeholder; we'll show weight distribution
      m.set(sector, (m.get(sector) ?? 0) + h.weight);
    });
    return m;
  }, [holdings]);

  const returnPct = twrAvailable && twr != null ? twr : (simpleReturn ?? 0);
  const returnLabel = twrAvailable ? "TWR" : "Simple Return";
  const alpha = simpleReturn != null ? simpleReturn - spyDp : 0;

  const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const handleDownload = useCallback(async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
        logging: false,
      });
      const link = document.createElement("a");
      link.download = `war-room-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      console.error("Failed to generate image", e);
    }
    setDownloading(false);
  }, []);

  const handleCopy = useCallback(async () => {
    if (!cardRef.current) return;
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
        logging: false,
      });
      canvas.toBlob(async (blob) => {
        if (blob) {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      });
    } catch {
      console.error("Failed to copy");
    }
  }, []);

  // Sector donut data for the card
  const sectorWeights = useMemo(() => {
    const m = new Map<string, number>();
    holdings.forEach((h) => {
      m.set(h.ticker, h.weight);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [holdings]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 scrim-blur" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto layer-modal shadow-xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Share My TB4U</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X size={18} /></button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-border">
          <button onClick={() => setTab("image")}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors relative ${tab === "image" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            📸 Shareable Image
            {tab === "image" && <span className="absolute bottom-0 left-4 right-4 h-[2px] bg-primary rounded-full" />}
          </button>
          <button onClick={() => setTab("link")}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors relative ${tab === "link" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            <Link2 size={12} className="inline mr-1" /> Public Link
            {tab === "link" && <span className="absolute bottom-0 left-4 right-4 h-[2px] bg-primary rounded-full" />}
          </button>
        </div>

        <div className="p-6">
          {tab === "image" ? (
            <div className="space-y-4">
              {/* THE CARD — rendered as HTML, captured via html2canvas */}
              <div className="flex justify-center">
                <div
                  ref={cardRef}
                  style={{
                    width: 600,
                    height: 338,
                    background: "linear-gradient(135deg, hsl(230, 25%, 10%) 0%, hsl(270, 20%, 12%) 50%, hsl(240, 22%, 9%) 100%)",
                    borderRadius: 16,
                    padding: 32,
                    fontFamily: "'Inter', 'SF Pro Display', -apple-system, sans-serif",
                    position: "relative",
                    overflow: "hidden",
                    color: "#e2e8f0",
                  }}
                >
                  {/* Subtle grid overlay */}
                  <div style={{
                    position: "absolute", inset: 0, opacity: 0.03,
                    backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)",
                    backgroundSize: "24px 24px",
                  }} />

                  {/* Glow accent */}
                  <div style={{
                    position: "absolute", top: -80, right: -80, width: 200, height: 200,
                    borderRadius: "50%",
                    background: "radial-gradient(circle, hsla(217, 91%, 60%, 0.08) 0%, transparent 70%)",
                  }} />

                  {/* Header row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, position: "relative" }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", color: "hsl(217, 91%, 60%)", textTransform: "uppercase" as const, marginBottom: 2 }}>
                        TB4U
                      </div>
                      <div style={{ fontSize: 10, color: "#64748b" }}>Portfolio Snapshot</div>
                    </div>
                    <div style={{ textAlign: "right" as const }}>
                      <div style={{ fontSize: 10, color: "#64748b" }}>As of {dateStr}</div>
                    </div>
                  </div>

                  {/* Main metrics row */}
                  <div style={{ display: "flex", gap: 24, marginBottom: 20 }}>
                    {/* Return */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "#64748b", marginBottom: 4 }}>
                        {returnLabel}
                      </div>
                      <div style={{
                        fontSize: 32, fontWeight: 800, fontFamily: "'SF Mono', 'Fira Code', monospace",
                        color: returnPct >= 0 ? "#22c55e" : "#ef4444",
                        lineHeight: 1,
                      }}>
                        {returnPct >= 0 ? "+" : ""}{fmt(returnPct)}%
                      </div>
                      <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>all-time performance</div>
                    </div>
                    {/* Alpha */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "#64748b", marginBottom: 4 }}>
                        vs S&P 500
                      </div>
                      <div style={{
                        fontSize: 24, fontWeight: 700, fontFamily: "'SF Mono', monospace",
                        color: alpha >= 0 ? "#22c55e" : "#ef4444",
                        lineHeight: 1,
                      }}>
                        {alpha >= 0 ? "+" : ""}{fmt(alpha)}%
                      </div>
                      <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>
                        {alpha >= 0 ? "alpha generated" : "trailing benchmark"}
                      </div>
                    </div>
                    {/* Win Rate & Conviction */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "#64748b", marginBottom: 4 }}>
                        Win Rate
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "monospace", color: "#e2e8f0", lineHeight: 1 }}>
                        {winRate}/{totalPositions}
                      </div>
                      <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>
                        positions profitable
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "#64748b", marginBottom: 2 }}>
                          Avg Conviction
                        </div>
                        <div style={{ display: "flex", gap: 2 }}>
                          {[1, 2, 3, 4, 5].map((i) => (
                            <span key={i} style={{
                              display: "inline-block", width: 10, height: 10,
                              borderRadius: 2,
                              background: i <= Math.round(avgConviction) ? "hsl(217, 91%, 60%)" : "hsla(215, 20%, 65%, 0.2)",
                            }} />
                          ))}
                          <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: 4, fontFamily: "monospace" }}>
                            {avgConviction.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom row: Top 5 holdings */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 16,
                    borderTop: "1px solid hsla(215, 20%, 25%, 0.5)",
                    paddingTop: 16,
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "#64748b", marginBottom: 8 }}>
                        Top Holdings
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                        {top5.map((h) => (
                          <div key={h.ticker} style={{
                            display: "flex", alignItems: "center", gap: 4,
                            background: "hsla(215, 20%, 20%, 0.5)",
                            borderRadius: 6, padding: "4px 8px",
                            border: "1px solid hsla(215, 20%, 30%, 0.4)",
                          }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#e2e8f0", fontFamily: "monospace" }}>{h.ticker}</span>
                            <span style={{ fontSize: 9, color: "#64748b", fontFamily: "monospace" }}>{fmt(h.weight)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Mini weight bars */}
                    <div style={{ width: 120 }}>
                      {top5.slice(0, 4).map((h) => (
                        <div key={h.ticker} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
                          <span style={{ fontSize: 8, color: "#64748b", width: 28, textAlign: "right" as const, fontFamily: "monospace" }}>{h.ticker}</span>
                          <div style={{ flex: 1, height: 4, borderRadius: 2, background: "hsla(215, 20%, 20%, 0.5)", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${Math.min(h.weight * 2, 100)}%`, borderRadius: 2, background: "hsl(217, 91%, 60%)" }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Footer branding */}
                  <div style={{
                    position: "absolute", bottom: 12, left: 32, right: 32,
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <span style={{ fontSize: 9, color: "#475569", fontWeight: 500 }}>Built with TB4U</span>
                    <span style={{ fontSize: 9, color: "#475569" }}>tb4u.app</span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 justify-center">
                <button onClick={handleDownload} disabled={downloading}
                  className="flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  <Download size={14} /> {downloading ? "Generating…" : "Download PNG"}
                </button>
                <button onClick={handleCopy}
                  className="flex items-center gap-2 rounded-md border border-border bg-secondary px-5 py-2.5 text-sm font-medium text-foreground hover:bg-secondary/80 transition-colors">
                  {copied ? <><Check size={14} className="text-gain" /> Copied!</> : <><Copy size={14} /> Copy to Clipboard</>}
                </button>
              </div>

              {/* Privacy disclaimer */}
              <div className="flex items-start gap-2 rounded-md border border-border bg-secondary/50 px-4 py-3">
                <Shield size={14} className="text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Your share card shows performance percentages and holdings by weight only.
                  No dollar amounts or account values are ever shared.
                </p>
              </div>
            </div>
          ) : (
            /* Public Link tab — Coming Soon */
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-secondary p-4 mb-4">
                <Link2 size={24} className="text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Coming Soon</h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                Public portfolio links launching soon. Download the image to share for now.
              </p>
              <button onClick={() => setTab("image")}
                className="mt-4 text-xs text-primary hover:text-primary/80 transition-colors">
                ← Generate an image instead
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
