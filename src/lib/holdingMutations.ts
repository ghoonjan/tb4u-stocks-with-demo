import { supabase } from "@/integrations/supabase/client";

export interface AddHoldingData {
  ticker: string;
  company_name: string;
  shares: number;
  avg_cost_basis: number;
  conviction_rating: number;
  thesis?: string;
  target_allocation_pct?: number;
  date_added: string;
}

export interface AddHoldingOrLotParams {
  portfolioId: string;
  existingHoldings: { id: string; ticker: string }[];
  data: AddHoldingData;
  /** Only set for real user portfolios — admin template edits should not log trades. */
  logTradeForUserId?: string;
}

export interface AddHoldingOrLotResult {
  ok: boolean;
  mode: "lot" | "new";
  ticker: string;
  error?: string;
}

/**
 * Adds a holding to a portfolio, or — if a holding with the same ticker already
 * exists (case-insensitive) — adds a new tax lot to it and recomputes the
 * parent holding's shares / avg_cost_basis / earliest date_added from all lots.
 */
export async function addHoldingOrLot({
  portfolioId,
  existingHoldings,
  data,
  logTradeForUserId,
}: AddHoldingOrLotParams): Promise<AddHoldingOrLotResult> {
  const tickerUpper = data.ticker.toUpperCase();
  const purchasedAt = data.date_added.slice(0, 10);

  const existing = existingHoldings.find(
    (h) => h.ticker.toUpperCase() === tickerUpper,
  );

  if (existing) {
    const { error: lotError } = await supabase.from("tax_lots").insert({
      holding_id: existing.id,
      shares: data.shares,
      shares_remaining: data.shares,
      cost_basis_per_share: data.avg_cost_basis,
      purchased_at: purchasedAt,
    });
    if (lotError) {
      return { ok: false, mode: "lot", ticker: tickerUpper, error: lotError.message };
    }

    if (logTradeForUserId) {
      await supabase.from("trade_journal").insert({
        user_id: logTradeForUserId,
        ticker: tickerUpper,
        action: "BUY",
        shares: data.shares,
        price_at_action: data.avg_cost_basis,
      });
    }

    const { data: lots, error: lotsErr } = await supabase
      .from("tax_lots")
      .select("shares_remaining, cost_basis_per_share, purchased_at")
      .eq("holding_id", existing.id);
    if (lotsErr) {
      return { ok: false, mode: "lot", ticker: tickerUpper, error: lotsErr.message };
    }

    const totalShares = (lots ?? []).reduce((s, l) => s + Number(l.shares_remaining), 0);
    const totalCost = (lots ?? []).reduce(
      (s, l) => s + Number(l.shares_remaining) * Number(l.cost_basis_per_share),
      0,
    );
    const avgCost = totalShares > 0 ? Math.round((totalCost / totalShares) * 10000) / 10000 : 0;
    const earliest = (lots ?? []).map((l) => l.purchased_at).sort()[0] ?? purchasedAt;

    const { error: updErr } = await supabase
      .from("holdings")
      .update({ shares: totalShares, avg_cost_basis: avgCost, date_added: earliest })
      .eq("id", existing.id);
    if (updErr) {
      return { ok: false, mode: "lot", ticker: tickerUpper, error: updErr.message };
    }

    return { ok: true, mode: "lot", ticker: tickerUpper };
  }

  const { data: inserted, error } = await supabase
    .from("holdings")
    .insert({
      portfolio_id: portfolioId,
      ticker: tickerUpper,
      company_name: data.company_name,
      shares: data.shares,
      avg_cost_basis: data.avg_cost_basis,
      conviction_rating: data.conviction_rating,
      thesis: data.thesis || null,
      target_allocation_pct: data.target_allocation_pct || null,
      date_added: data.date_added,
    })
    .select("id")
    .single();
  if (error || !inserted) {
    return { ok: false, mode: "new", ticker: tickerUpper, error: error?.message ?? "Insert failed" };
  }

  const { error: lotError } = await supabase.from("tax_lots").insert({
    holding_id: inserted.id,
    shares: data.shares,
    shares_remaining: data.shares,
    cost_basis_per_share: data.avg_cost_basis,
    purchased_at: purchasedAt,
  });
  if (lotError) {
    return { ok: true, mode: "new", ticker: tickerUpper, error: lotError.message };
  }

  if (logTradeForUserId) {
    await supabase.from("trade_journal").insert({
      user_id: logTradeForUserId,
      ticker: tickerUpper,
      action: "BUY",
      shares: data.shares,
      price_at_action: data.avg_cost_basis,
    });
  }

  return { ok: true, mode: "new", ticker: tickerUpper };
}
