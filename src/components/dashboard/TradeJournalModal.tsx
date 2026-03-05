import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { getQuote } from "@/services/marketData";
import { ConfirmDialog } from "./ConfirmDialog";
import { EXIT_REASONS, GRADES } from "@/constants";

interface TradeJournalModalProps {
  open: boolean;
  onClose: () => void;
  prefillTicker?: string;
  prefillPrice?: number;
  holdingId?: string;
  holdingShares?: number;
  holdingAvgCost?: number;
  portfolioId?: string;
  onTradeLogged: () => void;
}

export function TradeJournalModal({
  open, onClose, prefillTicker, prefillPrice, holdingId, holdingShares, holdingAvgCost, portfolioId, onTradeLogged,
}: TradeJournalModalProps) {
  const [action, setAction] = useState<"BUY" | "SELL">("BUY");
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [thesis, setThesis] = useState("");
  const [exitReason, setExitReason] = useState("");
  const [selfGrade, setSelfGrade] = useState("");
  const [saving, setSaving] = useState(false);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [pendingRemoveHoldingId, setPendingRemoveHoldingId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTicker(prefillTicker ?? "");
      setPrice(prefillPrice?.toFixed(2) ?? "");
      setShares("");
      setDate(new Date().toISOString().slice(0, 10));
      setThesis("");
      setExitReason("");
      setSelfGrade("");
      setAction("BUY");

      if (prefillTicker && !prefillPrice) {
        setFetchingPrice(true);
        getQuote(prefillTicker).then((q) => setPrice(q.c.toFixed(2))).catch(() => {}).finally(() => setFetchingPrice(false));
      }
    }
  }, [open, prefillTicker, prefillPrice]);

  const handleSubmit = async () => {
    if (!ticker.trim() || !shares || !price) {
      toast({ title: "Missing fields", description: "Ticker, shares, and price are required.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const numShares = parseFloat(shares);
      const numPrice = parseFloat(price);
      const tickerUp = ticker.trim().toUpperCase();

      const { error: journalErr } = await supabase.from("trade_journal").insert({
        user_id: session.user.id,
        ticker: tickerUp,
        action: action,
        shares: numShares,
        price_at_action: numPrice,
        thesis_at_time: thesis.trim() || null,
        exit_reason: action === "SELL" ? (exitReason || null) : null,
        self_grade: action === "SELL" ? (selfGrade || null) : null,
      });
      if (journalErr) throw journalErr;

      if (action === "BUY") {
        if (holdingId && holdingShares != null && holdingAvgCost != null) {
          const totalOldCost = holdingShares * holdingAvgCost;
          const totalNewCost = numShares * numPrice;
          const newTotalShares = holdingShares + numShares;
          const newAvgCost = (totalOldCost + totalNewCost) / newTotalShares;
          await supabase.from("holdings").update({
            shares: newTotalShares,
            avg_cost_basis: parseFloat(newAvgCost.toFixed(4)),
          }).eq("id", holdingId);
        } else if (portfolioId) {
          await supabase.from("holdings").insert({
            portfolio_id: portfolioId,
            ticker: tickerUp,
            company_name: tickerUp,
            shares: numShares,
            avg_cost_basis: numPrice,
            conviction_rating: 3,
          });
        }
      } else {
        if (holdingId && holdingShares != null) {
          const remaining = holdingShares - numShares;
          if (remaining <= 0) {
            setPendingRemoveHoldingId(holdingId);
            setShowRemoveConfirm(true);
            setSaving(false);
            toast({ title: "Trade logged ✓", description: `${action} ${numShares} ${tickerUp} @ $${numPrice.toFixed(2)}` });
            onTradeLogged();
            onClose();
            return;
          } else {
            await supabase.from("holdings").update({ shares: remaining }).eq("id", holdingId);
          }
        }
      }

      toast({ title: "Trade logged ✓", description: `${action} ${numShares} ${tickerUp} @ $${numPrice.toFixed(2)}` });
      onTradeLogged();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Error logging trade", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Log Trade</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={action === "BUY" ? "default" : "outline"}
                className={action === "BUY" ? "flex-1 bg-gain hover:bg-gain/90 text-background" : "flex-1"}
                onClick={() => setAction("BUY")}
              >
                BUY
              </Button>
              <Button
                type="button"
                variant={action === "SELL" ? "default" : "outline"}
                className={action === "SELL" ? "flex-1 bg-loss hover:bg-loss/90 text-background" : "flex-1"}
                onClick={() => setAction("SELL")}
              >
                SELL
              </Button>
            </div>

            <div>
              <Label className="text-muted-foreground text-xs">Ticker</Label>
              <Input
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="AAPL"
                className="mt-1 bg-secondary border-border font-mono"
                disabled={!!prefillTicker}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-muted-foreground text-xs">Shares</Label>
                <Input type="number" value={shares} onChange={(e) => setShares(e.target.value)} placeholder="0" className="mt-1 bg-secondary border-border font-mono" min="0" step="any" />
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Price Per Share</Label>
                <div className="relative mt-1">
                  <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" className="bg-secondary border-border font-mono" min="0" step="any" />
                  {fetchingPrice && <Loader2 size={14} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
                </div>
              </div>
            </div>

            <div>
              <Label className="text-muted-foreground text-xs">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 bg-secondary border-border" />
            </div>

            <div>
              <Label className="text-muted-foreground text-xs">
                {action === "BUY" ? "Why are you buying this? What's your thesis?" : "Why are you selling? What changed?"}
              </Label>
              <Textarea
                value={thesis}
                onChange={(e) => setThesis(e.target.value)}
                placeholder={action === "BUY" ? "Strong earnings growth, undervalued relative to peers…" : "Thesis no longer intact, better opportunities…"}
                className="mt-1 bg-secondary border-border min-h-[60px] text-xs"
                maxLength={1000}
              />
            </div>

            {action === "SELL" && (
              <div>
                <Label className="text-muted-foreground text-xs">Exit Reason</Label>
                <Select value={exitReason} onValueChange={setExitReason}>
                  <SelectTrigger className="mt-1 bg-secondary border-border text-xs">
                    <SelectValue placeholder="Select reason…" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXIT_REASONS.map((r) => (
                      <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {action === "SELL" && (
              <div>
                <Label className="text-muted-foreground text-xs">Self-Grade</Label>
                <div className="flex gap-1.5 mt-1.5" role="group" aria-label="Self grade">
                  {GRADES.map((g) => (
                    <button
                      key={g.grade}
                      type="button"
                      onClick={() => setSelfGrade(g.grade)}
                      title={g.label}
                      aria-label={`Grade ${g.grade}: ${g.label}`}
                      className={`h-8 w-8 rounded-md text-xs font-bold transition-all ${
                        selfGrade === g.grade
                          ? `${g.color} ring-2 ring-ring scale-110`
                          : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                      }`}
                    >
                      {g.grade}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={handleSubmit} disabled={saving} className="w-full">
              {saving ? <><Loader2 size={14} className="animate-spin mr-2" /> Saving…</> : "Log Trade"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={showRemoveConfirm}
        title="Remove from Portfolio?"
        message="This holding's shares have reached 0. Remove it from your portfolio?"
        confirmLabel="Remove"
        destructive
        onConfirm={async () => {
          if (pendingRemoveHoldingId) {
            await supabase.from("holdings").delete().eq("id", pendingRemoveHoldingId);
            onTradeLogged();
          }
          setShowRemoveConfirm(false);
          setPendingRemoveHoldingId(null);
        }}
        onCancel={() => { setShowRemoveConfirm(false); setPendingRemoveHoldingId(null); }}
      />
    </>
  );
}
