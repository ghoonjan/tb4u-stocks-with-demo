import { useState, useEffect, useCallback, useRef } from "react";
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

const CACHE_KEY = "dividend_analytics_cache";
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const STALE_MS = 12 * 60 * 60 * 1000; // 12 hours

interface CacheShape {
  data: [string, HoldingAnalytics][];
  timestamp: number;
}

function readCache(): { map: Map<string, HoldingAnalytics>; timestamp: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheShape;
    if (!parsed?.timestamp || !Array.isArray(parsed.data)) return null;
    if (Date.now() - parsed.timestamp > TTL_MS) return null;
    return { map: new Map(parsed.data), timestamp: parsed.timestamp };
  } catch {
    return null;
  }
}

function writeCache(map: Map<string, HoldingAnalytics>) {
  try {
    const payload: CacheShape = { data: Array.from(map.entries()), timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch { /* ignore quota errors */ }
}

export function useAnalyticsData(holdings: HoldingDisplay[]) {
  const [analytics, setAnalytics] = useState<Map<string, HoldingAnalytics>>(new Map());
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const tickersKey = holdings.map((h) => h.ticker).sort().join(",");
  const inflight = useRef(false);

  const fetchFresh = useCallback(async (): Promise<Map<string, HoldingAnalytics>> => {
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
    return result;
  }, [tickersKey]);

  const run = useCallback(async () => {
    if (holdings.length === 0) {
      setAnalytics(new Map());
      setLastUpdated(null);
      setLoading(false);
      return;
    }

    const cached = readCache();
    if (cached) {
      // Cache hit: show immediately
      setAnalytics(cached.map);
      setLastUpdated(cached.timestamp);
      setLoading(false);

      // Stale-while-revalidate: refresh in background if older than 12h
      if (Date.now() - cached.timestamp > STALE_MS && !inflight.current) {
        inflight.current = true;
        try {
          const fresh = await fetchFresh();
          writeCache(fresh);
          setAnalytics(fresh);
          setLastUpdated(Date.now());
        } finally {
          inflight.current = false;
        }
      }
      return;
    }

    // Cache miss
    setLoading(true);
    inflight.current = true;
    try {
      const fresh = await fetchFresh();
      writeCache(fresh);
      setAnalytics(fresh);
      setLastUpdated(Date.now());
    } finally {
      inflight.current = false;
      setLoading(false);
    }
  }, [tickersKey, fetchFresh]);

  useEffect(() => { run(); }, [run]);

  return { analytics, loading, lastUpdated };
}
