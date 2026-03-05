import { useState, useEffect, useCallback } from "react";
import { getEarningsCalendar, getEarningsSurprises, type EarningsCalendarItem, type EarningsSurprise } from "@/services/marketData";
import { FOMC_EVENT_DATES, CPI_DATES, NFP_DATES, GDP_DATES } from "@/constants";

export type EventType = "earnings" | "dividend" | "fed" | "economic";

export interface CalendarEvent {
  id: string;
  date: string;
  type: EventType;
  ticker?: string;
  title: string;
  description?: string;
  epsEstimate?: number | null;
  hour?: string;
  revenueEstimate?: number | null;
}

function getMacroEvents(): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  FOMC_EVENT_DATES.forEach((d) => events.push({ id: `fomc-${d}`, date: d, type: "fed", title: "FOMC Rate Decision", description: "Federal Reserve interest rate announcement" }));
  CPI_DATES.forEach((d) => events.push({ id: `cpi-${d}`, date: d, type: "economic", title: "CPI Report", description: "Consumer Price Index release" }));
  NFP_DATES.forEach((d) => events.push({ id: `nfp-${d}`, date: d, type: "economic", title: "Jobs Report (NFP)", description: "Non-Farm Payrolls release" }));
  GDP_DATES.forEach((d) => events.push({ id: `gdp-${d}`, date: d, type: "economic", title: "GDP Report", description: "Gross Domestic Product release" }));
  return events;
}

export function useEventsData(holdingTickers: string[], watchlistTickers: string[]) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const allTickers = [...new Set([...holdingTickers, ...watchlistTickers])];
  const tickersKey = allTickers.sort().join(",");

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const today = new Date();
    const end = new Date(today.getTime() + 30 * 86_400_000);
    const fromStr = today.toISOString().slice(0, 10);
    const toStr = end.toISOString().slice(0, 10);

    const result: CalendarEvent[] = [];
    const macros = getMacroEvents().filter((e) => e.date >= fromStr && e.date <= toStr);
    result.push(...macros);

    try {
      const earnings = await getEarningsCalendar(fromStr, toStr);
      const relevant = earnings.filter((e) => allTickers.includes(e.symbol));
      relevant.forEach((e) => {
        result.push({
          id: `earn-${e.symbol}-${e.date}`,
          date: e.date,
          type: "earnings",
          ticker: e.symbol,
          title: `${e.symbol} Earnings`,
          epsEstimate: e.epsEstimate,
          hour: e.hour,
          revenueEstimate: e.revenueEstimate,
        });
      });
    } catch { /* silent */ }

    result.sort((a, b) => a.date.localeCompare(b.date));
    setEvents(result);
    setLoading(false);
  }, [tickersKey]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  return { events, loading };
}

export async function fetchEarningsSurprises(symbol: string): Promise<EarningsSurprise[]> {
  return getEarningsSurprises(symbol);
}
