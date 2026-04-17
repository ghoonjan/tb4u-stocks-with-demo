
The user wants a Nasdaq 100 ticker added to the macro strip, matching how SPY is displayed for the S&P 500. The standard ETF proxy for the Nasdaq 100 is **QQQ** (Invesco QQQ Trust), which Finnhub's free tier supports.

Looking at the existing pattern: `SPY` is fetched via `MACRO_SYMBOLS`, stored in `macroData.spy`, and rendered in `PortfolioHeader.tsx` as a `MacroItem` labeled "S&P 500". I'll mirror this exactly for QQQ → "Nasdaq 100".

## Add Nasdaq 100 (QQQ) to Macro Strip

### Changes

1. **`src/constants/index.ts`** — add `QQQ` to `MACRO_SYMBOLS`:
   ```ts
   export const MACRO_SYMBOLS = ["SPY", "QQQ", "UUP", "IEF", "VIXY"] as const;
   ```

2. **`src/hooks/useMacroData.ts`** — extend `MacroData` interface and `setMacroData`:
   ```ts
   export interface MacroData {
     spy: StockQuote | null;
     qqq: StockQuote | null;
     uup: StockQuote | null;
     ief: StockQuote | null;
     vixy: StockQuote | null;
   }
   // add: qqq: quotes.get("QQQ") ?? null,
   ```

3. **`src/components/dashboard/PortfolioHeader.tsx`** — add a `MacroItem` for QQQ next to the SPY item:
   ```tsx
   <MacroItem label="Nasdaq 100 (QQQ)" quote={macroData?.qqq ?? null} />
   ```

### Why this works
- `QQQ` is a US-listed ETF fully supported by Finnhub's free tier
- Reuses the existing L1 + L2 cache and refresh interval logic — no edge function or DB changes
- Label format matches the recently updated proxies ("USD (UUP)", "10Y (IEF)", "VIX (VIXY)") for visual consistency

### What changes
- `src/constants/index.ts` — 1 line
- `src/hooks/useMacroData.ts` — interface field + 1 line in setMacroData
- `src/components/dashboard/PortfolioHeader.tsx` — 1 new `MacroItem` line next to SPY

No database migration, no edge function changes.
