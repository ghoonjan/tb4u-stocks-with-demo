// ─── FOMC Dates 2025-2026 ────────────────────────────────────────
export const FOMC_DATES = [
  new Date("2025-03-19"), new Date("2025-05-07"), new Date("2025-06-18"),
  new Date("2025-07-30"), new Date("2025-09-17"), new Date("2025-10-29"),
  new Date("2025-12-17"), new Date("2026-01-28"), new Date("2026-03-18"),
  new Date("2026-05-06"), new Date("2026-06-17"), new Date("2026-07-29"),
  new Date("2026-09-16"), new Date("2026-10-28"), new Date("2026-12-16"),
];

// ─── FOMC String Dates for Events ────────────────────────────────
export const FOMC_EVENT_DATES = [
  "2025-03-19","2025-05-07","2025-06-18","2025-07-30","2025-09-17","2025-10-29","2025-12-17",
  "2026-01-28","2026-03-18","2026-05-06","2026-06-17","2026-07-29","2026-09-16","2026-10-28","2026-12-16",
];

// ─── CPI Report Dates ────────────────────────────────────────────
export const CPI_DATES = [
  "2025-03-12","2025-04-10","2025-05-13","2025-06-11","2025-07-10","2025-08-12","2025-09-10","2025-10-14","2025-11-12","2025-12-10",
  "2026-01-13","2026-02-11","2026-03-11","2026-04-14","2026-05-12","2026-06-10","2026-07-14","2026-08-12","2026-09-15","2026-10-13","2026-11-10","2026-12-09",
];

// ─── NFP Report Dates ────────────────────────────────────────────
export const NFP_DATES = [
  "2025-03-07","2025-04-04","2025-05-02","2025-06-06","2025-07-03","2025-08-01","2025-09-05","2025-10-03","2025-11-07","2025-12-05",
  "2026-01-02","2026-02-06","2026-03-06","2026-04-03","2026-05-01","2026-06-05","2026-07-02","2026-08-07","2026-09-04","2026-10-02","2026-11-06","2026-12-04",
];

// ─── GDP Report Dates ────────────────────────────────────────────
export const GDP_DATES = [
  "2025-03-27","2025-06-26","2025-09-25","2025-12-23",
  "2026-03-26","2026-06-25","2026-09-24","2026-12-22",
];

// ─── US Market Holidays 2025-2026 (month 0-indexed) ─────────────
export const MARKET_HOLIDAYS: Array<[number, number, number]> = [
  [2025, 0, 1], [2025, 0, 20], [2025, 1, 17], [2025, 3, 18], [2025, 4, 26],
  [2025, 5, 19], [2025, 6, 4], [2025, 8, 1], [2025, 10, 27], [2025, 11, 25],
  [2026, 0, 1], [2026, 0, 19], [2026, 1, 16], [2026, 3, 3], [2026, 4, 25],
  [2026, 5, 19], [2026, 6, 3], [2026, 8, 7], [2026, 10, 26], [2026, 11, 25],
];

// ─── Sector Chart Colors ────────────────────────────────────────
export const SECTOR_COLORS = [
  "hsl(217, 91%, 60%)", "hsl(142, 71%, 45%)", "hsl(0, 84%, 60%)", "hsl(38, 92%, 50%)",
  "hsl(280, 65%, 60%)", "hsl(190, 90%, 50%)", "hsl(330, 70%, 55%)", "hsl(60, 70%, 50%)",
  "hsl(160, 60%, 45%)", "hsl(25, 85%, 55%)", "hsl(210, 50%, 50%)", "hsl(300, 40%, 50%)",
];

// ─── Macro Proxy Symbols ────────────────────────────────────────
export const MACRO_SYMBOLS = ["SPY", "UUP", "IEF", "VIXY"] as const;

// ─── Limits ─────────────────────────────────────────────────────
export const MAX_WATCHLIST = 30;
export const QUOTE_REFRESH_INTERVAL_MARKET = 60_000;     // 60s during market hours
export const QUOTE_REFRESH_INTERVAL_OFF = 300_000;        // 5 min outside market hours
export const NEWS_REFRESH_INTERVAL = 300_000;              // 5 min

// ─── Trade Journal ──────────────────────────────────────────────
export const EXIT_REASONS = [
  "Thesis played out (target reached)",
  "Thesis broken",
  "Better opportunity elsewhere",
  "Risk management / stop loss",
  "Taking profits",
  "Tax-loss harvesting",
  "Other",
];

export const GRADE_COLORS: Record<string, string> = {
  A: "bg-gain/20 text-gain",
  B: "bg-gain/10 text-gain/80",
  C: "bg-warning/15 text-warning",
  D: "bg-loss/10 text-loss/80",
  F: "bg-loss/20 text-loss",
};

export const GRADES = [
  { grade: "A", label: "Excellent decision, well-timed", color: "bg-gain text-gain-foreground" },
  { grade: "B", label: "Good decision, could've been better", color: "bg-gain/60 text-foreground" },
  { grade: "C", label: "Okay, no strong opinion", color: "bg-warning/60 text-foreground" },
  { grade: "D", label: "Regret it somewhat", color: "bg-loss/50 text-foreground" },
  { grade: "F", label: "Bad decision, learned a lesson", color: "bg-loss text-destructive-foreground" },
];

// ─── Tooltip Styles (Recharts) ──────────────────────────────────
export const CHART_TOOLTIP_STYLE = {
  background: "hsl(240 16% 8%)",
  border: "1px solid hsl(240 14% 16%)",
  borderRadius: 8,
  fontSize: 11,
};
export const CHART_TOOLTIP_ITEM_STYLE = { color: "hsl(215 25% 91%)" };

// ─── Formatters ─────────────────────────────────────────────────
export const fmt = (n: number, decimals = 2) =>
  n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
export const fmtDollar = (n: number) => "$" + fmt(Math.abs(n));
export const fmtPct = (n: number) => (n >= 0 ? "+" : "-") + fmt(Math.abs(n), 2) + "%";
export const fmtPL = (n: number) => (n >= 0 ? "+" : "-") + "$" + fmt(Math.abs(n));
export const plColor = (n: number) => (n >= 0 ? "text-gain" : "text-loss");
export const plArrow = (n: number) => (n >= 0 ? "▲" : "▼");
