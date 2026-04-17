

## Fix Macro Strip: 10Y, VIX, DXY

### Root cause
The Finnhub free tier doesn't expose index symbols (`^TNX`, `^VIX`, `^DXY`), so the header was hardcoded to show "—" for **10Y** and **VIX**. **DXY** is labeled as the dollar index but actually fetches `UUP` (an ETF that trades ~$27 — that's the ETF share price, not the DXY index ~100). The screenshot shows "27.31" because that's UUP's price.

We need ETF proxies that Finnhub supports, with honest labels so users understand they're tracking proxies.

### Proxy mapping
| Strip label | ETF symbol | Tracks |
|---|---|---|
| 10Y (IEF) | `IEF` | iShares 7-10Y Treasury — inverse correlation to 10Y yield |
| VIX (VIXY) | `VIXY` | ProShares VIX short-term futures |
| USD (UUP) | `UUP` | Invesco US Dollar Bullish — directional proxy for DXY |

The labels include the proxy ticker in parentheses so the price makes sense at a glance (e.g. `USD (UUP) 27.31`) and it's clear these aren't the raw indices.

### Changes

1. **`src/constants/index.ts`** — expand `MACRO_SYMBOLS`:
   ```ts
   export const MACRO_SYMBOLS = ["SPY", "UUP", "IEF", "VIXY"] as const;
   ```

2. **`src/hooks/useMacroData.ts`** — extend `MacroData` and `fetchMacro`:
   ```ts
   export interface MacroData {
     spy: StockQuote | null;
     uup: StockQuote | null;
     ief: StockQuote | null;
     vixy: StockQuote | null;
   }
   // setMacroData with all four from quotes.get(...)
   ```

3. **`src/components/dashboard/PortfolioHeader.tsx`** — replace the two hardcoded `—` blocks and update DXY label:
   ```tsx
   <MacroItem label="10Y (IEF)" quote={macroData?.ief ?? null} />
   <MacroItem label="VIX (VIXY)" quote={macroData?.vixy ?? null} />
   <MacroItem label="USD (UUP)" quote={macroData?.uup ?? null} />
   ```

### Why this fix works
- All three new symbols are US-listed ETFs, fully supported on Finnhub's free tier and already routed through the existing L1+L2 cache
- No edge-function or schema changes needed
- Labels honestly reflect what's being shown (proxy ETF, not raw index)
- Color coding (`text-gain` / `text-loss` from `dp`) still works since ETF day-change percents are meaningful

### What changes
- `src/constants/index.ts` — 1 line
- `src/hooks/useMacroData.ts` — interface + 4 lines in setMacroData
- `src/components/dashboard/PortfolioHeader.tsx` — replace 3 macro blocks (lines 302-312)

No database migration, no edge function changes.

