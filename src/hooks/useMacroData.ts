import { useState, useEffect, useCallback } from "react";
import { getBatchQuotes, type StockQuote } from "@/services/marketData";
import { FOMC_DATES, MARKET_HOLIDAYS, MACRO_SYMBOLS, QUOTE_REFRESH_INTERVAL_MARKET, QUOTE_REFRESH_INTERVAL_OFF } from "@/constants";

export interface MacroData {
  spy: StockQuote | null;
  uup: StockQuote | null;
  ief: StockQuote | null;
  vixy: StockQuote | null;
}

export function getNextFomc(): { date: Date; daysAway: number; label: string } {
  const now = new Date();
  const next = FOMC_DATES.find((d) => d > now) ?? FOMC_DATES[FOMC_DATES.length - 1];
  const diff = Math.ceil((next.getTime() - now.getTime()) / 86_400_000);
  const label = next.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return { date: next, daysAway: diff, label };
}

function isMarketHoliday(et: Date): boolean {
  const y = et.getFullYear(), m = et.getMonth(), d = et.getDate();
  return MARKET_HOLIDAYS.some(([hy, hm, hd]) => hy === y && hm === m && hd === d);
}

export interface MarketStatus {
  label: string;
  color: string;
  border: string;
  bg: string;
  pulse: boolean;
}

export function getMarketStatus(): MarketStatus {
  const now = new Date();
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = et.getDay();
  const mins = et.getHours() * 60 + et.getMinutes();

  const closed: MarketStatus = { label: "Closed", color: "text-muted-foreground", border: "border-muted-foreground/30", bg: "bg-muted-foreground/10", pulse: false };

  if (day === 0 || day === 6 || isMarketHoliday(et)) return closed;
  if (mins >= 570 && mins < 960) return { label: "Market Open", color: "text-gain", border: "border-gain/30", bg: "bg-gain/10", pulse: true };
  if (mins >= 240 && mins < 570) return { label: "Pre-Market", color: "text-warning", border: "border-warning/30", bg: "bg-warning/10", pulse: true };
  if (mins >= 960 && mins < 1200) return { label: "After Hours", color: "text-warning", border: "border-warning/30", bg: "bg-warning/10", pulse: false };
  return closed;
}

export function isMarketOpen(): boolean {
  return getMarketStatus().pulse;
}

export function useMacroData() {
  const [macroData, setMacroData] = useState<MacroData>({ spy: null, uup: null, ief: null, vixy: null });
  const [loading, setLoading] = useState(true);

  const fetchMacro = useCallback(async () => {
    try {
      const quotes = await getBatchQuotes([...MACRO_SYMBOLS]);
      setMacroData({
        spy: quotes.get("SPY") ?? null,
        uup: quotes.get("UUP") ?? null,
        ief: quotes.get("IEF") ?? null,
        vixy: quotes.get("VIXY") ?? null,
      });
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMacro();
    const market = getMarketStatus();
    const interval = market.pulse ? QUOTE_REFRESH_INTERVAL_MARKET : QUOTE_REFRESH_INTERVAL_OFF;
    const id = setInterval(fetchMacro, interval);
    return () => clearInterval(id);
  }, [fetchMacro]);

  return { macroData, loading };
}
