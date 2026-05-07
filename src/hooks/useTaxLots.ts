import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

export type TaxLot = Tables<"tax_lots">;

export interface NewLotInput {
  shares: number;
  cost_basis_per_share: number;
  purchased_at: string; // YYYY-MM-DD
  notes?: string | null;
}

export type UpdateLotInput = Partial<NewLotInput> & {
  shares_remaining?: number;
};

export async function recalcHolding(holdingId: string): Promise<void> {
  const { data: lots, error } = await supabase
    .from("tax_lots")
    .select("shares_remaining, cost_basis_per_share, purchased_at")
    .eq("holding_id", holdingId);

  if (error) throw error;
  if (!lots || lots.length === 0) return;

  const totalShares = lots.reduce((s, l) => s + Number(l.shares_remaining), 0);
  const weightedCostNumerator = lots.reduce(
    (s, l) => s + Number(l.shares_remaining) * Number(l.cost_basis_per_share),
    0,
  );
  const avgCostBasis = totalShares > 0 ? weightedCostNumerator / totalShares : 0;
  const earliest = lots.reduce(
    (min, l) => (l.purchased_at < min ? l.purchased_at : min),
    lots[0].purchased_at,
  );

  const { error: updateError } = await supabase
    .from("holdings")
    .update({
      shares: totalShares,
      avg_cost_basis: avgCostBasis,
      date_added: new Date(earliest).toISOString(),
    })
    .eq("id", holdingId);

  if (updateError) throw updateError;
}

export function useTaxLots(holdingId: string | null) {
  const [lots, setLots] = useState<TaxLot[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchLots = useCallback(async () => {
    if (!holdingId) {
      setLots([]);
      return;
    }
    setIsLoading(true);
    const { data, error } = await supabase
      .from("tax_lots")
      .select("*")
      .eq("holding_id", holdingId)
      .order("purchased_at", { ascending: true });
    if (error) {
      toast.error("Failed to load tax lots", { description: error.message });
    } else {
      setLots(data ?? []);
    }
    setIsLoading(false);
  }, [holdingId]);

  useEffect(() => {
    fetchLots();
  }, [fetchLots]);

  const afterMutation = useCallback(async () => {
    if (!holdingId) return;
    try {
      await recalcHolding(holdingId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to recalculate holding";
      toast.error("Recalc failed", { description: msg });
    }
    await fetchLots();
  }, [holdingId, fetchLots]);

  const addLot = useCallback(
    async (input: NewLotInput) => {
      if (!holdingId) return false;
      const { error } = await supabase.from("tax_lots").insert({
        holding_id: holdingId,
        shares: input.shares,
        shares_remaining: input.shares,
        cost_basis_per_share: input.cost_basis_per_share,
        purchased_at: input.purchased_at,
        notes: input.notes ?? null,
      });
      if (error) {
        toast.error("Failed to add tax lot", { description: error.message });
        return false;
      }
      toast.success("Tax lot added");
      await afterMutation();
      return true;
    },
    [holdingId, afterMutation],
  );

  const updateLot = useCallback(
    async (id: string, data: UpdateLotInput) => {
      const { error } = await supabase.from("tax_lots").update(data).eq("id", id);
      if (error) {
        toast.error("Failed to update tax lot", { description: error.message });
        return false;
      }
      toast.success("Tax lot updated");
      await afterMutation();
      return true;
    },
    [afterMutation],
  );

  const deleteLot = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("tax_lots").delete().eq("id", id);
      if (error) {
        toast.error("Failed to delete tax lot", { description: error.message });
        return false;
      }
      toast.success("Tax lot deleted");
      await afterMutation();
      return true;
    },
    [afterMutation],
  );

  return { lots, isLoading, addLot, updateLot, deleteLot, refetch: fetchLots };
}
