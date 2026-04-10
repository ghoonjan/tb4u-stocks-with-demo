import { describe, it, expect } from "vitest";
import { fmt, fmtDollar, fmtPct, fmtPL, plColor, plArrow } from "./index";

describe("fmt", () => {
  it("formats with default 2 decimals", () => {
    expect(fmt(1234.5)).toBe("1,234.50");
  });
  it("formats with custom decimals", () => {
    expect(fmt(1234.5678, 3)).toBe("1,234.568");
  });
  it("formats zero", () => {
    expect(fmt(0)).toBe("0.00");
  });
});

describe("fmtDollar", () => {
  it("formats positive", () => {
    expect(fmtDollar(1234.5)).toBe("$1,234.50");
  });
  it("formats negative as absolute", () => {
    expect(fmtDollar(-500)).toBe("$500.00");
  });
});

describe("fmtPct", () => {
  it("formats positive with +", () => {
    expect(fmtPct(12.345)).toBe("+12.35%");
  });
  it("formats negative with -", () => {
    expect(fmtPct(-3.5)).toBe("-3.50%");
  });
  it("formats zero as positive", () => {
    expect(fmtPct(0)).toBe("+0.00%");
  });
});

describe("fmtPL", () => {
  it("formats positive P&L", () => {
    expect(fmtPL(250)).toBe("+$250.00");
  });
  it("formats negative P&L", () => {
    expect(fmtPL(-100)).toBe("-$100.00");
  });
});

describe("plColor", () => {
  it("returns gain class for positive", () => {
    expect(plColor(1)).toBe("text-gain");
  });
  it("returns loss class for negative", () => {
    expect(plColor(-1)).toBe("text-loss");
  });
  it("returns gain class for zero", () => {
    expect(plColor(0)).toBe("text-gain");
  });
});

describe("plArrow", () => {
  it("returns up arrow for positive", () => {
    expect(plArrow(1)).toBe("▲");
  });
  it("returns down arrow for negative", () => {
    expect(plArrow(-1)).toBe("▼");
  });
});
