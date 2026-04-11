import { supabase } from "@/integrations/supabase/client";

export interface StockQuote {
  c: number;  // current price
  d: number;  // change
  dp: number; // change percent
  h: number;  // high
  l: number;  // low
  o: number;  // open
  pc: number; // previous close
}

export interface CompanyProfile {
  name: string;
  ticker: string;
  logo: string;
  finnhubIndustry: string;
  marketCapitalization: number;
}

export interface BasicFinancials {
  dividendYieldIndicatedAnnual?: number;
  payoutRatioAnnual?: number;
  "52WeekHigh"?: number;
  "52WeekLow"?: number;
  peNormalizedAnnual?: number;
  dividendGrowthRate5Y?: number;
  dividendPerShareAnnual?: number;
}

export interface CandleData {
  t: number[];  // timestamps
  c: number[];  // close prices
  o: number[];  // open prices
  h: number[];  // high prices
  l: number[];  // low prices
  v: number[];  // volumes
  s: string;    // status
}

export interface NewsArticle {
  id: number;
  headline: string;
  source: string;
  url: string;
  datetime: number;
  summary: string;
  image: string;
}

// In-memory cache
const quoteCache = new Map<string, { data: StockQuote; ts: number }>();
const profileCache = new Map<string, { data: CompanyProfile; ts: number }>();
const metricsCache = new Map<string, { data: BasicFinancials; ts: number }>();

const QUOTE_TTL = 55_000;   // ~55s (we refresh every 60s)
const PROFILE_TTL = 3600_000; // 1 hour
const METRICS_TTL = 3600_000;

// Global throttle queue: ensures minimum 350ms gap between Finnhub API calls
let lastCallTs = 0;
let callQueue: Promise<void> = Promise.resolve();

function throttled<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    callQueue = callQueue.then(async () => {
      const wait = Math.max(0, lastCallTs + 350 - Date.now());
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      lastCallTs = Date.now();
      try { resolve(await fn()); }
      catch (e) { reject(e); }
    });
  });
}

async function callFinnhub(endpoint: string, params: Record<string, string>) {
  return throttled(async () => {
    const { data, error } = await supabase.functions.invoke("finnhub", {
      body: { endpoint, params },
    });
    if (error) throw new Error(error.message || "Edge function error");
    if (data?.error === "rate_limit") throw new Error("RATE_LIMIT");
    if (data?.error) throw new Error(data.error);
    return data;
  });
}

export async function getQuote(symbol: string): Promise<StockQuote> {
  const cached = quoteCache.get(symbol);
  if (cached && Date.now() - cached.ts < QUOTE_TTL) return cached.data;

  const data = await callFinnhub("/quote", { symbol });
  // Finnhub returns { c:0, d:null, dp:null } for invalid tickers
  if (!data || data.c === 0) throw new Error("INVALID_TICKER");

  const quote: StockQuote = {
    c: data.c ?? 0, d: data.d ?? 0, dp: data.dp ?? 0,
    h: data.h ?? 0, l: data.l ?? 0, o: data.o ?? 0, pc: data.pc ?? 0,
  };
  quoteCache.set(symbol, { data: quote, ts: Date.now() });
  return quote;
}

export async function getCompanyProfile(symbol: string): Promise<CompanyProfile | null> {
  const cached = profileCache.get(symbol);
  if (cached && Date.now() - cached.ts < PROFILE_TTL) return cached.data;

  const data = await callFinnhub("/stock/profile2", { symbol });
  if (!data || !data.name) return null;

  const profile: CompanyProfile = {
    name: data.name, ticker: data.ticker, logo: data.logo,
    finnhubIndustry: data.finnhubIndustry, marketCapitalization: data.marketCapitalization,
  };
  profileCache.set(symbol, { data: profile, ts: Date.now() });
  return profile;
}

export async function getBasicFinancials(symbol: string): Promise<BasicFinancials> {
  const cached = metricsCache.get(symbol);
  if (cached && Date.now() - cached.ts < METRICS_TTL) return cached.data;

  const data = await callFinnhub("/stock/metric", { symbol, metric: "all" });
  const m = data?.metric ?? {};
  const financials: BasicFinancials = {
    dividendYieldIndicatedAnnual: m.dividendYieldIndicatedAnnual,
    payoutRatioAnnual: m.payoutRatioAnnual,
    "52WeekHigh": m["52WeekHigh"],
    "52WeekLow": m["52WeekLow"],
    peNormalizedAnnual: m.peNormalizedAnnual,
    dividendGrowthRate5Y: m.dividendGrowthRate5Y,
    dividendPerShareAnnual: m.dividendPerShareAnnual,
  };
  metricsCache.set(symbol, { data: financials, ts: Date.now() });
  return financials;
}

/**
 * Fetch quotes for multiple tickers.
 * Global throttle queue handles rate-limit pacing automatically.
 */
export async function getBatchQuotes(
  symbols: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<Map<string, StockQuote>> {
  const results = new Map<string, StockQuote>();
  for (let i = 0; i < symbols.length; i++) {
    try {
      const quote = await getQuote(symbols[i]);
      results.set(symbols[i], quote);
    } catch (err: any) {
      if (err.message === "RATE_LIMIT") {
        await new Promise((r) => setTimeout(r, 30_000));
        try {
          const quote = await getQuote(symbols[i]);
          results.set(symbols[i], quote);
        } catch { /* skip */ }
      }
    }
    onProgress?.(i + 1, symbols.length);
  }
  return results;
}

export function clearQuoteCache() {
  quoteCache.clear();
}

type TimeRange = "1D" | "1W" | "1M" | "3M" | "1Y";

const RANGE_CONFIG: Record<TimeRange, { resolution: string; daysBack: number }> = {
  "1D": { resolution: "5", daysBack: 1 },
  "1W": { resolution: "15", daysBack: 7 },
  "1M": { resolution: "D", daysBack: 30 },
  "3M": { resolution: "D", daysBack: 90 },
  "1Y": { resolution: "W", daysBack: 365 },
};

const candleCache = new Map<string, { data: CandleData; ts: number }>();
const CANDLE_TTL = 300_000; // 5 min

export async function getCandles(symbol: string, range: TimeRange): Promise<CandleData | null> {
  const key = `${symbol}_${range}`;
  const cached = candleCache.get(key);
  if (cached && Date.now() - cached.ts < CANDLE_TTL) return cached.data;

  const cfg = RANGE_CONFIG[range];
  const to = Math.floor(Date.now() / 1000);
  const from = to - cfg.daysBack * 86400;

  const data = await callFinnhub("/stock/candle", {
    symbol,
    resolution: cfg.resolution,
    from: String(from),
    to: String(to),
  });

  if (!data || data.s !== "ok") return null;
  candleCache.set(key, { data, ts: Date.now() });
  return data;
}

const newsCache = new Map<string, { data: NewsArticle[]; ts: number }>();
const NEWS_TTL = 600_000; // 10 min

export async function getCompanyNews(symbol: string): Promise<NewsArticle[]> {
  const cached = newsCache.get(symbol);
  if (cached && Date.now() - cached.ts < NEWS_TTL) return cached.data;

  const to = new Date().toISOString().slice(0, 10);
  const fromDate = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

  const data = await callFinnhub("/company-news", { symbol, from: fromDate, to });
  const articles: NewsArticle[] = Array.isArray(data) ? data.slice(0, 5) : [];
  newsCache.set(symbol, { data: articles, ts: Date.now() });
  return articles;
}

export interface EarningsCalendarItem {
  date: string;
  epsActual: number | null;
  epsEstimate: number | null;
  hour: string; // "bmo" | "amc" | ""
  quarter: number;
  revenueActual: number | null;
  revenueEstimate: number | null;
  symbol: string;
  year: number;
}

let earningsCalendarCache: { data: EarningsCalendarItem[]; ts: number } | null = null;
const EARNINGS_CAL_TTL = 3600_000;

export async function getEarningsCalendar(from: string, to: string): Promise<EarningsCalendarItem[]> {
  if (earningsCalendarCache && Date.now() - earningsCalendarCache.ts < EARNINGS_CAL_TTL) {
    return earningsCalendarCache.data;
  }
  const data = await callFinnhub("/calendar/earnings", { from, to });
  const items: EarningsCalendarItem[] = data?.earningsCalendar ?? [];
  earningsCalendarCache = { data: items, ts: Date.now() };
  return items;
}

export interface EarningsSurprise {
  actual: number;
  estimate: number;
  period: string;
  quarter: number;
  surprise: number;
  surprisePercent: number;
  symbol: string;
  year: number;
}

const surpriseCache = new Map<string, { data: EarningsSurprise[]; ts: number }>();

export async function getEarningsSurprises(symbol: string): Promise<EarningsSurprise[]> {
  const cached = surpriseCache.get(symbol);
  if (cached && Date.now() - cached.ts < EARNINGS_CAL_TTL) return cached.data;
  const data = await callFinnhub("/stock/earnings", { symbol });
  const items: EarningsSurprise[] = Array.isArray(data) ? data : [];
  surpriseCache.set(symbol, { data: items, ts: Date.now() });
  return items;
}
