import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X, DollarSign } from "lucide-react";
import { useTaxLots, type TaxLot } from "@/hooks/useTaxLots";
import { ConfirmDialog } from "./ConfirmDialog";

interface TaxLotsPanelProps {
  holdingId: string;
  ticker: string;
  currentPrice: number;
  /** Called when all lots are depleted and the user confirms removal. */
  onRequestRemoveHolding?: () => void;
}

interface LotFormState {
  shares: string;
  cost_basis_per_share: string;
  purchased_at: string;
  notes: string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

const emptyForm = (): LotFormState => ({
  shares: "",
  cost_basis_per_share: "",
  purchased_at: todayISO(),
  notes: "",
});

const fmtMoney = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

const fmtPct = (n: number) =>
  `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

const daysBetween = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
};

export function TaxLotsPanel({ holdingId, ticker, currentPrice, onRequestRemoveHolding }: TaxLotsPanelProps) {
  const { lots, isLoading, addLot, updateLot, deleteLot, sellFromLot } = useTaxLots(holdingId);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<LotFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<LotFormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<TaxLot | null>(null);
  const [sellTarget, setSellTarget] = useState<TaxLot | null>(null);
  const [sellShares, setSellShares] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [sellNotes, setSellNotes] = useState("");
  const [sellLogTrade, setSellLogTrade] = useState(true);
  const [showDepletedPrompt, setShowDepletedPrompt] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const parseForm = (f: LotFormState) => ({
    shares: parseFloat(f.shares),
    cost_basis_per_share: parseFloat(f.cost_basis_per_share),
    purchased_at: f.purchased_at,
    notes: f.notes.trim() || null,
  });

  const handleAdd = async () => {
    const data = parseForm(addForm);
    if (!data.shares || data.shares <= 0 || !data.cost_basis_per_share || data.cost_basis_per_share <= 0 || !data.purchased_at) return;
    setSubmitting(true);
    const ok = await addLot(data);
    setSubmitting(false);
    if (ok) { setShowAdd(false); setAddForm(emptyForm()); }
  };

  const startEdit = (lot: TaxLot) => {
    setEditingId(lot.id);
    setEditForm({
      shares: String(lot.shares),
      cost_basis_per_share: String(lot.cost_basis_per_share),
      purchased_at: lot.purchased_at,
      notes: lot.notes ?? "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const data = parseForm(editForm);
    if (!data.shares || data.shares <= 0 || !data.cost_basis_per_share || data.cost_basis_per_share <= 0) return;
    setSubmitting(true);
    const ok = await updateLot(editingId, data);
    setSubmitting(false);
    if (ok) setEditingId(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    await deleteLot(deleteTarget.id);
    setSubmitting(false);
    setDeleteTarget(null);
  };

  const startSell = (lot: TaxLot) => {
    setSellTarget(lot);
    setSellShares(String(Number(lot.shares_remaining)));
    setSellPrice(currentPrice > 0 ? currentPrice.toFixed(2) : "");
    setSellNotes("");
    setSellLogTrade(true);
  };

  const cancelSell = () => {
    setSellTarget(null);
    setSellShares("");
    setSellPrice("");
    setSellNotes("");
  };

  const handleSell = async () => {
    if (!sellTarget) return;
    const qty = parseFloat(sellShares);
    const price = parseFloat(sellPrice);
    if (!qty || qty <= 0 || qty > Number(sellTarget.shares_remaining)) return;
    if (!price || price <= 0) return;
    setSubmitting(true);
    const result = await sellFromLot(sellTarget, qty, price, {
      ticker, notes: sellNotes.trim() || null, logTrade: sellLogTrade,
    });
    setSubmitting(false);
    if (result.ok) {
      cancelSell();
      if (result.holdingDepleted) setShowDepletedPrompt(true);
    }
  };

  const handleConfirmRemoveHolding = () => {
    setShowDepletedPrompt(false);
    onRequestRemoveHolding?.();
  };

  // Aggregates use shares_remaining
  const totals = lots.reduce(
    (acc, l) => {
      const sharesRem = Number(l.shares_remaining);
      const cost = Number(l.cost_basis_per_share);
      acc.shares += sharesRem;
      acc.costBasis += sharesRem * cost;
      acc.currentValue += sharesRem * currentPrice;
      return acc;
    },
    { shares: 0, costBasis: 0, currentValue: 0 },
  );
  const totalPL = totals.currentValue - totals.costBasis;
  const weightedAvgCost = totals.shares > 0 ? totals.costBasis / totals.shares : 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Tax Lots — {ticker}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Track individual purchase lots for precise cost basis.</p>
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus size={14} /> Add Lot
        </button>
      </div>

      {showAdd && (
        <div className="mb-4 rounded-xl border border-border bg-secondary/30 p-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <LabeledInput label="Shares" type="number" step="0.0001" value={addForm.shares}
              onChange={(v) => setAddForm({ ...addForm, shares: v })} />
            <LabeledInput label="Cost / Share" type="number" step="0.01" value={addForm.cost_basis_per_share}
              onChange={(v) => setAddForm({ ...addForm, cost_basis_per_share: v })} />
            <LabeledInput label="Purchase Date" type="date" max={todayISO()} value={addForm.purchased_at}
              onChange={(v) => setAddForm({ ...addForm, purchased_at: v })} />
            <LabeledInput label="Notes (optional)" type="text" value={addForm.notes}
              onChange={(v) => setAddForm({ ...addForm, notes: v })} />
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => { setShowAdd(false); setAddForm(emptyForm()); }}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
              Cancel
            </button>
            <button onClick={handleAdd} disabled={submitting}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
              Save Lot
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading lots…</div>
      ) : lots.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">No tax lots yet. Add your first lot above.</div>
      ) : (
        <div className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2 pr-3 font-medium">Purchase Date</th>
                <th className="py-2 pr-3 font-medium text-right">Shares</th>
                <th className="py-2 pr-3 font-medium text-right">Remaining</th>
                <th className="py-2 pr-3 font-medium text-right">Cost / Share</th>
                <th className="py-2 pr-3 font-medium text-right">Total Cost</th>
                <th className="py-2 pr-3 font-medium text-right">Current Value</th>
                <th className="py-2 pr-3 font-medium text-right">P/L ($)</th>
                <th className="py-2 pr-3 font-medium text-right">P/L (%)</th>
                <th className="py-2 pr-3 font-medium text-right">Days Held</th>
                <th className="py-2 pr-3 font-medium">Term</th>
                <th className="py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((lot) => {
                const isEditing = editingId === lot.id;
                const sharesRem = Number(lot.shares_remaining);
                const cost = Number(lot.cost_basis_per_share);
                const totalCost = sharesRem * cost;
                const currentValue = sharesRem * currentPrice;
                const pl = currentValue - totalCost;
                const plPct = totalCost > 0 ? (pl / totalCost) * 100 : 0;
                const days = daysBetween(lot.purchased_at);
                const longTerm = days > 365;

                if (isEditing) {
                  return (
                    <tr key={lot.id} className="border-b border-border bg-secondary/30">
                      <td className="py-2 pr-3"><InlineInput type="date" max={todayISO()} value={editForm.purchased_at}
                        onChange={(v) => setEditForm({ ...editForm, purchased_at: v })} /></td>
                      <td className="py-2 pr-3"><InlineInput type="number" step="0.0001" value={editForm.shares}
                        onChange={(v) => setEditForm({ ...editForm, shares: v })} className="text-right" /></td>
                      <td className="py-2 pr-3 text-right text-muted-foreground">{Number(lot.shares_remaining).toLocaleString()}</td>
                      <td className="py-2 pr-3"><InlineInput type="number" step="0.01" value={editForm.cost_basis_per_share}
                        onChange={(v) => setEditForm({ ...editForm, cost_basis_per_share: v })} className="text-right" /></td>
                      <td className="py-2 pr-3 text-right text-muted-foreground" colSpan={5}>
                        <InlineInput type="text" placeholder="Notes (optional)" value={editForm.notes}
                          onChange={(v) => setEditForm({ ...editForm, notes: v })} />
                      </td>
                      <td className="py-2 text-right">
                        <div className="inline-flex gap-1">
                          <button onClick={handleSaveEdit} disabled={submitting} title="Save"
                            className="rounded-md p-1.5 text-emerald-500 hover:bg-secondary transition-colors disabled:opacity-50">
                            <Check size={14} />
                          </button>
                          <button onClick={() => setEditingId(null)} title="Cancel"
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                            <X size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={lot.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                    <td className="py-2 pr-3 text-foreground whitespace-nowrap">{fmtDate(lot.purchased_at)}</td>
                    <td className="py-2 pr-3 text-right text-foreground">{Number(lot.shares).toLocaleString()}</td>
                    <td className="py-2 pr-3 text-right text-foreground">{sharesRem.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-right text-foreground">{fmtMoney(cost)}</td>
                    <td className="py-2 pr-3 text-right text-foreground">{fmtMoney(totalCost)}</td>
                    <td className="py-2 pr-3 text-right text-foreground">{fmtMoney(currentValue)}</td>
                    <td className={`py-2 pr-3 text-right font-medium ${pl >= 0 ? "text-emerald-500" : "text-red-500"}`}>{fmtMoney(pl)}</td>
                    <td className={`py-2 pr-3 text-right font-medium ${pl >= 0 ? "text-emerald-500" : "text-red-500"}`}>{fmtPct(plPct)}</td>
                    <td className="py-2 pr-3 text-right text-muted-foreground">{days}</td>
                    <td className="py-2 pr-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${longTerm ? "bg-emerald-500/10 text-emerald-500" : "bg-orange-500/10 text-orange-500"}`}>
                        {longTerm ? "Long-term" : "Short-term"}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <div className="inline-flex gap-1">
                        <button onClick={() => startEdit(lot)} title="Edit"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setDeleteTarget(lot)} title="Delete"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-medium">
                <td className="pt-3 pr-3 text-foreground">Total</td>
                <td className="pt-3 pr-3 text-right text-foreground" colSpan={2}>{totals.shares.toLocaleString()} sh</td>
                <td className="pt-3 pr-3 text-right text-foreground">{fmtMoney(weightedAvgCost)}</td>
                <td className="pt-3 pr-3 text-right text-foreground">{fmtMoney(totals.costBasis)}</td>
                <td className="pt-3 pr-3 text-right text-foreground">{fmtMoney(totals.currentValue)}</td>
                <td className={`pt-3 pr-3 text-right ${totalPL >= 0 ? "text-emerald-500" : "text-red-500"}`} colSpan={2}>{fmtMoney(totalPL)}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete tax lot?"
        message={deleteTarget ? `This will permanently delete the lot from ${fmtDate(deleteTarget.purchased_at)} (${Number(deleteTarget.shares)} sh). The parent holding will be recalculated.` : ""}
        confirmLabel="Delete"
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

interface LabeledInputProps {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
  max?: string;
}

function LabeledInput({ label, type, value, onChange, step, max }: LabeledInputProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} step={step} max={max}
        className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
    </label>
  );
}

interface InlineInputProps {
  type: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
  max?: string;
  placeholder?: string;
  className?: string;
}

function InlineInput({ type, value, onChange, step, max, placeholder, className = "" }: InlineInputProps) {
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} step={step} max={max} placeholder={placeholder}
      className={`w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary ${className}`} />
  );
}
