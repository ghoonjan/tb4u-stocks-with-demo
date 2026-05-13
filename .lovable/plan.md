# Portfolio Insights Utility

Create `src/utils/portfolioInsights.ts` — pure TypeScript, no deps.

## Exports

```ts
import type { CompanyProfile } from "@/services/marketData";

export interface HoldingInput {
  ticker: string;
  companyName: string;
  currentValue: number;
  profile: CompanyProfile | null;
}

export interface BreakdownEntry {
  category: string;
  percentage: number;
  holdings: string[];
}
export interface GeoEntry { country: string; percentage: number; holdings: string[]; }
export interface SectorEntry { sector: string; percentage: number; holdings: string[]; }

export interface PortfolioAlert {
  level: "red" | "yellow" | "green";
  title: string;
  description: string;
}

export interface PortfolioInsights {
  marketCapBreakdown: BreakdownEntry[];
  geographicBreakdown: GeoEntry[];
  sectorBreakdown: SectorEntry[];
  maturityBreakdown: BreakdownEntry[];
  alerts: PortfolioAlert[];
}

export function analyzePortfolio(holdings: HoldingInput[]): PortfolioInsights;
```

## Logic

**Total weight basis:** `total = sum(currentValue)` across ALL holdings (including ones missing profile data). Each breakdown excludes only the rows missing the relevant field, but percentages are still computed as `bucketValue / total * 100`.

**Helper** `bucketize(rows, keyFn, orderedCategories?)`:
- Group `{ticker, currentValue}` by `keyFn(row)` (skip if `null`/empty).
- For each bucket emit `{ category|country|sector, percentage: sum/total*100, holdings: [tickers] }`.
- If `orderedCategories` supplied → return in that order, including zero-value buckets omitted (only emit buckets with ≥1 holding). Otherwise sort by percentage desc.

### 1. marketCapBreakdown
Categorize by `profile.marketCapitalization` (millions, must be > 0):
- `> 200000` → "Mega Cap"
- `10000–200000` → "Large Cap"
- `2000–10000` → "Mid Cap"
- `300–2000` → "Small Cap"
- `> 0 && < 300` → "Micro Cap"

Output in this fixed order, omit empty buckets.

### 2. geographicBreakdown
Group by `profile.country` (skip empty). Sort by percentage desc.

### 3. sectorBreakdown
Group by `profile.finnhubIndustry` (skip empty). Sort by percentage desc.

### 4. maturityBreakdown
Compute age from `profile.ipo` (YYYY-MM-DD; skip if empty/invalid):
`ageYears = (Date.now() - new Date(ipo).getTime()) / (365.25 * 86_400_000)`
- `>= 20` → "Established (20+ yrs)"
- `>= 10` → "Mature (10-20 yrs)"
- `>= 5` → "Growth (5-10 yrs)"
- `< 5` → "Young (< 5 yrs)"

Output in this fixed order, omit empty buckets.

### 5. alerts

Compute three alerts (always emitted, exactly one per rule). Use the **max** percentage from the relevant breakdown.

- **Sector:** max sector pct
  - `> 40` → red, title `"High sector concentration"`, desc names the sector + percentage
  - `> 30` → yellow, title `"Elevated sector concentration"`, desc same
  - else → green, title `"Good sector diversification"`, desc summarizes top sector

- **Country:** max country pct
  - `> 85` → red `"Heavy geographic concentration"`
  - `> 70` → yellow `"Elevated geographic concentration"`
  - else → green `"Good geographic spread"`

- **Mega cap:** percentage of "Mega Cap" bucket (0 if none)
  - `> 80` → red `"Heavy mega-cap concentration"`
  - `> 60` → yellow `"Elevated mega-cap concentration"`
  - else → green `"Good market cap spread"`

If a breakdown is empty (no profile data anywhere), still emit a green alert with a neutral description ("No data available yet").

## Edge cases
- `total === 0` → return all empty arrays + 3 green "no data" alerts.
- `holdings.length === 0` → same.
- Percentages stored as numbers (not rounded) — UI handles display formatting.

## Out of scope
No UI, no tests in this step, no changes to other files.
