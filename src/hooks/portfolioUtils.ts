import type { DbHolding, HoldingDisplay } from "./usePortfolioData";
import type { StockQuote } from "@/services/marketData";

const MS_PER_DAY = 86_400_000;

export function toDisplay(h: DbHolding, quote: StockQuote | null, totalValue: number): HoldingDisplay {
  const price = quote?.c ?? h.avg_cost_basis;
  const positionValue = h.shares * price;
  const costBasis = h.shares * h.avg_cost_basis;
  const totalPL = positionValue - costBasis;

  // Normalize date_added (timestamptz) to YYYY-MM-DD
  const purchaseDate = (h.date_added ?? "").slice(0, 10);
  let holdingPeriodDays = 0;
  if (purchaseDate) {
    const purchaseMs = new Date(purchaseDate).getTime();
    const todayMs = new Date(new Date().toISOString().slice(0, 10)).getTime();
    holdingPeriodDays = Math.max(0, Math.floor((todayMs - purchaseMs) / MS_PER_DAY));
  }
  const isLongTerm = holdingPeriodDays > 365;

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
    purchaseDate,
    holdingPeriodDays,
    isLongTerm,
  };
}
