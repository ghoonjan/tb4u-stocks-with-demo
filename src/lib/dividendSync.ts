import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FinnhubDividend {
  symbol: string;
  date: string; // ex-dividend date
  payDate?: string;
  recordDate?: string;
  declarationDate?: string;
  amount: number;
  adjustedAmount?: number;
  currency?: string;
  freq?: number; // 0 annual, 1 monthly, 2 quarterly, 3 semi-annual, 4 special
}

const FREQ_MAP: Record<number, string> = {
  0: "annual",
  1: "monthly",
  2: "quarterly",
  3: "semi-annual",
  4: "other",
};

function inferFrequency(rows: FinnhubDividend[]): string {
  // Look at most recent year of dividends; count gives a hint
  if (!rows.length) return "quarterly";
  const withFreq = rows.find((r) => typeof r.freq === "number");
  if (withFreq && FREQ_MAP[withFreq.freq!]) return FREQ_MAP[withFreq.freq!];
  const oneYearAgo = Date.now() - 365 * 86400 * 1000;
  const recent = rows.filter((r) => new Date(r.date).getTime() >= oneYearAgo).length;
  if (recent >= 10) return "monthly";
  if (recent >= 3) return "quarterly";
  if (recent === 2) return "semi-annual";
  if (recent === 1) return "annual";
  return "quarterly";
}

async function fetchDividendsForTicker(ticker: string): Promise<FinnhubDividend[]> {
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 365 * 2 * 86400 * 1000).toISOString().slice(0, 10);
  const { data, error } = await supabase.functions.invoke("finnhub", {
    body: { endpoint: "/stock/dividend2", params: { symbol: ticker, from, to } },
  });
  if (error) {
    console.warn(`[dividendSync] finnhub error for ${ticker}`, error);
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data as FinnhubDividend[];
}

/**
 * Fetch recent dividend history for every holding the user owns
 * and insert any missing rows into the `dividends` table.
 * Idempotent: skips rows that already exist for (holding_id, ex_date).
 */
export async function syncDividendsForUser(userId: string): Promise<void> {
  // Find user's portfolio + holdings
  const { data: portfolios } = await supabase
    .from("portfolios")
    .select("id")
    .eq("user_id", userId)
    .eq("is_template", false);
  const portfolioId = portfolios?.[0]?.id;
  if (!portfolioId) return;

  const { data: holdings } = await supabase
    .from("holdings")
    .select("id, ticker, shares")
    .eq("portfolio_id", portfolioId);
  if (!holdings?.length) return;

  const { data: existing } = await supabase
    .from("dividends")
    .select("holding_id, ticker, ex_date, created_at")
    .eq("user_id", userId);
  const existingKeys = new Set(
    (existing || []).map((d) => `${d.holding_id}|${d.ex_date}`)
  );
  // Per-ticker freshness: skip Finnhub fetch if any row for this ticker was
  // inserted within the last 24 hours.
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const freshTickers = new Set(
    (existing || [])
      .filter((d) => d.created_at && new Date(d.created_at as string).getTime() >= dayAgo)
      .map((d) => (d.ticker || "").toUpperCase()),
  );

  for (const h of holdings) {
    try {
      if (freshTickers.has(h.ticker.toUpperCase())) continue;
      const rows = await fetchDividendsForTicker(h.ticker);
      if (!rows.length) continue;
      const frequency = inferFrequency(rows);
      const toInsert = rows
        .filter((r) => r.amount > 0 && r.date)
        .map((r) => ({
          user_id: userId,
          holding_id: h.id,
          ticker: h.ticker,
          amount_per_share: r.amount,
          shares_at_time: Number(h.shares),
          ex_date: r.date,
          pay_date: r.payDate || null,
          frequency,
          is_reinvested: false,
        }))
        .filter((d) => !existingKeys.has(`${d.holding_id}|${d.ex_date}`));

      if (toInsert.length) {
        const { error: insErr } = await supabase.from("dividends").insert(toInsert);
        if (insErr) console.warn(`[dividendSync] insert failed for ${h.ticker}`, insErr);
      }
    } catch (err) {
      console.warn(`[dividendSync] failed for ${h.ticker}`, err);
    }
  }
}

/**
 * Wrapper that shows a subtle background toast while syncing dividends.
 * Use after manual holding adds and CSV imports.
 */
export async function syncDividendsForUserWithToast(userId: string): Promise<void> {
  const toastId = toast.loading("Syncing dividend data…");
  try {
    await syncDividendsForUser(userId);
    toast.dismiss(toastId);
  } catch (err) {
    toast.dismiss(toastId);
    console.warn("[dividendSync] background sync failed", err);
  }
}
