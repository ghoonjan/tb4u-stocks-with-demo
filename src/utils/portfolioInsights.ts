import type { CompanyProfile } from "@/services/marketData";

export interface HoldingInput {
  ticker: string;
  companyName: string;
  currentValue: number;
  profile: CompanyProfile | null;
}

export interface BreakdownEntry {
  category: string;
  percentage: number;
  holdings: string[];
}

export interface GeoEntry {
  country: string;
  percentage: number;
  holdings: string[];
}

export interface SectorEntry {
  sector: string;
  percentage: number;
  holdings: string[];
}

export interface PortfolioAlert {
  level: "red" | "yellow" | "green";
  title: string;
  description: string;
}

export interface PortfolioInsights {
  marketCapBreakdown: BreakdownEntry[];
  geographicBreakdown: GeoEntry[];
  sectorBreakdown: SectorEntry[];
  maturityBreakdown: BreakdownEntry[];
  alerts: PortfolioAlert[];
}

const MARKET_CAP_ORDER = ["Mega Cap", "Large Cap", "Mid Cap", "Small Cap", "Micro Cap"];
const MATURITY_ORDER = [
  "Established (20+ yrs)",
  "Mature (10-20 yrs)",
  "Growth (5-10 yrs)",
  "Young (< 5 yrs)",
];

function classifyMarketCap(mcap: number): string | null {
  if (!mcap || mcap <= 0) return null;
  if (mcap > 200_000) return "Mega Cap";
  if (mcap >= 10_000) return "Large Cap";
  if (mcap >= 2_000) return "Mid Cap";
  if (mcap >= 300) return "Small Cap";
  return "Micro Cap";
}

function classifyMaturity(ipo: string): string | null {
  if (!ipo) return null;
  const t = new Date(ipo).getTime();
  if (Number.isNaN(t)) return null;
  const ageYears = (Date.now() - t) / (365.25 * 86_400_000);
  if (ageYears < 0) return null;
  if (ageYears >= 20) return "Established (20+ yrs)";
  if (ageYears >= 10) return "Mature (10-20 yrs)";
  if (ageYears >= 5) return "Growth (5-10 yrs)";
  return "Young (< 5 yrs)";
}

interface Bucket {
  value: number;
  holdings: string[];
}

function bucketize(
  holdings: HoldingInput[],
  total: number,
  keyFn: (h: HoldingInput) => string | null,
): Map<string, Bucket> {
  const map = new Map<string, Bucket>();
  for (const h of holdings) {
    const key = keyFn(h);
    if (!key) continue;
    const b = map.get(key) ?? { value: 0, holdings: [] };
    b.value += h.currentValue;
    b.holdings.push(h.ticker);
    map.set(key, b);
  }
  return map;
}

function toOrderedEntries(
  buckets: Map<string, Bucket>,
  total: number,
  order: string[],
): BreakdownEntry[] {
  const out: BreakdownEntry[] = [];
  for (const cat of order) {
    const b = buckets.get(cat);
    if (!b || b.holdings.length === 0) continue;
    out.push({
      category: cat,
      percentage: total > 0 ? (b.value / total) * 100 : 0,
      holdings: b.holdings,
    });
  }
  return out;
}

function toSortedEntries<T extends string>(
  buckets: Map<string, Bucket>,
  total: number,
  keyName: T,
): Array<{ [K in T]: string } & { percentage: number; holdings: string[] }> {
  const out = Array.from(buckets.entries()).map(([k, b]) => ({
    [keyName]: k,
    percentage: total > 0 ? (b.value / total) * 100 : 0,
    holdings: b.holdings,
  })) as Array<{ [K in T]: string } & { percentage: number; holdings: string[] }>;
  out.sort((a, b) => b.percentage - a.percentage);
  return out;
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

export function analyzePortfolio(holdings: HoldingInput[]): PortfolioInsights {
  const total = holdings.reduce((s, h) => s + (h.currentValue || 0), 0);

  if (total <= 0 || holdings.length === 0) {
    return {
      marketCapBreakdown: [],
      geographicBreakdown: [],
      sectorBreakdown: [],
      maturityBreakdown: [],
      alerts: [
        { level: "green", title: "Sector diversification", description: "No data available yet" },
        { level: "green", title: "Geographic spread", description: "No data available yet" },
        { level: "green", title: "Market cap spread", description: "No data available yet" },
      ],
    };
  }

  const mcapBuckets = bucketize(holdings, total, (h) =>
    h.profile ? classifyMarketCap(h.profile.marketCapitalization) : null,
  );
  const geoBuckets = bucketize(holdings, total, (h) =>
    h.profile && h.profile.country ? h.profile.country : null,
  );
  const sectorBuckets = bucketize(holdings, total, (h) =>
    h.profile && h.profile.finnhubIndustry ? h.profile.finnhubIndustry : null,
  );
  const maturityBuckets = bucketize(holdings, total, (h) =>
    h.profile ? classifyMaturity(h.profile.ipo) : null,
  );

  const marketCapBreakdown = toOrderedEntries(mcapBuckets, total, MARKET_CAP_ORDER);
  const geographicBreakdown = toSortedEntries(geoBuckets, total, "country") as GeoEntry[];
  const sectorBreakdown = toSortedEntries(sectorBuckets, total, "sector") as SectorEntry[];
  const maturityBreakdown = toOrderedEntries(maturityBuckets, total, MATURITY_ORDER);

  const alerts: PortfolioAlert[] = [];

  // Sector alert
  const topSector = sectorBreakdown[0];
  if (!topSector) {
    alerts.push({ level: "green", title: "Sector diversification", description: "No data available yet" });
  } else if (topSector.percentage > 40) {
    alerts.push({
      level: "red",
      title: "High sector concentration",
      description: `${topSector.sector} is ${fmtPct(topSector.percentage)} of your portfolio`,
    });
  } else if (topSector.percentage > 30) {
    alerts.push({
      level: "yellow",
      title: "Elevated sector concentration",
      description: `${topSector.sector} is ${fmtPct(topSector.percentage)} of your portfolio`,
    });
  } else {
    alerts.push({
      level: "green",
      title: "Good sector diversification",
      description: `Top sector ${topSector.sector} at ${fmtPct(topSector.percentage)}`,
    });
  }

  // Country alert
  const topCountry = geographicBreakdown[0];
  if (!topCountry) {
    alerts.push({ level: "green", title: "Geographic spread", description: "No data available yet" });
  } else if (topCountry.percentage > 85) {
    alerts.push({
      level: "red",
      title: "Heavy geographic concentration",
      description: `${topCountry.country} is ${fmtPct(topCountry.percentage)} of your portfolio`,
    });
  } else if (topCountry.percentage > 70) {
    alerts.push({
      level: "yellow",
      title: "Elevated geographic concentration",
      description: `${topCountry.country} is ${fmtPct(topCountry.percentage)} of your portfolio`,
    });
  } else {
    alerts.push({
      level: "green",
      title: "Good geographic spread",
      description: `Top country ${topCountry.country} at ${fmtPct(topCountry.percentage)}`,
    });
  }

  // Mega-cap alert
  const mega = marketCapBreakdown.find((b) => b.category === "Mega Cap");
  const megaPct = mega?.percentage ?? 0;
  if (marketCapBreakdown.length === 0) {
    alerts.push({ level: "green", title: "Market cap spread", description: "No data available yet" });
  } else if (megaPct > 80) {
    alerts.push({
      level: "red",
      title: "Heavy mega-cap concentration",
      description: `Mega-cap holdings are ${fmtPct(megaPct)} of your portfolio`,
    });
  } else if (megaPct > 60) {
    alerts.push({
      level: "yellow",
      title: "Elevated mega-cap concentration",
      description: `Mega-cap holdings are ${fmtPct(megaPct)} of your portfolio`,
    });
  } else {
    alerts.push({
      level: "green",
      title: "Good market cap spread",
      description: `Mega-cap holdings are ${fmtPct(megaPct)} of your portfolio`,
    });
  }

  return {
    marketCapBreakdown,
    geographicBreakdown,
    sectorBreakdown,
    maturityBreakdown,
    alerts,
  };
}
