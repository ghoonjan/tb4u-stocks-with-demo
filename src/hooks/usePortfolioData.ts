import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";
import { getBatchQuotes, getBasicFinancials, type StockQuote, type BasicFinancials } from "@/services/marketData";
import { getMarketStatus } from "@/hooks/useMacroData";
import { QUOTE_REFRESH_INTERVAL_MARKET, QUOTE_REFRESH_INTERVAL_OFF } from "@/constants";

export type DbHolding = Tables<"holdings">;
export type DbWatchlistItem = Tables<"watchlist">;

export interface HoldingDisplay {
  id: string;
  ticker: string;
  companyName: string;
  shares: number;
  avgCostBasis: number;
  currentPrice: number;
  dayChangePct: number;
  dayChangeDollar: number;
  totalPLDollar: number;
  totalPLPct: number;
  positionValue: number;
  weight: number;
  convictionRating: number;
  thesis: string | null;
  targetAllocationPct: number | null;
  notes: string | null;
  portfolioId: string;
  divYield: number | null;
  purchaseDate: string;
  holdingPeriodDays: number;
  isLongTerm: boolean;
}

// toDisplay extracted to portfolioUtils.ts for testability
import { toDisplay } from "./portfolioUtils";

export function usePortfolioData() {
  const [portfolioId, setPortfolioId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [holdings, setHoldings] = useState<HoldingDisplay[]>([]);
  const [watchlist, setWatchlist] = useState<DbWatchlistItem[]>([]);
  const [watchlistQuotes, setWatchlistQuotes] = useState<Map<string, StockQuote>>(new Map());
  const [watchlistFinancials, setWatchlistFinancials] = useState<Map<string, BasicFinancials>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [priceError, setPriceError] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rawHoldingsRef = useRef<DbHolding[]>([]);
  const watchlistRef = useRef<DbWatchlistItem[]>([]);

  const applyQuotes = useCallback((rawHoldings: DbHolding[], quotes: Map<string, StockQuote>) => {
    let totalValue = 0;
    for (const h of rawHoldings) {
      const q = quotes.get(h.ticker);
      totalValue += h.shares * (q?.c ?? h.avg_cost_basis);
    }
    const displayed = rawHoldings.map((h) => toDisplay(h, quotes.get(h.ticker) ?? null, totalValue));
    setHoldings(displayed);
    setLastUpdated(new Date());
    setPriceError(false);
  }, []);

  const fetchWatchlistData = useCallback(async (wl: DbWatchlistItem[]) => {
    if (wl.length === 0) { setWatchlistQuotes(new Map()); setWatchlistFinancials(new Map()); return; }
    const holdingTickers = new Set(rawHoldingsRef.current.map((h) => h.ticker));
    const wlOnlyTickers = [...new Set(wl.map((w) => w.ticker).filter((t) => !holdingTickers.has(t)))];
    if (wlOnlyTickers.length > 0) {
      try {
        const q = await getBatchQuotes(wlOnlyTickers);
        setWatchlistQuotes((prev) => { const n = new Map(prev); q.forEach((v, k) => n.set(k, v)); return n; });
      } catch { /* skip */ }
    }
    const finMap = new Map<string, BasicFinancials>();
    for (const w of wl) {
      try {
        const f = await getBasicFinancials(w.ticker);
        finMap.set(w.ticker, f);
      } catch { /* skip */ }
    }
    setWatchlistFinancials(finMap);
  }, []);

  const fetchQuotes = useCallback(async (rawHoldings: DbHolding[], isInitial = false) => {
    if (rawHoldings.length === 0) return;
    const tickers = [...new Set(rawHoldings.map((h) => h.ticker))];
    if (!isInitial) setRefreshing(true);
    try {
      const quotes = await getBatchQuotes(tickers);
      applyQuotes(rawHoldings, quotes);
      setWatchlistQuotes((prev) => {
        const n = new Map(prev);
        quotes.forEach((v, k) => n.set(k, v));
        return n;
      });
    } catch {
      setPriceError(true);
      toast({ title: "Price data delayed", description: "Could not fetch latest prices.", variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  }, [applyQuotes]);

  const fetchData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const uid = session.user.id;
    setUserId(uid);

    const { data: portfolios } = await supabase
      .from("portfolios")
      .select("*")
      .eq("user_id", uid)
      .eq("is_template", false)
      .order("created_at", { ascending: true })
      .limit(1);
    const pid = portfolios?.[0]?.id;
    if (!pid) { setLoading(false); return; }
    setPortfolioId(pid);

    const [holdingsRes, watchlistRes] = await Promise.all([
      supabase.from("holdings").select("*").eq("portfolio_id", pid),
      supabase.from("watchlist").select("*").eq("user_id", uid).order("date_added", { ascending: false }),
    ]);

    const rawHoldings = holdingsRes.data ?? [];
    rawHoldingsRef.current = rawHoldings;
    const wl = watchlistRes.data ?? [];
    watchlistRef.current = wl;
    setWatchlist(wl);

    if (rawHoldings.length === 0 && wl.length === 0) {
      setHoldings([]);
      setLoading(false);
      return;
    }

    if (rawHoldings.length > 0) await fetchQuotes(rawHoldings, true);
    fetchWatchlistData(wl);
    setLoading(false);
  }, [fetchQuotes, fetchWatchlistData]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Smart refresh: 60s during market hours, 5min outside
  useEffect(() => {
    const scheduleRefresh = () => {
      const market = getMarketStatus();
      const interval = market.pulse ? QUOTE_REFRESH_INTERVAL_MARKET : QUOTE_REFRESH_INTERVAL_OFF;
      intervalRef.current = setInterval(() => {
        if (rawHoldingsRef.current.length > 0) {
          fetchQuotes(rawHoldingsRef.current);
        }
      }, interval);
    };
    scheduleRefresh();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchQuotes]);

  // Supabase realtime subscription for holdings changes
  useEffect(() => {
    if (!portfolioId) return;
    const channel = supabase
      .channel('holdings-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'holdings', filter: `portfolio_id=eq.${portfolioId}` },
        () => { fetchData(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [portfolioId, fetchData]);

  // Realtime for watchlist changes
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('watchlist-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'watchlist', filter: `user_id=eq.${userId}` },
        () => { fetchData(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, fetchData]);

  const addHolding = async (data: {
    ticker: string; company_name: string; shares: number; avg_cost_basis: number;
    conviction_rating: number; thesis?: string; target_allocation_pct?: number;
    date_added: string;
  }) => {
    if (!portfolioId) return false;
    const { data: inserted, error } = await supabase.from("holdings").insert({
      portfolio_id: portfolioId, ticker: data.ticker.toUpperCase(),
      company_name: data.company_name, shares: data.shares,
      avg_cost_basis: data.avg_cost_basis, conviction_rating: data.conviction_rating,
      thesis: data.thesis || null, target_allocation_pct: data.target_allocation_pct || null,
      date_added: data.date_added,
    }).select("id").single();
    if (error || !inserted) { toast({ title: "Error", description: error?.message ?? "Insert failed", variant: "destructive" }); return false; }

    // Seed initial tax lot from the holding's shares/cost/date
    const { error: lotError } = await supabase.from("tax_lots").insert({
      holding_id: inserted.id,
      shares: data.shares,
      shares_remaining: data.shares,
      cost_basis_per_share: data.avg_cost_basis,
      purchased_at: data.date_added.slice(0, 10),
    });
    if (lotError) {
      toast({ title: "Holding added, lot failed", description: lotError.message, variant: "destructive" });
    }

    await fetchData();
    toast({ title: "Holding added", description: `${data.ticker.toUpperCase()} added to portfolio.` });
    return true;
  };

  // Editing a holding now only changes meta fields. Shares, avg cost, and date_added
  // are derived from tax_lots and must not be overwritten here.
  const updateHolding = async (id: string, data: {
    ticker: string; company_name: string;
    conviction_rating: number; thesis?: string; target_allocation_pct?: number;
  }) => {
    const { error } = await supabase.from("holdings").update({
      ticker: data.ticker.toUpperCase(), company_name: data.company_name,
      conviction_rating: data.conviction_rating,
      thesis: data.thesis || null, target_allocation_pct: data.target_allocation_pct || null,
    }).eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return false; }
    await fetchData();
    toast({ title: "Holding updated", description: `${data.ticker.toUpperCase()} updated.` });
    return true;
  };

  const deleteHolding = async (id: string, ticker: string) => {
    const { error } = await supabase.from("holdings").delete().eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    await fetchData();
    toast({ title: "Holding removed", description: `${ticker} removed from portfolio.` });
  };

  const addToWatchlist = async (data: { ticker: string; company_name?: string; target_price?: number; notes?: string }) => {
    if (!userId) return false;
    if (watchlist.length >= 30) { toast({ title: "Watchlist full", description: "Maximum 30 items.", variant: "destructive" }); return false; }
    const { error } = await supabase.from("watchlist").insert({
      user_id: userId, ticker: data.ticker.toUpperCase(),
      company_name: data.company_name || null, target_price: data.target_price || null,
      notes: data.notes || null,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return false; }
    await fetchData();
    toast({ title: "Added to watchlist", description: `${data.ticker.toUpperCase()} added.` });
    return true;
  };

  const updateWatchlistItem = async (id: string, data: { target_price?: number | null }) => {
    const { error } = await supabase.from("watchlist").update({
      target_price: data.target_price ?? null,
    }).eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    await fetchData();
  };

  const deleteWatchlistItem = async (id: string) => {
    await supabase.from("watchlist").delete().eq("id", id);
    await fetchData();
  };

  const moveWatchlistToPortfolio = async (ticker: string, _companyName: string) => {
    const item = watchlist.find((w) => w.ticker === ticker);
    if (item) {
      await supabase.from("watchlist").delete().eq("id", item.id);
    }
  };

  const totalValue = holdings.reduce((s, h) => s + h.positionValue, 0);
  const todayPL = holdings.reduce((s, h) => s + h.dayChangeDollar * h.shares, 0);
  const todayPLPct = totalValue - todayPL > 0 ? (todayPL / (totalValue - todayPL)) * 100 : 0;

  return {
    portfolioId, userId, holdings, watchlist, watchlistQuotes, watchlistFinancials, loading, totalValue,
    todayPL, todayPLPct, refreshing, lastUpdated, priceError,
    addHolding, updateHolding, deleteHolding, addToWatchlist, updateWatchlistItem, deleteWatchlistItem, moveWatchlistToPortfolio, refetch: fetchData,
  };
}
