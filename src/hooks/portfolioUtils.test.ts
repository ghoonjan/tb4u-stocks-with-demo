import { describe, it, expect } from "vitest";
import { toDisplay } from "./portfolioUtils";
import type { DbHolding } from "./usePortfolioData";
import type { StockQuote } from "@/services/marketData";

const makeHolding = (overrides: Partial<DbHolding> = {}): DbHolding => ({
  id: "h1",
  ticker: "AAPL",
  company_name: "Apple Inc.",
  shares: 10,
  avg_cost_basis: 150,
  conviction_rating: 4,
  thesis: null,
  target_allocation_pct: null,
  notes: null,
  portfolio_id: "p1",
  date_added: "2025-01-01",
  ...overrides,
});

const makeQuote = (overrides: Partial<StockQuote> = {}): StockQuote => ({
  c: 170,
  d: 2,
  dp: 1.19,
  h: 172,
  l: 168,
  o: 168,
  pc: 168,
  t: 0,
  ...overrides,
});

describe("toDisplay", () => {
  it("calculates P&L correctly with quote", () => {
    const result = toDisplay(makeHolding(), makeQuote(), 1700);
    expect(result.currentPrice).toBe(170);
    expect(result.positionValue).toBe(1700);
    expect(result.totalPLDollar).toBe(200); // (170 - 150) * 10
    expect(result.totalPLPct).toBeCloseTo(13.33, 1); // 200 / 1500 * 100
  });

  it("falls back to avg_cost_basis when no quote", () => {
    const result = toDisplay(makeHolding(), null, 1500);
    expect(result.currentPrice).toBe(150);
    expect(result.totalPLDollar).toBe(0);
    expect(result.totalPLPct).toBe(0);
  });

  it("calculates weight as percentage of total", () => {
    const result = toDisplay(makeHolding(), makeQuote(), 5000);
    expect(result.weight).toBeCloseTo(34, 0); // 1700/5000*100
  });

  it("handles zero totalValue without division error", () => {
    const result = toDisplay(makeHolding(), makeQuote(), 0);
    expect(result.weight).toBe(0);
  });

  it("handles zero shares", () => {
    const result = toDisplay(makeHolding({ shares: 0 }), makeQuote(), 1000);
    expect(result.positionValue).toBe(0);
    expect(result.totalPLDollar).toBe(0);
    expect(result.totalPLPct).toBe(0);
  });

  it("maps day change from quote", () => {
    const result = toDisplay(makeHolding(), makeQuote({ d: -3, dp: -1.5 }), 1700);
    expect(result.dayChangeDollar).toBe(-3);
    expect(result.dayChangePct).toBe(-1.5);
  });

  it("defaults day change to 0 when no quote", () => {
    const result = toDisplay(makeHolding(), null, 1500);
    expect(result.dayChangeDollar).toBe(0);
    expect(result.dayChangePct).toBe(0);
  });

  it("converts target_allocation_pct to number", () => {
    const result = toDisplay(makeHolding({ target_allocation_pct: 25 }), null, 1500);
    expect(result.targetAllocationPct).toBe(25);
  });
});
