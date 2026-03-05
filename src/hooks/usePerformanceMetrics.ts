import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { HoldingDisplay } from "@/hooks/usePortfolioData";

export function usePerformanceMetrics(holdings: HoldingDisplay[]) {
  const [twr, setTwr] = useState<number | null>(null);
  const [twrAvailable, setTwrAvailable] = useState(false);

  const totalValue = holdings.reduce((s, h) => s + h.positionValue, 0);
  const totalCost = holdings.reduce((s, h) => s + h.shares * h.avgCostBasis, 0);
  const simpleReturn = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : null;

  useEffect(() => {
    if (holdings.length === 0) return;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: trades } = await supabase
        .from("trade_journal")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: true });

      if (!trades || trades.length < 2) {
        setTwrAvailable(false);
        return;
      }

      setTwrAvailable(true);

      // TWR: chain-link sub-period returns between cash flow events
      // Each trade is a cash flow: BUY = positive cash in, SELL = negative cash out
      // We approximate sub-period returns using portfolio cost basis changes
      try {
        let product = 1;
        let runningCost = 0;

        for (let i = 0; i < trades.length; i++) {
          const t = trades[i];
          const cashFlow = t.action === "BUY"
            ? (t.shares ?? 0) * (t.price_at_action ?? 0)
            : -(t.shares ?? 0) * (t.price_at_action ?? 0);

          if (i > 0 && runningCost > 0) {
            // Estimate end value of previous period = running cost + accumulated return proportional to current simple return
            const prevEndValue = runningCost * (1 + (simpleReturn ?? 0) / 100 * (i / trades.length));
            const subReturn = (prevEndValue - runningCost) / runningCost;
            product *= (1 + subReturn);
          }

          runningCost += cashFlow;
          if (runningCost < 0) runningCost = 0;
        }

        // Final period: from last trade to now
        if (runningCost > 0) {
          const finalReturn = (totalValue - runningCost) / runningCost;
          product *= (1 + finalReturn);
        }

        const twrResult = (product - 1) * 100;
        setTwr(twrResult);
      } catch {
        setTwrAvailable(false);
      }
    })();
  }, [holdings, totalValue, simpleReturn]);

  return { simpleReturn, twr, twrAvailable };
}
