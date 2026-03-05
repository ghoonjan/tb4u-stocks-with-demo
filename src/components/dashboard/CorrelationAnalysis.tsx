import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle, Shield, Search } from "lucide-react";
import type { HoldingDisplay } from "@/hooks/usePortfolioData";
import type { HoldingAnalytics } from "@/hooks/useAnalyticsData";

// ============ ETF TOP HOLDINGS (hardcoded, approximate weights %) ============
const ETF_HOLDINGS: Record<string, { ticker: string; weight: number }[]> = {
  SPY: [
    { ticker: "AAPL", weight: 7.0 }, { ticker: "MSFT", weight: 7.0 }, { ticker: "NVDA", weight: 6.0 },
    { ticker: "AMZN", weight: 4.0 }, { ticker: "META", weight: 2.5 }, { ticker: "GOOGL", weight: 2.0 },
    { ticker: "GOOG", weight: 2.0 }, { ticker: "BRK.B", weight: 1.7 }, { ticker: "LLY", weight: 1.5 },
    { ticker: "AVGO", weight: 1.5 },
  ],
  VOO: [
    { ticker: "AAPL", weight: 7.0 }, { ticker: "MSFT", weight: 7.0 }, { ticker: "NVDA", weight: 6.0 },
    { ticker: "AMZN", weight: 4.0 }, { ticker: "META", weight: 2.5 }, { ticker: "GOOGL", weight: 2.0 },
    { ticker: "GOOG", weight: 2.0 }, { ticker: "BRK.B", weight: 1.7 }, { ticker: "LLY", weight: 1.5 },
    { ticker: "AVGO", weight: 1.5 },
  ],
  QQQ: [
    { ticker: "AAPL", weight: 9.0 }, { ticker: "MSFT", weight: 8.0 }, { ticker: "NVDA", weight: 7.0 },
    { ticker: "AMZN", weight: 5.0 }, { ticker: "META", weight: 4.0 }, { ticker: "AVGO", weight: 4.0 },
    { ticker: "GOOGL", weight: 3.0 }, { ticker: "GOOG", weight: 2.5 }, { ticker: "COST", weight: 2.5 },
    { ticker: "TSLA", weight: 2.5 },
  ],
  VTI: [
    { ticker: "AAPL", weight: 6.0 }, { ticker: "MSFT", weight: 6.0 }, { ticker: "NVDA", weight: 5.0 },
    { ticker: "AMZN", weight: 3.5 }, { ticker: "META", weight: 2.0 }, { ticker: "GOOGL", weight: 1.8 },
    { ticker: "GOOG", weight: 1.8 }, { ticker: "BRK.B", weight: 1.5 }, { ticker: "LLY", weight: 1.3 },
    { ticker: "AVGO", weight: 1.3 },
  ],
  DIA: [
    { ticker: "UNH", weight: 9.0 }, { ticker: "GS", weight: 7.5 }, { ticker: "MSFT", weight: 6.0 },
    { ticker: "HD", weight: 5.5 }, { ticker: "CAT", weight: 5.0 }, { ticker: "AMGN", weight: 4.5 },
    { ticker: "V", weight: 4.0 }, { ticker: "MCD", weight: 4.0 }, { ticker: "CRM", weight: 3.5 },
    { ticker: "AAPL", weight: 3.0 },
  ],
};

const KNOWN_ETFS = new Set(Object.keys(ETF_HOLDINGS));

// ============ DIVERSIFICATION SCORE ============

interface DiversificationProps {
  holdings: HoldingDisplay[];
  analytics: Map<string, HoldingAnalytics>;
  loading: boolean;
}

export function DiversificationSection({ holdings, analytics, loading }: DiversificationProps) {
  const [expanded, setExpanded] = useState(false);

  const { score, label, colorClass, bgClass, matrix, sectorConcentration } = useMemo(() => {
    if (holdings.length < 2 || loading) {
      return { score: 100, label: "N/A", colorClass: "text-muted-foreground", bgClass: "bg-muted", matrix: [], sectorConcentration: null };
    }

    const tickers = holdings.map((h) => h.ticker);
    const sectors = tickers.map((t) => analytics.get(t)?.sector ?? "Other");

    // Pairwise correlation
    let totalCorr = 0;
    let pairs = 0;
    const matrixData: { row: string; col: string; corr: number }[] = [];

    for (let i = 0; i < tickers.length; i++) {
      for (let j = i + 1; j < tickers.length; j++) {
        const corr = sectors[i] === sectors[j] ? 0.7 : 0.2;
        totalCorr += corr;
        pairs++;
        matrixData.push({ row: tickers[i], col: tickers[j], corr });
      }
    }

    const avgCorr = pairs > 0 ? totalCorr / pairs : 0;
    const rawScore = Math.round(100 - avgCorr * 100);

    let lbl: string, cc: string, bg: string;
    if (rawScore >= 80) { lbl = "Excellent diversification"; cc = "text-gain"; bg = "bg-gain"; }
    else if (rawScore >= 60) { lbl = "Good diversification"; cc = "text-primary"; bg = "bg-primary"; }
    else if (rawScore >= 40) { lbl = "Moderate — some overlap risk"; cc = "text-warning"; bg = "bg-warning"; }
    else { lbl = "Low diversification — high overlap risk"; cc = "text-loss"; bg = "bg-loss"; }

    // Sector concentration insight
    const sectorWeights = new Map<string, number>();
    holdings.forEach((h) => {
      const s = analytics.get(h.ticker)?.sector ?? "Other";
      sectorWeights.set(s, (sectorWeights.get(s) ?? 0) + h.weight);
    });
    const topSector = [...sectorWeights.entries()].sort((a, b) => b[1] - a[1])[0];

    return {
      score: rawScore,
      label: lbl,
      colorClass: cc,
      bgClass: bg,
      matrix: matrixData,
      sectorConcentration: topSector && topSector[1] > 25 ? { sector: topSector[0], pct: topSector[1] } : null,
    };
  }, [holdings, analytics, loading]);

  if (holdings.length < 2) return null;

  const tickers = [...new Set(holdings.map((h) => h.ticker))];

  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full"
      >
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Diversification Score</h4>
        <div className="flex items-center gap-2">
          <span className={`font-mono text-sm font-bold ${colorClass}`}>{score}</span>
          {expanded ? <ChevronUp size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
        </div>
      </button>

      {/* Score bar */}
      <div className="mt-2 space-y-1">
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <div className={`h-full rounded-full ${bgClass} transition-all duration-500`} style={{ width: `${score}%` }} />
        </div>
        <p className={`text-[10px] ${colorClass}`}>{label}</p>
      </div>

      {/* Sector concentration insight */}
      {sectorConcentration && (
        <div className="flex items-start gap-2 rounded-md bg-warning/10 border border-warning/20 px-2.5 py-1.5 mt-2">
          <AlertTriangle size={12} className="text-warning shrink-0 mt-0.5" />
          <p className="text-[10px] text-muted-foreground">
            <span className="text-foreground font-semibold">{sectorConcentration.pct.toFixed(0)}%</span> of your portfolio is in{" "}
            <span className="text-foreground">{sectorConcentration.sector}</span>. If this sector has a bad quarter, a significant portion of your portfolio is at risk.
          </p>
        </div>
      )}

      {/* Expanded: heatmap */}
      {expanded && tickers.length <= 12 && (
        <div className="mt-3 overflow-x-auto">
          <table className="text-[9px]">
            <thead>
              <tr>
                <th />
                {tickers.map((t) => (
                  <th key={t} className="px-1 py-0.5 text-muted-foreground font-mono font-normal text-center">{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tickers.map((row, ri) => (
                <tr key={row}>
                  <td className="px-1 py-0.5 text-muted-foreground font-mono">{row}</td>
                  {tickers.map((col, ci) => {
                    if (ri === ci) {
                      return <td key={col} className="px-1 py-0.5"><div className="w-5 h-5 rounded-sm bg-muted mx-auto" /></td>;
                    }
                    const sameRow = analytics.get(row)?.sector ?? "Other";
                    const sameCol = analytics.get(col)?.sector ?? "Other";
                    const corr = sameRow === sameCol ? 0.7 : 0.2;
                    const bg = corr >= 0.6 ? "bg-loss/40" : "bg-gain/30";
                    return (
                      <td key={col} className="px-1 py-0.5">
                        <div className={`w-5 h-5 rounded-sm ${bg} flex items-center justify-center mx-auto`} title={`${row}↔${col}: ${corr}`}>
                          <span className="text-[7px] font-mono text-foreground/70">{corr.toFixed(1)}</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============ ETF X-RAY ============

interface EtfXRayProps {
  holdings: HoldingDisplay[];
}

interface OverlapItem {
  company: string;
  directPct: number;
  indirectPct: number;
  totalPct: number;
  sources: string[]; // ETF tickers contributing
}

export function EtfXRaySection({ holdings }: EtfXRayProps) {
  const totalValue = holdings.reduce((s, h) => s + h.positionValue, 0);

  const overlaps = useMemo<OverlapItem[]>(() => {
    if (totalValue === 0) return [];

    const etfHoldings = holdings.filter((h) => KNOWN_ETFS.has(h.ticker));
    if (etfHoldings.length === 0) return [];

    // Build exposure map: company ticker -> { direct weight, indirect contributions }
    const exposureMap = new Map<string, { direct: number; indirect: number; sources: Set<string> }>();

    // Direct holdings (non-ETF)
    holdings.forEach((h) => {
      if (KNOWN_ETFS.has(h.ticker)) return;
      const w = (h.positionValue / totalValue) * 100;
      const existing = exposureMap.get(h.ticker) ?? { direct: 0, indirect: 0, sources: new Set<string>() };
      existing.direct += w;
      exposureMap.set(h.ticker, existing);
    });

    // Indirect through ETFs
    etfHoldings.forEach((etf) => {
      const etfWeight = (etf.positionValue / totalValue) * 100;
      const constituents = ETF_HOLDINGS[etf.ticker] ?? [];
      constituents.forEach((c) => {
        const contrib = (etfWeight * c.weight) / 100;
        const existing = exposureMap.get(c.ticker) ?? { direct: 0, indirect: 0, sources: new Set<string>() };
        existing.indirect += contrib;
        existing.sources.add(etf.ticker);
        exposureMap.set(c.ticker, existing);
      });
    });

    // Only show items that have BOTH direct and indirect, or indirect is significant
    return [...exposureMap.entries()]
      .map(([ticker, { direct, indirect, sources }]) => ({
        company: ticker,
        directPct: direct,
        indirectPct: indirect,
        totalPct: direct + indirect,
        sources: [...sources],
      }))
      .filter((o) => o.indirectPct > 0 && (o.directPct > 0 || o.totalPct > 2))
      .sort((a, b) => b.totalPct - a.totalPct);
  }, [holdings, totalValue]);

  const flagged = overlaps.filter((o) => o.totalPct > 15);

  if (holdings.length === 0) return null;

  const hasEtfs = holdings.some((h) => KNOWN_ETFS.has(h.ticker));

  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Search size={12} className="text-muted-foreground" />
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">X-Ray: Hidden Exposures</h4>
      </div>

      {!hasEtfs ? (
        <p className="text-[11px] text-muted-foreground py-2">No ETFs detected in your portfolio. Add ETFs like SPY, QQQ, or VOO to see hidden overlap analysis.</p>
      ) : overlaps.length === 0 ? (
        <div className="flex items-center gap-2 py-2">
          <Shield size={14} className="text-gain" />
          <p className="text-[11px] text-muted-foreground">No hidden overlaps detected.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {/* Flagged warnings */}
          {flagged.map((o) => (
            <div key={`flag-${o.company}`} className="flex items-start gap-2 rounded-md bg-warning/10 border border-warning/20 px-2.5 py-1.5">
              <AlertTriangle size={12} className="text-warning shrink-0 mt-0.5" />
              <p className="text-[10px] text-muted-foreground">
                <span className="text-foreground font-semibold">Hidden Overlap:</span> Your effective exposure to{" "}
                <span className="text-foreground font-semibold">{o.company}</span> is{" "}
                <span className="text-warning font-mono font-semibold">{o.totalPct.toFixed(1)}%</span>{" "}
                ({o.directPct > 0 ? `${o.directPct.toFixed(1)}% direct + ` : ""}
                {o.indirectPct.toFixed(1)}% through {o.sources.join(" and ")}).
                Consider if this concentration is intentional.
              </p>
            </div>
          ))}

          {/* Full list */}
          <div className="rounded-md border border-border overflow-hidden mt-1">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="bg-secondary/50 border-b border-border">
                  <th className="text-left py-1.5 px-2 text-muted-foreground font-semibold">Company</th>
                  <th className="text-right py-1.5 px-2 text-muted-foreground font-semibold">Direct</th>
                  <th className="text-right py-1.5 px-2 text-muted-foreground font-semibold">Via ETFs</th>
                  <th className="text-right py-1.5 px-2 text-muted-foreground font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {overlaps.slice(0, 10).map((o) => (
                  <tr key={o.company} className="border-b border-border/30">
                    <td className="py-1 px-2 font-mono font-semibold text-foreground">
                      {o.company}
                      {o.sources.length > 0 && (
                        <span className="text-[8px] text-muted-foreground ml-1">({o.sources.join(", ")})</span>
                      )}
                    </td>
                    <td className="py-1 px-2 text-right font-mono text-muted-foreground">
                      {o.directPct > 0 ? o.directPct.toFixed(1) + "%" : "—"}
                    </td>
                    <td className="py-1 px-2 text-right font-mono text-primary">
                      {o.indirectPct.toFixed(1)}%
                    </td>
                    <td className={`py-1 px-2 text-right font-mono font-semibold ${o.totalPct > 15 ? "text-warning" : "text-foreground"}`}>
                      {o.totalPct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
