import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the supabase client BEFORE importing the module under test
vi.mock("@/integrations/supabase/client", () => {
  const maybeSingle = vi.fn();
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const invoke = vi.fn();
  const getSession = vi.fn(async () => ({
    data: { session: { access_token: "tok" } },
  }));
  return {
    supabase: {
      from,
      functions: { invoke },
      auth: { getSession },
      __mocks: { from, select, eq, maybeSingle, invoke, getSession },
    },
  };
});

import { supabase } from "@/integrations/supabase/client";
import {
  getQuote,
  getCompanyProfile,
  getBasicFinancials,
  clearQuoteCache,
} from "./marketData";

const mocks = (supabase as any).__mocks as {
  from: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  invoke: ReturnType<typeof vi.fn>;
  getSession: ReturnType<typeof vi.fn>;
};

function resetAll() {
  mocks.from.mockClear();
  mocks.select.mockClear();
  mocks.eq.mockClear();
  mocks.maybeSingle.mockReset();
  mocks.invoke.mockReset();
  mocks.getSession.mockClear();
  clearQuoteCache();
}

describe("getQuote", () => {
  beforeEach(() => resetAll());

  it("fetches and caches a quote on first call", async () => {
    mocks.invoke.mockResolvedValueOnce({
      data: { c: 100, d: 1, dp: 1, h: 101, l: 99, o: 99.5, pc: 99 },
      error: null,
    });
    const q = await getQuote("AAPL");
    expect(q.c).toBe(100);
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
  });

  it("returns cached value without calling edge function again", async () => {
    mocks.invoke.mockResolvedValueOnce({
      data: { c: 50, d: 0, dp: 0, h: 0, l: 0, o: 0, pc: 0 },
      error: null,
    });
    await getQuote("MSFT");
    const q2 = await getQuote("MSFT");
    expect(q2.c).toBe(50);
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
  });

  it("throws INVALID_TICKER when c is 0", async () => {
    mocks.invoke.mockResolvedValueOnce({ data: { c: 0 }, error: null });
    await expect(getQuote("BADX")).rejects.toThrow("INVALID_TICKER");
  });

  it("throws when not authenticated", async () => {
    mocks.getSession.mockResolvedValueOnce({ data: { session: null } });
    await expect(getQuote("ZZZZ")).rejects.toThrow("NOT_AUTHENTICATED");
  });
});

describe("getCompanyProfile", () => {
  beforeEach(() => resetAll());

  it("returns profile from stock_lookup without calling Finnhub synchronously", async () => {
    mocks.maybeSingle.mockResolvedValueOnce({
      data: { ticker: "AAPL", company_name: "Apple Inc.", sector: "Tech" },
      error: null,
    });
    // background enrichment call resolves with no logo
    mocks.invoke.mockResolvedValue({ data: {}, error: null });

    const p = await getCompanyProfile("aapl");
    expect(p).toMatchObject({
      name: "Apple Inc.",
      ticker: "AAPL",
      finnhubIndustry: "Tech",
    });
    expect(mocks.from).toHaveBeenCalledWith("stock_lookup");
  });

  it("returns cached profile on second call (no DB hit)", async () => {
    mocks.maybeSingle.mockResolvedValueOnce({
      data: { ticker: "NVDA", company_name: "Nvidia", sector: "Semis" },
      error: null,
    });
    mocks.invoke.mockResolvedValue({ data: {}, error: null });
    await getCompanyProfile("NVDA");
    mocks.from.mockClear();
    const p2 = await getCompanyProfile("NVDA");
    expect(p2?.name).toBe("Nvidia");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("falls back to Finnhub when stock_lookup returns no row", async () => {
    mocks.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    // Use persistent mock so any leftover background enrichment from prior
    // tests (still draining the throttle queue) doesn't consume the response.
    mocks.invoke.mockResolvedValue({
      data: {
        name: "Foo Corp",
        ticker: "FOO",
        logo: "x.png",
        finnhubIndustry: "Misc",
        marketCapitalization: 123,
      },
      error: null,
    });
    const p = await getCompanyProfile("FOO");
    expect(p).toEqual({
      name: "Foo Corp",
      ticker: "FOO",
      logo: "x.png",
      finnhubIndustry: "Misc",
      marketCapitalization: 123,
    });
  });

  it("returns null when both lookup and Finnhub fail", async () => {
    mocks.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mocks.invoke.mockResolvedValueOnce({ data: null, error: { message: "x" } });
    const p = await getCompanyProfile("UNKNOWN");
    expect(p).toBeNull();
  });
});

describe("getBasicFinancials", () => {
  beforeEach(() => resetAll());

  it("maps metric fields and caches the result", async () => {
    mocks.invoke.mockResolvedValueOnce({
      data: {
        metric: {
          dividendYieldIndicatedAnnual: 1.5,
          "52WeekHigh": 200,
          "52WeekLow": 100,
          peNormalizedAnnual: 25,
        },
      },
      error: null,
    });
    const f = await getBasicFinancials("AAPL");
    expect(f.dividendYieldIndicatedAnnual).toBe(1.5);
    expect(f["52WeekHigh"]).toBe(200);

    const f2 = await getBasicFinancials("AAPL");
    expect(f2).toBe(f);
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
  });
});
