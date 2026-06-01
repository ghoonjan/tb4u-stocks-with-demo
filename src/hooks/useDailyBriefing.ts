import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { HoldingDisplay } from "@/hooks/usePortfolioData";
import type { MacroData } from "@/hooks/useMacroData";

interface Briefing {
  id: string;
  content: string;
  briefing_date: string;
  generation_count: number;
  created_at: string;
}

interface UseDailyBriefingProps {
  holdings: HoldingDisplay[];
  totalValue: number;
  todayPL: number;
  todayPLPct: number;
  macroData?: MacroData;
}

function buildPortfolioContext(props: UseDailyBriefingProps) {
  const { holdings, totalValue, todayPL, todayPLPct, macroData } = props;

  const holdingsSummary = holdings
    .map((h) => `${h.ticker} (${h.weight.toFixed(1)}%, day: ${h.dayChangePct >= 0 ? "+" : ""}${h.dayChangePct.toFixed(2)}%)`)
    .join(", ");

  const bigMovers = [...holdings]
    .sort((a, b) => Math.abs(b.dayChangePct) - Math.abs(a.dayChangePct))
    .slice(0, 3)
    .map((h) => `${h.ticker} ${h.dayChangePct >= 0 ? "+" : ""}${h.dayChangePct.toFixed(2)}%`)
    .join(", ");

  const taxCandidates = holdings
    .filter((h) => h.totalPLDollar < 0)
    .map((h) => `${h.ticker} (unrealized loss ${h.totalPLPct.toFixed(1)}%)`)
    .join(", ");

  const driftHoldings = holdings.filter((h) => h.targetAllocationPct != null);
  const avgDrift = driftHoldings.length > 0
    ? driftHoldings.reduce((s, h) => s + Math.abs(h.weight - (h.targetAllocationPct ?? 0)), 0) / driftHoldings.length
    : 0;

  return {
    totalValue: `$${totalValue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
    todayPL: `${todayPL >= 0 ? "+" : ""}$${Math.abs(todayPL).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${todayPLPct >= 0 ? "+" : ""}${todayPLPct.toFixed(2)}%)`,
    holdings: holdingsSummary || "No holdings",
    upcomingEvents: "Check events tab for earnings and dividends this week",
    biggestMovers: bigMovers || "No significant movers",
    spyChange: macroData?.spy ? `${macroData.spy.dp >= 0 ? "+" : ""}${macroData.spy.dp.toFixed(2)}%` : "N/A",
    taxOpportunities: taxCandidates || "None — all positions profitable",
    driftStatus: driftHoldings.length > 0 ? `Average drift: ${avgDrift.toFixed(1)}%` : "No targets set",
  };
}

const STORAGE_KEY = "morning_brief_visible";

export function useDailyBriefing(props: UseDailyBriefingProps) {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState(true); // false if AI not configured
  // Visible only if user has explicitly opened it before (persisted) — no auto-load.
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "1";
  });

  const fetchBriefing = useCallback(async (regenerate = false) => {
    if (props.holdings.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("daily-briefing", {
        body: {
          portfolioContext: buildPortfolioContext(props),
          regenerate,
        },
      });

      if (fnError) {
        setError("Briefing unavailable. Check back later.");
        setLoading(false);
        return;
      }

      if (data?.error === "ai_not_configured") {
        setAvailable(false);
        setLoading(false);
        return;
      }

      if (data?.error === "max_regenerations") {
        setError("Maximum 3 briefings per day reached.");
        if (data.briefing) setBriefing(data.briefing);
        setLoading(false);
        return;
      }

      if (data?.error) {
        setError(data.error);
        setLoading(false);
        return;
      }

      if (data?.briefing) {
        setBriefing(data.briefing);
      }
    } catch {
      setError("Briefing unavailable. Check back later.");
    }

    setLoading(false);
  }, [props.holdings.length, props.totalValue, props.todayPL]);

  const regenerate = useCallback(() => fetchBriefing(true), [fetchBriefing]);

  const show = useCallback(() => {
    setVisible(true);
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
    if (!briefing && !loading && props.holdings.length > 0) {
      void fetchBriefing(false);
    }
  }, [briefing, loading, fetchBriefing, props.holdings.length]);

  const dismiss = useCallback(() => {
    setVisible(false);
    try { localStorage.setItem(STORAGE_KEY, "0"); } catch { /* ignore */ }
  }, []);

  // If the user previously had it open (persisted), fetch once when holdings load.
  useEffect(() => {
    if (visible && !briefing && !loading && props.holdings.length > 0) {
      void fetchBriefing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, props.holdings.length]);

  return { briefing, loading, error, available, dismissed: !visible, visible, regenerate, dismiss, show };
}
