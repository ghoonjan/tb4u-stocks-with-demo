import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Star, AlertTriangle, Plus, Pencil, Trash2, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { LogoMark } from "@/components/LogoMark";
import { GradientMeshBackground } from "@/components/GradientMeshBackground";
import CopyrightFooter from "@/components/CopyrightFooter";
import { HoldingModal } from "@/components/dashboard/HoldingModal";
import { ConfirmDialog } from "@/components/dashboard/ConfirmDialog";
import type { HoldingDisplay } from "@/hooks/usePortfolioData";
import { getCompanyProfile } from "@/services/marketData";
import { addHoldingOrLot } from "@/lib/holdingMutations";

type PortfolioRow = { id: string; name: string; is_template: boolean; user_id: string; holdings_count: number };
type HoldingRow = {
  id: string;
  ticker: string;
  company_name: string | null;
  shares: number;
  avg_cost_basis: number;
  conviction_rating: number;
  thesis: string | null;
  target_allocation_pct: number | null;
  notes: string | null;
  date_added: string;
};
type WatchlistTemplateRow = {
  id: string;
  ticker: string;
  company_name: string | null;
  target_price: number | null;
  notes: string | null;
};

const holdingToDisplay = (h: HoldingRow, portfolioId: string): HoldingDisplay => ({
  id: h.id,
  ticker: h.ticker,
  companyName: h.company_name ?? "",
  shares: Number(h.shares),
  avgCostBasis: Number(h.avg_cost_basis),
  currentPrice: 0,
  dayChangePct: 0,
  dayChangeDollar: 0,
  totalPLDollar: 0,
  totalPLPct: 0,
  positionValue: 0,
  weight: 0,
  convictionRating: h.conviction_rating,
  thesis: h.thesis,
  targetAllocationPct: h.target_allocation_pct ? Number(h.target_allocation_pct) : null,
  notes: h.notes,
  portfolioId,
  divYield: null,
  purchaseDate: h.date_added.slice(0, 10),
  holdingPeriodDays: 0,
  isLongTerm: false,
});

const AdminTemplates = () => {
  const navigate = useNavigate();
  const { loading: roleLoading, isSuperAdmin, userId, email } = useUserRole();

  const [portfolios, setPortfolios] = useState<PortfolioRow[]>([]);
  const [holdings, setHoldings] = useState<HoldingRow[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [holdingModalOpen, setHoldingModalOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<HoldingDisplay | null>(null);
  const [deletingHolding, setDeletingHolding] = useState<HoldingRow | null>(null);

  const [wlModalOpen, setWlModalOpen] = useState(false);
  const [editingWl, setEditingWl] = useState<WatchlistTemplateRow | null>(null);
  const [deletingWl, setDeletingWl] = useState<WatchlistTemplateRow | null>(null);

  const [creatingPortfolio, setCreatingPortfolio] = useState(false);
  const [pendingPromote, setPendingPromote] = useState<PortfolioRow | null>(null);

  // Access control
  useEffect(() => {
    if (roleLoading) return;
    if (!userId) navigate("/auth");
    else if (!isSuperAdmin) navigate("/");
  }, [roleLoading, userId, isSuperAdmin, navigate]);

  const template = useMemo(() => portfolios.find((p) => p.is_template) ?? null, [portfolios]);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: portfolioData }, { data: wlData }, { data: holdingsAll }] = await Promise.all([
      supabase.from("portfolios").select("id, name, is_template, user_id").order("created_at"),
      supabase.from("watchlist_template").select("id, ticker, company_name, target_price, notes").order("ticker"),
      supabase.from("holdings").select("id, portfolio_id"),
    ]);
    const counts = new Map<string, number>();
    for (const h of (holdingsAll ?? []) as { portfolio_id: string }[]) {
      counts.set(h.portfolio_id, (counts.get(h.portfolio_id) ?? 0) + 1);
    }
    const ports = ((portfolioData ?? []) as Omit<PortfolioRow, "holdings_count">[]).map((p) => ({
      ...p,
      holdings_count: counts.get(p.id) ?? 0,
    })) as PortfolioRow[];
    setPortfolios(ports);
    setWatchlist((wlData ?? []) as WatchlistTemplateRow[]);

    const tpl = ports.find((p) => p.is_template);
    if (tpl) {
      const { data: hData } = await supabase
        .from("holdings")
        .select("id, ticker, company_name, shares, avg_cost_basis, conviction_rating, thesis, target_allocation_pct, notes, date_added")
        .eq("portfolio_id", tpl.id)
        .order("ticker");
      setHoldings((hData ?? []) as HoldingRow[]);
    } else {
      setHoldings([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isSuperAdmin) void load();
  }, [isSuperAdmin, load]);

  const createTemplatePortfolio = async () => {
    if (!userId) return;
    setCreatingPortfolio(true);
    // Clear any existing template (safety)
    await supabase.from("portfolios").update({ is_template: false }).eq("is_template", true);
    const { error } = await supabase.from("portfolios").insert({
      user_id: userId,
      name: "Template Portfolio",
      is_template: true,
    });
    setCreatingPortfolio(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Template portfolio created");
      void load();
    }
  };

  const promoteToTemplate = async (id: string) => {
    await supabase.from("portfolios").update({ is_template: false }).eq("is_template", true);
    const { error } = await supabase.from("portfolios").update({ is_template: true }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Template updated");
      void load();
    }
  };

  const requestPromote = (p: PortfolioRow) => {
    const currentHas = (template?.holdings_count ?? 0) > 0;
    if (p.holdings_count === 0 && currentHas) {
      setPendingPromote(p);
    } else {
      void promoteToTemplate(p.id);
    }
  };

  // Holding actions
  const handleSubmitHolding = async (data: {
    ticker: string;
    company_name: string;
    shares: number;
    avg_cost_basis: number;
    conviction_rating: number;
    thesis?: string;
    target_allocation_pct?: number;
    date_added: string;
  }) => {
    if (!template) return false;

    if (editingHolding) {
      const payload = {
        portfolio_id: template.id,
        ticker: data.ticker.toUpperCase(),
        company_name: data.company_name || null,
        shares: data.shares,
        avg_cost_basis: data.avg_cost_basis,
        conviction_rating: data.conviction_rating,
        thesis: data.thesis ?? null,
        target_allocation_pct: data.target_allocation_pct ?? null,
        date_added: new Date(data.date_added).toISOString(),
      };
      const { error } = await supabase.from("holdings").update(payload).eq("id", editingHolding.id);
      if (error) {
        toast.error(error.message);
        return false;
      }
      toast.success("Holding updated");
      setHoldingModalOpen(false);
      setEditingHolding(null);
      void load();
      return true;
    }

    const result = await addHoldingOrLot({
      portfolioId: template.id,
      existingHoldings: holdings.map((h) => ({ id: h.id, ticker: h.ticker })),
      data,
    });

    if (!result.ok) {
      toast.error(result.error ?? "Failed to add holding");
      return false;
    }

    if (result.mode === "lot") {
      toast.success(`Added new tax lot for ${result.ticker}`);
    } else {
      toast.success(`Added ${result.ticker} to template`);
      if (result.error) toast.error(result.error);
    }
    setHoldingModalOpen(false);
    setEditingHolding(null);
    void load();
    return true;
  };

  const confirmDeleteHolding = async () => {
    if (!deletingHolding) return;
    const { error } = await supabase.from("holdings").delete().eq("id", deletingHolding.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Holding removed");
      setDeletingHolding(null);
      void load();
    }
  };

  // Watchlist actions
  const handleSubmitWatchlist = async (data: {
    ticker: string;
    company_name?: string;
    target_price?: number;
    notes?: string;
  }) => {
    const payload = {
      ticker: data.ticker.toUpperCase(),
      company_name: data.company_name ?? null,
      target_price: data.target_price ?? null,
      notes: data.notes ?? null,
    };
    const { error } = editingWl
      ? await supabase.from("watchlist_template").update(payload).eq("id", editingWl.id)
      : await supabase.from("watchlist_template").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editingWl ? "Watchlist item updated" : "Watchlist item added");
    setWlModalOpen(false);
    setEditingWl(null);
    void load();
  };

  const confirmDeleteWl = async () => {
    if (!deletingWl) return;
    const { error } = await supabase.from("watchlist_template").delete().eq("id", deletingWl.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Removed");
      setDeletingWl(null);
      void load();
    }
  };

  if (roleLoading || !isSuperAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  const others = portfolios.filter((p) => p.id !== template?.id);

  return (
    <div className="flex min-h-screen flex-col bg-background relative">
      <GradientMeshBackground />
      <div className="flex-1 px-4 py-8 relative z-10">
        <div className="mx-auto w-full max-w-5xl">
          <header className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LogoMark size={40} />
              <div>
                <h1 className="text-lg font-semibold text-foreground">Manage Templates (TB4U+)</h1>
                <p className="text-xs text-muted-foreground">Signed in as {email}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => navigate("/admin")}
                className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
              >
                Admin
              </button>
              <button
                onClick={() => navigate("/")}
                className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
              >
                Dashboard
              </button>
            </div>
          </header>

          {/* Template portfolio */}
          <section className="layer-modal mb-6 p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Star size={16} className="text-gain fill-current" /> Template Portfolio
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Holdings here are cloned into every new user's portfolio on first login.
                </p>
              </div>
              {template && (
                <button
                  onClick={() => { setEditingHolding(null); setHoldingModalOpen(true); }}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Plus size={14} /> Add holding
                </button>
              )}
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : !template ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-warning">
                  <AlertTriangle size={14} />
                  <span>No template portfolio set. New users will start empty.</span>
                </div>
                <button
                  onClick={createTemplatePortfolio}
                  disabled={creatingPortfolio}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {creatingPortfolio ? "Creating…" : "Create template portfolio"}
                </button>
              </div>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-foreground">{template.name}</span>
                  <span className="text-xs text-muted-foreground">
                    · {holdings.length} {holdings.length === 1 ? "holding" : "holdings"}
                  </span>
                </div>
                {holdings.length === 0 ? (
                  <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <span>This template is empty — new users will sign up with no holdings. Add at least one to seed them.</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="py-2 pr-3">Ticker</th>
                          <th className="py-2 pr-3">Company</th>
                          <th className="py-2 pr-3 text-right">Shares</th>
                          <th className="py-2 pr-3 text-right">Avg cost</th>
                          <th className="py-2 pr-3 text-right">Conv.</th>
                          <th className="py-2 pr-3 text-right">Target %</th>
                          <th className="py-2 pr-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {holdings.map((h) => (
                          <tr key={h.id} className="border-b border-border/50">
                            <td className="py-2.5 pr-3 font-mono font-medium text-foreground">{h.ticker}</td>
                            <td className="py-2.5 pr-3 text-muted-foreground truncate max-w-[200px]">{h.company_name ?? "—"}</td>
                            <td className="py-2.5 pr-3 text-right text-foreground">{Number(h.shares)}</td>
                            <td className="py-2.5 pr-3 text-right text-foreground">${Number(h.avg_cost_basis).toFixed(2)}</td>
                            <td className="py-2.5 pr-3 text-right text-muted-foreground">{h.conviction_rating}</td>
                            <td className="py-2.5 pr-3 text-right text-muted-foreground">
                              {h.target_allocation_pct ? `${Number(h.target_allocation_pct)}%` : "—"}
                            </td>
                            <td className="py-2.5 pr-3 text-right">
                              <div className="inline-flex gap-1">
                                <button
                                  onClick={() => { setEditingHolding(holdingToDisplay(h, template.id)); setHoldingModalOpen(true); }}
                                  className="rounded-md border border-border bg-secondary p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                  title="Edit"
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  onClick={() => setDeletingHolding(h)}
                                  className="rounded-md border border-border bg-secondary p-1.5 text-muted-foreground hover:text-destructive hover:bg-accent transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {others.length > 0 && (
              <div className="mt-6 border-t border-border/60 pt-4">
                <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Promote a different portfolio to template
                </p>
                <div className="space-y-1.5">
                  {others.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-3">
                      <span className="text-sm text-foreground truncate">
                        {p.name}
                        <span className="ml-2 text-xs text-muted-foreground">
                          · {p.holdings_count} {p.holdings_count === 1 ? "holding" : "holdings"}
                        </span>
                      </span>
                      <button
                        onClick={() => requestPromote(p)}
                        className="rounded-md border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        Set as template
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Template watchlist */}
          <section className="layer-modal p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">Template Watchlist</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  These items are added to every new user's watchlist on first login.
                </p>
              </div>
              <button
                onClick={() => { setEditingWl(null); setWlModalOpen(true); }}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Plus size={14} /> Add item
              </button>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : watchlist.length === 0 ? (
              <p className="text-sm text-muted-foreground">No template watchlist items yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3">Ticker</th>
                      <th className="py-2 pr-3">Company</th>
                      <th className="py-2 pr-3 text-right">Target price</th>
                      <th className="py-2 pr-3">Notes</th>
                      <th className="py-2 pr-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {watchlist.map((w) => (
                      <tr key={w.id} className="border-b border-border/50">
                        <td className="py-2.5 pr-3 font-mono font-medium text-foreground">{w.ticker}</td>
                        <td className="py-2.5 pr-3 text-muted-foreground truncate max-w-[200px]">{w.company_name ?? "—"}</td>
                        <td className="py-2.5 pr-3 text-right text-foreground">
                          {w.target_price ? `$${Number(w.target_price).toFixed(2)}` : "—"}
                        </td>
                        <td className="py-2.5 pr-3 text-muted-foreground truncate max-w-[260px]">{w.notes ?? "—"}</td>
                        <td className="py-2.5 pr-3 text-right">
                          <div className="inline-flex gap-1">
                            <button
                              onClick={() => { setEditingWl(w); setWlModalOpen(true); }}
                              className="rounded-md border border-border bg-secondary p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent"
                              title="Edit"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => setDeletingWl(w)}
                              className="rounded-md border border-border bg-secondary p-1.5 text-muted-foreground hover:text-destructive hover:bg-accent"
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Holding modal */}
      <HoldingModal
        open={holdingModalOpen}
        onClose={() => { setHoldingModalOpen(false); setEditingHolding(null); }}
        onSubmit={handleSubmitHolding}
        initial={editingHolding}
        existingTickers={holdings.map((h) => h.ticker)}
      />

      <ConfirmDialog
        open={!!deletingHolding}
        title="Remove holding"
        message={`Remove ${deletingHolding?.ticker} from the template portfolio?`}
        confirmLabel="Remove"
        destructive
        onConfirm={confirmDeleteHolding}
        onCancel={() => setDeletingHolding(null)}
      />

      <ConfirmDialog
        open={!!deletingWl}
        title="Remove watchlist item"
        message={`Remove ${deletingWl?.ticker} from the template watchlist?`}
        confirmLabel="Remove"
        destructive
        onConfirm={confirmDeleteWl}
        onCancel={() => setDeletingWl(null)}
      />

      <ConfirmDialog
        open={!!pendingPromote}
        title="Promote empty portfolio?"
        message={`"${pendingPromote?.name}" has no holdings. Promoting it will mean new users sign up with an empty portfolio. Continue?`}
        confirmLabel="Promote anyway"
        destructive
        onConfirm={async () => {
          const id = pendingPromote?.id;
          setPendingPromote(null);
          if (id) await promoteToTemplate(id);
        }}
        onCancel={() => setPendingPromote(null)}
      />

      <WatchlistTemplateModal
        open={wlModalOpen}
        onClose={() => { setWlModalOpen(false); setEditingWl(null); }}
        onSubmit={handleSubmitWatchlist}
        initial={editingWl}
      />

      <CopyrightFooter />
    </div>
  );
};

// Inline modal — lightweight, similar shape to WatchlistModal but supports edit
interface WlModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { ticker: string; company_name?: string; target_price?: number; notes?: string }) => Promise<void>;
  initial: WatchlistTemplateRow | null;
}

function WatchlistTemplateModal({ open, onClose, onSubmit, initial }: WlModalProps) {
  const [ticker, setTicker] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  useEffect(() => {
    if (open) {
      setTicker(initial?.ticker ?? "");
      setCompanyName(initial?.company_name ?? "");
      setTargetPrice(initial?.target_price?.toString() ?? "");
      setNotes(initial?.notes ?? "");
    }
  }, [open, initial]);

  const lookup = async (sym: string) => {
    if (!sym) return;
    setLookingUp(true);
    try {
      const profile = await getCompanyProfile(sym.toUpperCase());
      if (profile && !companyName) setCompanyName(profile.name);
    } catch { /* ignore */ }
    finally { setLookingUp(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim()) return;
    setSaving(true);
    await onSubmit({
      ticker: ticker.trim(),
      company_name: companyName.trim() || undefined,
      target_price: targetPrice ? Number(targetPrice) : undefined,
      notes: notes.trim() || undefined,
    });
    setSaving(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">
            {initial ? "Edit watchlist item" : "Add watchlist item"}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Ticker</label>
            <div className="relative">
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                onBlur={(e) => lookup(e.target.value)}
                required
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm font-mono uppercase text-foreground focus:border-primary focus:outline-none"
              />
              {lookingUp && <Loader2 size={14} className="absolute right-3 top-2.5 animate-spin text-muted-foreground" />}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Company name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Target price (optional)</label>
            <input
              type="number"
              step="0.01"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border bg-secondary px-4 py-2 text-sm text-foreground hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "Saving…" : initial ? "Update" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminTemplates;
