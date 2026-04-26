import { describe, it, expect } from "vitest";
import { toDisplay, formatPurchaseDate, formatHoldingPeriod } from "./portfolioUtils";
import type { DbHolding } from "./usePortfolioData";
import type { StockQuote } from "@/services/marketData";

describe("formatPurchaseDate", () => {
  it("formats ISO date as 'Mon D, YYYY'", () => {
    expect(formatPurchaseDate("2024-06-15")).toBe("Jun 15, 2024");
  });
  it("trims a full timestamptz string", () => {
    expect(formatPurchaseDate("2024-01-15T12:34:56Z")).toBe("Jan 15, 2024");
  });
  it("returns em dash for empty input", () => {
    expect(formatPurchaseDate("")).toBe("—");
  });
});

describe("formatHoldingPeriod", () => {
  it("formats days under a year", () => {
    expect(formatHoldingPeriod(0)).toBe("0 days");
    expect(formatHoldingPeriod(1)).toBe("1 day");
    expect(formatHoldingPeriod(182)).toBe("182 days");
    expect(formatHoldingPeriod(364)).toBe("364 days");
  });
  it("formats one+ years with one decimal", () => {
    expect(formatHoldingPeriod(365)).toBe("1.0 years");
    expect(formatHoldingPeriod(548)).toBe("1.5 years");
    expect(formatHoldingPeriod(730)).toBe("2.0 years");
  });
  it("returns em dash for invalid input", () => {
    expect(formatHoldingPeriod(-5)).toBe("—");
    expect(formatHoldingPeriod(NaN)).toBe("—");
  });
});

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

  describe("purchase date / holding period", () => {
    const today = new Date().toISOString().slice(0, 10);
    const daysAgo = (n: number) => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - n);
      return d.toISOString();
    };

    it("maps date_added to purchaseDate as YYYY-MM-DD", () => {
      const r = toDisplay(makeHolding({ date_added: "2024-06-15T12:34:56Z" }), null, 0);
      expect(r.purchaseDate).toBe("2024-06-15");
    });

    it("computes holdingPeriodDays for a recent date", () => {
      const r = toDisplay(makeHolding({ date_added: daysAgo(10) }), null, 0);
      expect(r.holdingPeriodDays).toBe(10);
    });

    it("isLongTerm is false for a 100-day-old holding", () => {
      const r = toDisplay(makeHolding({ date_added: daysAgo(100) }), null, 0);
      expect(r.isLongTerm).toBe(false);
    });

    it("isLongTerm is true for a 400-day-old holding", () => {
      const r = toDisplay(makeHolding({ date_added: daysAgo(400) }), null, 0);
      expect(r.isLongTerm).toBe(true);
    });

    it("today's date yields 0 days and not long-term", () => {
      const r = toDisplay(makeHolding({ date_added: `${today}T08:00:00Z` }), null, 0);
      expect(r.holdingPeriodDays).toBe(0);
      expect(r.isLongTerm).toBe(false);
    });
  });
});
