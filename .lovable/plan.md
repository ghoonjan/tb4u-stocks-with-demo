## Plan: Persist Finnhub enrichment back to stock_lookup

Single file change: `src/services/marketData.ts`, inside `getCompanyProfile`.

### Change 1 — Read new columns from stock_lookup (lines 133, 141–148)

Expand the select to include the new columns and populate the profile from them:

```ts
.select("ticker, company_name, sector, country, currency, exchange, ipo, market_cap, share_outstanding, weburl")
```

Profile build:
```ts
finnhubIndustry: lookup.sector || "",
country: lookup.country || "",
currency: lookup.currency || "",
exchange: lookup.exchange || "",
ipo: lookup.ipo || "",
marketCapitalization: lookup.market_cap || 0,
shareOutstanding: lookup.share_outstanding || 0,
weburl: lookup.weburl || "",
```

### Change 2 — Upsert Finnhub data back into stock_lookup (lines 152–166)

In the fire-and-forget `.then()` after updating cache, add a background upsert:

```ts
(supabase as any).from("stock_lookup").upsert({
  ticker: symbol.toUpperCase(),
  company_name: data.name || profile.name,
  sector: data.finnhubIndustry || profile.finnhubIndustry,
  country: data.country || "",
  currency: data.currency || "",
  exchange: data.exchange || "",
  ipo: data.ipo || "",
  market_cap: data.marketCapitalization || 0,
  share_outstanding: data.shareOutstanding || 0,
  weburl: data.weburl || "",
  updated_at: new Date().toISOString(),
}, { onConflict: "ticker" }).then(() => {}, () => {});
```

### Note on RLS

The `stock_lookup` table currently only has a public SELECT policy — no INSERT/UPDATE policy exists. The upsert will silently fail for authenticated users until a write policy is added. Will proceed as instructed; flagging so you can decide whether to add an RLS policy in a follow-up. Nothing else in the file changes.
