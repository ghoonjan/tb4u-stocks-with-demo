import { useEffect, useMemo, useState } from "react";
import type { HoldingDisplay } from "@/hooks/usePortfolioData";
import { getCompanyProfile, type CompanyProfile, type StockQuote } from "@/services/marketData";
import {
  analyzePortfolio,
  type HoldingInput,
  type PortfolioInsights as Insights,
  type BreakdownEntry,
} from "@/utils/portfolioInsights";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, RefreshCw } from "lucide-react";

interface Props {
  holdings: HoldingDisplay[];
  quotes: Map<string, StockQuote>;
}

const COUNTRY_FLAGS: Record<string, string> = {
  US: "🇺🇸",
  CA: "🇨🇦",
  IE: "🇮🇪",
  NL: "🇳🇱",
  GB: "🇬🇧",
  DE: "🇩🇪",
  JP: "🇯🇵",
  CN: "🇨🇳",
};

const flagFor = (country: string) => COUNTRY_FLAGS[country.toUpperCase()] ?? "🌍";

const ALERT_DOT: Record<"red" | "yellow" | "green", string> = {
  red: "bg-destructive",
  yellow: "bg-yellow-500",
  green: "bg-green-500",
};

function Card({
  icon,
  title,
  children,
  className = "",
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-card border border-border rounded-lg shadow-sm p-5 ${className}`}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl" aria-hidden>
          {icon}
        </span>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function BarRow({
  label,
  percentage,
  prefix,
}: {
  label: string;
  percentage: number;
  prefix?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground flex items-center gap-2">
          {prefix && <span aria-hidden>{prefix}</span>}
          {label}
        </span>
        <span className="text-muted-foreground tabular-nums">{percentage.toFixed(1)}%</span>
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
        />
      </div>
    </div>
  );
}

function BarList({ entries, prefixes }: { entries: BreakdownEntry[]; prefixes?: string[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No data available yet.</p>;
  }
  return (
    <div className="space-y-3">
      {entries.map((e, i) => (
        <BarRow
          key={e.category}
          label={e.category}
          percentage={e.percentage}
          prefix={prefixes?.[i]}
        />
      ))}
    </div>
  );
}

export default function PortfolioInsights({ holdings, quotes }: Props) {
  const [profiles, setProfiles] = useState<Map<string, CompanyProfile | null>>(new Map());
  const [loading, setLoading] = useState(true);

  const tickerKey = useMemo(
    () => holdings.map((h) => h.ticker).sort().join(","),
    [holdings],
  );

  useEffect(() => {
    let cancelled = false;
    if (holdings.length === 0) {
      setProfiles(new Map());
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const next = new Map<string, CompanyProfile | null>();
      await Promise.all(
        holdings.map(async (h) => {
          try {
            const p = await getCompanyProfile(h.ticker);
            next.set(h.ticker, p);
          } catch {
            next.set(h.ticker, null);
          }
        }),
      );
      if (!cancelled) {
        setProfiles(next);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tickerKey]);

  const insights: Insights = useMemo(() => {
    const inputs: HoldingInput[] = holdings.map((h) => {
      const q = quotes.get(h.ticker);
      const price = q?.c ?? h.currentPrice ?? h.avgCostBasis;
      return {
        ticker: h.ticker,
        companyName: h.companyName,
        currentValue: h.shares * price,
        profile: profiles.get(h.ticker) ?? null,
      };
    });
    return analyzePortfolio(inputs);
  }, [holdings, quotes, profiles]);

  // Sectors: top 8 + "Other"
  const sectorEntries: BreakdownEntry[] = useMemo(() => {
    const all = insights.sectorBreakdown.map((s) => ({
      category: s.sector,
      percentage: s.percentage,
      holdings: s.holdings,
    }));
    if (all.length <= 8) return all;
    const top = all.slice(0, 8);
    const rest = all.slice(8);
    const otherPct = rest.reduce((s, e) => s + e.percentage, 0);
    const otherHoldings = rest.flatMap((e) => e.holdings);
    return [...top, { category: "Other", percentage: otherPct, holdings: otherHoldings }];
  }, [insights.sectorBreakdown]);

  const geoEntries: BreakdownEntry[] = useMemo(
    () =>
      insights.geographicBreakdown.map((g) => ({
        category: g.country,
        percentage: g.percentage,
        holdings: g.holdings,
      })),
    [insights.geographicBreakdown],
  );

  const avgAge = useMemo(() => {
    const ages: number[] = [];
    for (const h of holdings) {
      const p = profiles.get(h.ticker);
      if (!p?.ipo) continue;
      const t = new Date(p.ipo).getTime();
      if (Number.isNaN(t)) continue;
      ages.push((Date.now() - t) / (365.25 * 86_400_000));
    }
    if (ages.length === 0) return null;
    return ages.reduce((s, n) => s + n, 0) / ages.length;
  }, [holdings, profiles]);

  if (loading && profiles.size === 0) {
    return (
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Portfolio Insights</h2>
        <Skeleton className="h-24 w-full rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-foreground">Portfolio Insights</h2>

      {/* Smart Alerts Banner */}
      <Card icon="🛎️" title="Smart Alerts">
        {insights.alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            ✅ Your portfolio looks well-balanced
          </p>
        ) : (
          <ul className="space-y-3">
            {insights.alerts.map((a, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${ALERT_DOT[a.level]}`}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{a.title}</p>
                  <p className="text-sm text-muted-foreground">{a.description}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card icon="🏛️" title="Market Cap Distribution">
          <BarList entries={insights.marketCapBreakdown} />
        </Card>

        <Card icon="🌐" title="Geographic Exposure">
          <BarList
            entries={geoEntries}
            prefixes={geoEntries.map((g) => flagFor(g.category))}
          />
        </Card>

        <Card icon="📊" title="Sector Allocation">
          <BarList entries={sectorEntries} />
        </Card>

        <Card icon="⏳" title="Company Maturity">
          <BarList entries={insights.maturityBreakdown} />
          {avgAge !== null && (
            <p className="mt-4 text-xs text-muted-foreground">
              Avg company age: {avgAge.toFixed(1)} years
            </p>
          )}
        </Card>
      </div>
    </section>
  );
}
