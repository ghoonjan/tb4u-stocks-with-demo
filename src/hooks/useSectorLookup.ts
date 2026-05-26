import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SectorLookupEntry {
  sector: string | null;
  assetType: string | null;
}

/**
 * Queries the local `stock_lookup` table directly for the given tickers and
 * returns a Map<ticker(UPPER), { sector, assetType }>. No retries, no timeouts,
 * no Finnhub fallbacks — this is just a fast local DB read.
 */
export function useSectorLookup(tickers: string[]) {
  const [lookup, setLookup] = useState<Map<string, SectorLookupEntry>>(new Map());
  const [loading, setLoading] = useState(true);
  const key = Array.from(new Set(tickers.map((t) => t.toUpperCase()))).sort().join(",");

  useEffect(() => {
    let cancelled = false;
    const upper = key ? key.split(",") : [];
    if (upper.length === 0) {
      setLookup(new Map());
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      try {
        const { data } = await supabase
          .from("stock_lookup")
          .select("ticker, sector, asset_type")
          .in("ticker", upper);
        if (cancelled) return;
        const map = new Map<string, SectorLookupEntry>();
        for (const row of data || []) {
          map.set(String(row.ticker || "").toUpperCase(), {
            sector: row.sector ?? null,
            assetType: (row.asset_type as string | null) ?? null,
          });
        }
        setLookup(map);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [key]);

  return { lookup, loading };
}

const BAD_SECTOR = new Set(["", "n/a", "unknown", "—", "-", "null"]);

/**
 * Resolve a sector label for a ticker using the local stock_lookup map.
 * Case-insensitive asset_type check. Returns:
 *   - the sector from stock_lookup if present and meaningful
 *   - "ETF/Fund" if the ticker exists in stock_lookup with asset_type ~ ETF
 *   - "Other" otherwise (no sector available, or not an ETF)
 */
export function resolveSector(
  ticker: string,
  lookup: Map<string, SectorLookupEntry>,
): string {
  const entry = lookup.get(ticker.toUpperCase());
  const sector = entry?.sector?.trim() ?? "";
  if (sector && !BAD_SECTOR.has(sector.toLowerCase())) return sector;
  const assetType = (entry?.assetType ?? "").trim().toLowerCase();
  if (assetType === "etf" || assetType === "fund" || assetType.includes("etf")) {
    return "ETF/Fund";
  }
  return "Other";
}
