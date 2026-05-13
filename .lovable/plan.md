# Expand CompanyProfile and Capture Extra Fields

Scope: `src/services/marketData.ts` only. No other files change.

## 1. Expand the interface

Add 6 fields to `CompanyProfile` (lines 13–19):

```ts
export interface CompanyProfile {
  name: string;
  ticker: string;
  logo: string;
  finnhubIndustry: string;
  marketCapitalization: number;
  country: string;
  currency: string;
  exchange: string;
  ipo: string;
  shareOutstanding: number;
  weburl: string;
}
```

## 2. stock_lookup fallback path (lines 130–138)

Initialize the new fields with safe defaults (empty strings, `0`) so the object is type-complete before the background Finnhub enrichment fills them in:

```ts
const profile: CompanyProfile = {
  name: lookup.company_name,
  ticker: lookup.ticker,
  logo: "",
  finnhubIndustry: lookup.sector || "",
  marketCapitalization: 0,
  country: "",
  currency: "",
  exchange: "",
  ipo: "",
  shareOutstanding: 0,
  weburl: "",
};
```

## 3. Background enrichment (lines 140–148)

After the fire-and-forget `/stock/profile2` call resolves, copy every new field from the Finnhub response (with `??` defaults), then re-cache:

```ts
callFinnhub("/stock/profile2", { symbol })
  .then((data) => {
    if (data?.logo) {
      profile.logo = data.logo;
      if (data.marketCapitalization) profile.marketCapitalization = data.marketCapitalization;
      profile.country = data.country ?? "";
      profile.currency = data.currency ?? "";
      profile.exchange = data.exchange ?? "";
      profile.ipo = data.ipo ?? "";
      profile.shareOutstanding = data.shareOutstanding ?? 0;
      profile.weburl = data.weburl ?? "";
      profileCache.set(symbol, { data: profile, ts: Date.now() });
    }
  })
  .catch(() => {});
```

## 4. Direct Finnhub fallback path (lines 158–164)

When `stock_lookup` has no row and we go straight to Finnhub, capture all new fields too:

```ts
const profile: CompanyProfile = {
  name: data.name,
  ticker: data.ticker,
  logo: data.logo,
  finnhubIndustry: data.finnhubIndustry,
  marketCapitalization: data.marketCapitalization,
  country: data.country ?? "",
  currency: data.currency ?? "",
  exchange: data.exchange ?? "",
  ipo: data.ipo ?? "",
  shareOutstanding: data.shareOutstanding ?? 0,
  weburl: data.weburl ?? "",
};
```

## Out of scope

- No changes to other functions, caches, TTLs, or consumers of `CompanyProfile`.
- No UI changes (existing components ignore the new optional-feeling fields).
