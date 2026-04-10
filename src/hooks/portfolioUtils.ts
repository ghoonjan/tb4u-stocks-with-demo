import type { DbHolding, HoldingDisplay } from "./usePortfolioData";
import type { StockQuote } from "@/services/marketData";

export function toDisplay(h: DbHolding, quote: StockQuote | null, totalValue: number): HoldingDisplay {
  const price = quote?.c ?? h.avg_cost_basis;
  const positionValue = h.shares * price;
  const costBasis = h.shares * h.avg_cost_basis;
  const totalPL = positionValue - costBasis;
  return {
    id: h.id,
    ticker: h.ticker,
    companyName: h.company_name ?? "",
    shares: h.shares,
    avgCostBasis: h.avg_cost_basis,
    currentPrice: price,
    dayChangePct: quote?.dp ?? 0,
    dayChangeDollar: quote?.d ?? 0,
    totalPLDollar: totalPL,
    totalPLPct: costBasis > 0 ? (totalPL / costBasis) * 100 : 0,
    positionValue,
    weight: totalValue > 0 ? (positionValue / totalValue) * 100 : 0,
    convictionRating: h.conviction_rating,
    thesis: h.thesis,
    targetAllocationPct: h.target_allocation_pct != null ? Number(h.target_allocation_pct) : null,
    notes: h.notes,
    portfolioId: h.portfolio_id,
    divYield: null,
  };
}
