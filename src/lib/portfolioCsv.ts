// CSV utilities for portfolio holdings + tax_lots import/export.
import { supabase } from "@/integrations/supabase/client";

export const CSV_COLUMNS = [
  "ticker",
  "company_name",
  "purchased_at",
  "shares",
  "shares_remaining",
  "cost_basis_per_share",
  "conviction_rating",
  "thesis",
  "target_allocation_pct",
  "notes",
] as const;

export type CsvColumn = (typeof CSV_COLUMNS)[number];

export const MAX_IMPORT_ROWS = 500;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

const csvEscape = (val: unknown): string => {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const fmtNum = (n: number | null | undefined, decimals = 2): string => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "";
  return Number(n).toFixed(decimals);
};

const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return "";
  return iso.slice(0, 10);
};

export interface ExportRow {
  ticker: string;
  company_name: string | null;
  purchased_at: string;
  shares: number;
  shares_remaining: number;
  cost_basis_per_share: number;
  conviction_rating: number;
  thesis: string | null;
  target_allocation_pct: number | null;
  notes: string | null;
}

export function exportRowsToCsv(rows: ExportRow[]): string {
  const header = CSV_COLUMNS.join(",");
  const body = rows.map((r) =>
    [
      csvEscape(r.ticker),
      csvEscape(r.company_name ?? ""),
      csvEscape(fmtDate(r.purchased_at)),
      csvEscape(fmtNum(r.shares)),
      csvEscape(fmtNum(r.shares_remaining)),
      csvEscape(fmtNum(r.cost_basis_per_share)),
      csvEscape(r.conviction_rating ?? 3),
      csvEscape(r.thesis ?? ""),
      csvEscape(r.target_allocation_pct != null ? fmtNum(r.target_allocation_pct) : ""),
      csvEscape(r.notes ?? ""),
    ].join(","),
  );
  return [header, ...body].join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function buildExportFilename(d = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `portfolio_export_${yyyy}-${mm}-${dd}.csv`;
}

export const TEMPLATE_CSV = [
  CSV_COLUMNS.join(","),
  "AAPL,Apple Inc,2024-03-15,10,10,145.50,4,Long term growth,,",
  "SCHD,Schwab US Dividend,2024-01-10,25,25,78.20,5,Core dividend holding,15,",
].join("\n");

/** Fetch all export rows for the current user's non-template portfolio. */
export async function fetchExportRowsForCurrentUser(): Promise<{
  rows: ExportRow[];
  error?: string;
}> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { rows: [], error: "Not signed in" };

  const { data: portfolios, error: pErr } = await supabase
    .from("portfolios")
    .select("id")
    .eq("user_id", session.user.id)
    .eq("is_template", false)
    .order("created_at", { ascending: true })
    .limit(1);
  if (pErr) return { rows: [], error: pErr.message };
  const portfolioId = portfolios?.[0]?.id;
  if (!portfolioId) return { rows: [], error: "No portfolio found" };

  const { data: holdings, error: hErr } = await supabase
    .from("holdings")
    .select("id, ticker, company_name, conviction_rating, thesis, target_allocation_pct, notes")
    .eq("portfolio_id", portfolioId);
  if (hErr) return { rows: [], error: hErr.message };
  if (!holdings || holdings.length === 0) return { rows: [] };

  const ids = holdings.map((h) => h.id);
  const { data: lots, error: lErr } = await supabase
    .from("tax_lots")
    .select("holding_id, shares, shares_remaining, cost_basis_per_share, purchased_at, notes")
    .in("holding_id", ids)
    .order("purchased_at", { ascending: true });
  if (lErr) return { rows: [], error: lErr.message };

  const byId = new Map(holdings.map((h) => [h.id, h]));
  const rows: ExportRow[] = (lots ?? []).map((l) => {
    const h = byId.get(l.holding_id)!;
    return {
      ticker: h.ticker,
      company_name: h.company_name,
      purchased_at: String(l.purchased_at),
      shares: Number(l.shares),
      shares_remaining: Number(l.shares_remaining),
      cost_basis_per_share: Number(l.cost_basis_per_share),
      conviction_rating: h.conviction_rating ?? 3,
      thesis: h.thesis,
      target_allocation_pct: h.target_allocation_pct as number | null,
      // Prefer the lot's notes (per-lot), fall back to the holding's notes.
      notes: l.notes ?? h.notes ?? null,
    };
  });

  // Holdings that have no lots — emit a single synthetic row so the user
  // doesn't lose them on round-trip. (Should be rare given import always
  // creates a lot.)
  for (const h of holdings) {
    if (!rows.some((r) => r.ticker === h.ticker)) {
      rows.push({
        ticker: h.ticker,
        company_name: h.company_name,
        purchased_at: new Date().toISOString().slice(0, 10),
        shares: 0,
        shares_remaining: 0,
        cost_basis_per_share: 0,
        conviction_rating: h.conviction_rating ?? 3,
        thesis: h.thesis,
        target_allocation_pct: h.target_allocation_pct as number | null,
        notes: h.notes,
      });
    }
  }

  // Stable order: ticker then purchased_at
  rows.sort((a, b) =>
    a.ticker === b.ticker ? a.purchased_at.localeCompare(b.purchased_at) : a.ticker.localeCompare(b.ticker),
  );

  return { rows };
}

// -------- CSV parser (handles quoted fields, embedded commas, "" escapes) --------

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop empty trailing rows
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export interface ParsedRow {
  ticker: string;
  company_name: string;
  purchased_at: string;
  shares: number | null;
  shares_remaining: number | null;
  cost_basis_per_share: number | null;
  conviction_rating: number;
  thesis: string;
  target_allocation_pct: number | null;
  notes: string;
  errors: string[];
  warnings: string[];
  rowIndex: number; // 1-based, excluding header
}

const today = () => new Date().toISOString().slice(0, 10);

const TICKER_RE = /^[A-Z0-9.\-]{1,12}$/;

export function validateAndNormalizeRows(rows: string[][]): ParsedRow[] {
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx: Record<CsvColumn, number> = {} as Record<CsvColumn, number>;
  for (const col of CSV_COLUMNS) {
    idx[col] = header.indexOf(col);
  }

  const out: ParsedRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const raw = rows[i];
    const get = (col: CsvColumn) => (idx[col] >= 0 ? (raw[idx[col]] ?? "").trim() : "");
    const errors: string[] = [];
    const warnings: string[] = [];

    const ticker = get("ticker").toUpperCase();
    if (!ticker) errors.push("ticker is required");
    else if (!TICKER_RE.test(ticker)) warnings.push("unusual ticker format");

    const sharesStr = get("shares");
    const shares = sharesStr === "" ? null : Number(sharesStr);
    if (sharesStr === "" || shares === null || !Number.isFinite(shares) || shares <= 0) {
      errors.push("shares must be > 0");
    }

    const cbStr = get("cost_basis_per_share");
    const cb = cbStr === "" ? null : Number(cbStr);
    if (cbStr === "" || cb === null || !Number.isFinite(cb) || cb <= 0) {
      errors.push("cost_basis_per_share must be > 0");
    }

    const purchasedAt = get("purchased_at");
    if (!purchasedAt) {
      errors.push("purchased_at required");
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(purchasedAt)) {
      errors.push("purchased_at must be YYYY-MM-DD");
    } else {
      const d = new Date(purchasedAt + "T00:00:00Z");
      if (Number.isNaN(d.getTime())) errors.push("purchased_at invalid date");
      else if (purchasedAt > today()) errors.push("purchased_at cannot be in the future");
    }

    const remStr = get("shares_remaining");
    let sharesRemaining: number | null = remStr === "" ? null : Number(remStr);
    if (sharesRemaining === null && shares !== null) sharesRemaining = shares;
    if (sharesRemaining !== null && shares !== null && sharesRemaining > shares) {
      errors.push("shares_remaining cannot exceed shares");
    }

    const crStr = get("conviction_rating");
    let conviction = crStr === "" ? 3 : Number(crStr);
    if (!Number.isFinite(conviction) || conviction < 1 || conviction > 5) {
      conviction = 3;
      warnings.push("conviction_rating defaulted to 3");
    }

    const taStr = get("target_allocation_pct");
    const targetAlloc = taStr === "" ? null : Number(taStr);
    if (taStr !== "" && (!Number.isFinite(targetAlloc!) || (targetAlloc! < 0 || targetAlloc! > 100))) {
      warnings.push("target_allocation_pct out of range, ignored");
    }

    out.push({
      ticker,
      company_name: get("company_name"),
      purchased_at: purchasedAt,
      shares,
      shares_remaining: sharesRemaining,
      cost_basis_per_share: cb,
      conviction_rating: conviction,
      thesis: get("thesis"),
      target_allocation_pct:
        taStr !== "" && Number.isFinite(targetAlloc!) && targetAlloc! >= 0 && targetAlloc! <= 100
          ? targetAlloc!
          : null,
      notes: get("notes"),
      errors,
      warnings,
      rowIndex: i,
    });
  }
  return out;
}

export interface GroupedTicker {
  ticker: string;
  rows: ParsedRow[];
  totalShares: number;
  weightedCost: number;
}

export function groupByTicker(rows: ParsedRow[]): GroupedTicker[] {
  const map = new Map<string, GroupedTicker>();
  for (const r of rows) {
    if (r.errors.length > 0) continue;
    if (!map.has(r.ticker)) {
      map.set(r.ticker, { ticker: r.ticker, rows: [], totalShares: 0, weightedCost: 0 });
    }
    const g = map.get(r.ticker)!;
    g.rows.push(r);
    g.totalShares += r.shares_remaining ?? 0;
    g.weightedCost += (r.shares_remaining ?? 0) * (r.cost_basis_per_share ?? 0);
  }
  return [...map.values()];
}

// -------- Import executor --------

export interface ImportProgress {
  inserted_holdings: number;
  inserted_lots: number;
  skipped_tickers: string[];
}

export type DuplicateResolution = "merge" | "skip";

export async function executeImport(params: {
  portfolioId: string;
  groups: GroupedTicker[];
  existingHoldings: { id: string; ticker: string; shares: number; avg_cost_basis: number }[];
  resolutions: Record<string, DuplicateResolution>;
}): Promise<{ ok: boolean; progress: ImportProgress; error?: string }> {
  const { portfolioId, groups, existingHoldings, resolutions } = params;
  const createdHoldingIds: string[] = []; // for cleanup on failure
  const progress: ImportProgress = { inserted_holdings: 0, inserted_lots: 0, skipped_tickers: [] };

  const existingByTicker = new Map(
    existingHoldings.map((h) => [h.ticker.toUpperCase(), h]),
  );

  try {
    for (const g of groups) {
      const existing = existingByTicker.get(g.ticker);
      let targetHoldingId: string;

      if (existing) {
        const action = resolutions[g.ticker] ?? "merge";
        if (action === "skip") {
          progress.skipped_tickers.push(g.ticker);
          continue;
        }
        targetHoldingId = existing.id;
      } else {
        const firstRow = g.rows[0];
        const avgCost = g.totalShares > 0 ? g.weightedCost / g.totalShares : firstRow.cost_basis_per_share ?? 0;
        const { data: inserted, error: insErr } = await supabase
          .from("holdings")
          .insert({
            portfolio_id: portfolioId,
            ticker: g.ticker,
            company_name: firstRow.company_name || null,
            shares: g.totalShares,
            avg_cost_basis: avgCost,
            conviction_rating: firstRow.conviction_rating,
            thesis: firstRow.thesis || null,
            target_allocation_pct: firstRow.target_allocation_pct,
            notes: firstRow.notes || null,
            date_added: firstRow.purchased_at,
          })
          .select("id")
          .single();
        if (insErr || !inserted) throw new Error(`Failed to create ${g.ticker}: ${insErr?.message ?? "unknown"}`);
        targetHoldingId = inserted.id;
        createdHoldingIds.push(targetHoldingId);
        progress.inserted_holdings += 1;
      }

      // Insert lots in one batch
      const lotRows = g.rows.map((r) => ({
        holding_id: targetHoldingId,
        shares: r.shares!,
        shares_remaining: r.shares_remaining ?? r.shares!,
        cost_basis_per_share: r.cost_basis_per_share!,
        purchased_at: r.purchased_at,
        notes: r.notes || null,
      }));
      const { error: lotsErr } = await supabase.from("tax_lots").insert(lotRows);
      if (lotsErr) throw new Error(`Lots insert failed for ${g.ticker}: ${lotsErr.message}`);
      progress.inserted_lots += lotRows.length;

      // Recalc parent holding from all its lots (covers merge case)
      const { data: allLots, error: rErr } = await supabase
        .from("tax_lots")
        .select("shares_remaining, cost_basis_per_share, purchased_at")
        .eq("holding_id", targetHoldingId);
      if (rErr) throw rErr;
      const totalShares = (allLots ?? []).reduce((s, l) => s + Number(l.shares_remaining), 0);
      const weighted = (allLots ?? []).reduce(
        (s, l) => s + Number(l.shares_remaining) * Number(l.cost_basis_per_share),
        0,
      );
      const avgCost = totalShares > 0 ? weighted / totalShares : 0;
      const earliest = (allLots ?? []).map((l) => String(l.purchased_at)).sort()[0];

      const firstRow = g.rows[0];
      const updatePayload: Record<string, unknown> = {
        shares: totalShares,
        avg_cost_basis: avgCost,
      };
      if (earliest) updatePayload.date_added = earliest;
      if (!existing) {
        // For new holdings, the meta we set during insert already came from firstRow.
      } else {
        // For merged holdings, apply firstRow meta only if provided.
        if (firstRow.conviction_rating) updatePayload.conviction_rating = firstRow.conviction_rating;
        if (firstRow.thesis) updatePayload.thesis = firstRow.thesis;
        if (firstRow.target_allocation_pct != null) updatePayload.target_allocation_pct = firstRow.target_allocation_pct;
      }

      const { error: updErr } = await supabase.from("holdings").update(updatePayload).eq("id", targetHoldingId);
      if (updErr) throw updErr;
    }

    return { ok: true, progress };
  } catch (e) {
    // Best-effort cleanup of newly-created holdings (lots cascade via FK in practice;
    // if not, delete lots first).
    for (const id of createdHoldingIds) {
      await supabase.from("tax_lots").delete().eq("holding_id", id);
      await supabase.from("holdings").delete().eq("id", id);
    }
    return {
      ok: false,
      progress,
      error: e instanceof Error ? e.message : "Import failed",
    };
  }
}
