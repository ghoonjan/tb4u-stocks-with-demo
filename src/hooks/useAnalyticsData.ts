import { useState, useEffect, useCallback } from "react";
import { getCompanyProfile, getBasicFinancials, type CompanyProfile, type BasicFinancials } from "@/services/marketData";
import type { HoldingDisplay } from "@/hooks/usePortfolioData";

export interface HoldingAnalytics {
  ticker: string;
  sector: string;
  divYield: number;    // annual %
  divPerShare: number; // estimated annual dividend per share
  payoutRatio: number | null;
  divGrowth5Y: number | null;
}

export function useAnalyticsData(holdings: HoldingDisplay[]) {
  const [analytics, setAnalytics] = useState<Map<string, HoldingAnalytics>>(new Map());
  const [loading, setLoading] = useState(true);
  const tickersKey = holdings.map((h) => h.ticker).sort().join(",");

  const fetch = useCallback(async () => {
    if (holdings.length === 0) { setLoading(false); return; }
    setLoading(true);
    const result = new Map<string, HoldingAnalytics>();

    for (let i = 0; i < holdings.length; i++) {
      const h = holdings[i];
      try {
        const [profile, financials] = await Promise.all([
          getCompanyProfile(h.ticker).catch(() => null),
          getBasicFinancials(h.ticker).catch(() => ({} as BasicFinancials)),
        ]);
        const divYield = financials.dividendYieldIndicatedAnnual ?? 0;
        const divPerShare = divYield > 0 ? (h.currentPrice * divYield) / 100 : 0;
        result.set(h.ticker, {
          ticker: h.ticker,
          sector: profile?.finnhubIndustry || "Other",
          divYield,
          divPerShare,
          payoutRatio: financials.payoutRatioAnnual ?? null,
          divGrowth5Y: financials.dividendGrowthRate5Y ?? null,
        });
      } catch { /* skip */ }
      if (i < holdings.length - 1) await new Promise((r) => setTimeout(r, 250));
    }

    setAnalytics(result);
    setLoading(false);
  }, [tickersKey]);

  useEffect(() => { fetch(); }, [fetch]);

  return { analytics, loading };
}
