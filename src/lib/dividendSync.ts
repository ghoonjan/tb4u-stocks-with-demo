import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { invalidateDividendCache } from "@/hooks/useDividends";

interface FinnhubMetricResponse {
  metric?: {
    dividendPerShareAnnual?: number;
    dividendYieldIndicatedAnnual?: number;
    payoutRatioAnnual?: number;
  };
  error?: string;
}

interface FinnhubDividendRow {
  symbol?: string;
  date?: string;
  payDate?: string;
  amount?: number;
  freq?: number;
}

const FREQ_TO_COUNT: Record<string, number> = {
  monthly: 12,
  quarterly: 4,
  "semi-annual": 2,
  annual: 1,
};

const FREQ_FROM_NUM: Record<number, string> = {
  0: "annual",
  1: "monthly",
  2: "quarterly",
  3: "semi-annual",
  4: "other",
};

async function callFinnhub<T>(endpoint: string, params: Record<string, string>): Promise<T | null> {
  const { data, error } = await supabase.functions.invoke("finnhub", {
    body: { endpoint, params },
  });
  if (error) {
    console.warn(`[dividendSync] finnhub error ${endpoint} ${JSON.stringify(params)}`, error);
    return null;
  }
  if (data && typeof data === "object" && "error" in (data as Record<string, unknown>)) {
    // Edge function returned a soft-fail envelope (rate_limit / API error)
    console.warn(`[dividendSync] finnhub soft-fail ${endpoint}`, data);
    return null;
  }
  return data as T;
}

/**
 * Try to get historical ex-dates from /stock/dividend2 (returns [] on free tier
 * for many tickers). Returns recent rows (last 12 months) or empty array.
 */
async function fetchHistoricalDividends(ticker: string): Promise<FinnhubDividendRow[]> {
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 365 * 86400 * 1000).toISOString().slice(0, 10);
  const rows = await callFinnhub<FinnhubDividendRow[]>("/stock/dividend2", {
    symbol: ticker,
    from,
    to,
  });
  if (!Array.isArray(rows)) return [];
  return rows.filter((r) => r && r.date && Number(r.amount) > 0);
}

function inferFrequencyFromCount(count: number): string {
  if (count >= 10) return "monthly";
  if (count >= 3) return "quarterly";
  if (count === 2) return "semi-annual";
  if (count === 1) return "annual";
  return "quarterly";
}

/**
 * Build projected ex-dates working backward from today, evenly spaced over the
 * last 12 months based on payment frequency.
 */
function generateProjectedExDates(frequency: string): string[] {
  const count = FREQ_TO_COUNT[frequency] ?? 4;
  const intervalDays = Math.floor(365 / count);
  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i * intervalDays);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

interface SyncResult {
  inserted: number;
  skipped: number;
  failed: string[];
}

/**
 * Fetch dividend data for every holding the user owns and insert any missing
 * rows into the `dividends` table.
 *
 * Strategy:
 *  1. First try /stock/dividend2 (real historical ex-dates + amounts).
 *  2. Fallback to /stock/metric.dividendPerShareAnnual and synthesize trailing
 *     12 months of projected payments. This is what makes the function work on
 *     the Finnhub free tier where /stock/dividend2 returns empty for most US
 *     equities.
 *
 * Idempotent: skips rows that already exist for (holding_id, ex_date).
 */
export async function syncDividendsForUser(userId: string): Promise<SyncResult> {
  const result: SyncResult = { inserted: 0, skipped: 0, failed: [] };

  const { data: portfolios } = await supabase
    .from("portfolios")
    .select("id")
    .eq("user_id", userId)
    .eq("is_template", false);
  const portfolioId = portfolios?.[0]?.id;
  if (!portfolioId) {
    console.warn(`[dividendSync] no portfolio for user ${userId}`);
    return result;
  }

  const { data: holdings } = await supabase
    .from("holdings")
    .select("id, ticker, shares")
    .eq("portfolio_id", portfolioId);
  if (!holdings?.length) return result;

  const { data: existing } = await supabase
    .from("dividends")
    .select("holding_id, ticker, ex_date, created_at")
    .eq("user_id", userId);
  const existingKeys = new Set(
    (existing || []).map((d) => `${d.holding_id}|${d.ex_date}`),
  );
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const freshTickers = new Set(
    (existing || [])
      .filter((d) => d.created_at && new Date(d.created_at as string).getTime() >= dayAgo)
      .map((d) => (d.ticker || "").toUpperCase()),
  );

  for (const h of holdings) {
    try {
      const tickerUpper = h.ticker.toUpperCase();
      if (freshTickers.has(tickerUpper)) {
        result.skipped++;
        continue;
      }
      const shares = Number(h.shares) || 0;

      // 1) Try real historical dividend data.
      const historical = await fetchHistoricalDividends(h.ticker);
      type DividendInsert = {
        user_id: string;
        holding_id: string;
        ticker: string;
        amount_per_share: number;
        shares_at_time: number;
        ex_date: string;
        pay_date: string | null;
        frequency: string;
        is_reinvested: boolean;
        notes?: string;
      };
      let toInsert: DividendInsert[] = [];

      if (historical.length > 0) {
        const freqRow = historical.find((r) => typeof r.freq === "number");
        const frequency =
          freqRow && FREQ_FROM_NUM[freqRow.freq!]
            ? FREQ_FROM_NUM[freqRow.freq!]
            : inferFrequencyFromCount(historical.length);
        toInsert = historical
          .map((r) => ({
            user_id: userId,
            holding_id: h.id,
            ticker: h.ticker,
            amount_per_share: Number(r.amount),
            shares_at_time: shares,
            ex_date: r.date!,
            pay_date: r.payDate || null,
            frequency,
            is_reinvested: false,
          }))
          .filter((d) => !existingKeys.has(`${d.holding_id}|${d.ex_date}`));
      } else {
        // 2) Fallback to /stock/metric — project trailing 12 months.
        const metric = await callFinnhub<FinnhubMetricResponse>("/stock/metric", {
          symbol: h.ticker,
          metric: "all",
        });
        const dps = Number(metric?.metric?.dividendPerShareAnnual ?? 0);
        if (!dps || dps <= 0) {
          const existingTickerData = (existing || []).some(
            (dividend) => (dividend.ticker || "").toUpperCase() === tickerUpper,
          );
          if (existingTickerData) {
            console.log('[dividendSync] preserving existing data for', h.ticker, '(Finnhub unavailable)');
          }
          console.info(`[dividendSync] no dividend data for ${h.ticker} (non-payer or unavailable)`);
          result.skipped++;
          continue;
        }
        const frequency = "quarterly"; // sensible default for US equities
        const perPayment = dps / (FREQ_TO_COUNT[frequency] ?? 4);
        const exDates = generateProjectedExDates(frequency);
        toInsert = exDates
          .map((ex_date) => ({
            user_id: userId,
            holding_id: h.id,
            ticker: h.ticker,
            amount_per_share: perPayment,
            shares_at_time: shares,
            ex_date,
            pay_date: null,
            frequency,
            is_reinvested: false,
            notes: "Projected from annual dividend rate",
          }))
          .filter((d) => !existingKeys.has(`${d.holding_id}|${d.ex_date}`));
      }

      if (toInsert.length) {
        const { error: insErr } = await supabase.from("dividends").insert(toInsert);
        if (insErr) {
          console.warn(`[dividendSync] insert failed for ${h.ticker}`, insErr);
          result.failed.push(h.ticker);
        } else {
          result.inserted += toInsert.length;
          for (const d of toInsert) {
            existingKeys.add(`${d.holding_id}|${d.ex_date}`);
          }
        }
      } else {
        result.skipped++;
      }
    } catch (err) {
      console.warn(`[dividendSync] failed for ${h.ticker}`, err);
      result.failed.push(h.ticker);
    }
  }

  if (result.inserted > 0) {
    invalidateDividendCache(userId);
  }
  console.info("[dividendSync] complete", result);
  return result;
}

/**
 * Wrapper that shows a subtle background toast while syncing dividends.
 * Use after manual holding adds, CSV imports, and manual refresh.
 */
export async function syncDividendsForUserWithToast(userId: string): Promise<SyncResult> {
  const toastId = toast.loading("Syncing dividend data…");
  try {
    const result = await syncDividendsForUser(userId);
    toast.dismiss(toastId);
    if (result.inserted > 0) {
      toast.success(`Synced ${result.inserted} dividend records`);
    } else if (result.failed.length > 0) {
      toast.warning(`Dividend sync had issues for ${result.failed.length} ticker(s)`);
    }
    return result;
  } catch (err) {
    toast.dismiss(toastId);
    toast.error("Dividend sync failed");
    console.warn("[dividendSync] background sync failed", err);
    return { inserted: 0, skipped: 0, failed: [] };
  }
}
