import { useState, useMemo, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Loader2, RotateCcw, ArrowRightLeft, TrendingDown, DollarSign, AlertTriangle, Check } from "lucide-react";
import type { HoldingDisplay } from "@/hooks/usePortfolioData";
import { getQuote, getCompanyProfile, getBasicFinancials, type StockQuote, type CompanyProfile, type BasicFinancials } from "@/services/marketData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Scenario = "crash" | "swap" | "cash";

const SECTOR_COLORS = [
  "hsl(217, 91%, 60%)", "hsl(142, 71%, 45%)", "hsl(0, 84%, 60%)", "hsl(38, 92%, 50%)",
  "hsl(280, 65%, 60%)", "hsl(190, 90%, 50%)", "hsl(330, 70%, 55%)", "hsl(60, 70%, 50%)",
  "hsl(160, 60%, 45%)", "hsl(25, 85%, 55%)",
];

const fmtDollar = (n: number) => "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n: number) => n.toFixed(1) + "%";

interface WhatIfSimulatorProps {
  open: boolean;
  onClose: () => void;
  holdings: HoldingDisplay[];
  portfolioId: string | null;
  onApplied: () => void;
  sectorMap?: Map<string, string>; // ticker -> sector
}

export function WhatIfSimulator({ open, onClose, holdings, portfolioId, onApplied, sectorMap }: WhatIfSimulatorProps) {
  const [tab, setTab] = useState<Scenario>("crash");

  const reset = () => {
    setCrashPct(-20);
    setSwapFrom("");
    setSwapTo("");
    setSwapData(null);
    setCashAmount("");
    setCashTarget("");
    setCashData(null);
  };

  // ========= Scenario 1: Crash =========
  const [crashPct, setCrashPct] = useState(-20);
  const totalValue = holdings.reduce((s, h) => s + h.positionValue, 0);

  const crashResults = useMemo(() => {
    return holdings
      .map((h) => {
        const beta = 1.0; // default — we could fetch from API
        const drop = crashPct * beta;
        const newValue = h.positionValue * (1 + drop / 100);
        const loss = newValue - h.positionValue;
        return { ticker: h.ticker, currentValue: h.positionValue, newValue, loss, dropPct: drop };
      })
      .sort((a, b) => a.loss - b.loss);
  }, [holdings, crashPct]);

  const totalLoss = crashResults.reduce((s, r) => s + r.loss, 0);

  // ========= Scenario 2: Swap =========
  const [swapFrom, setSwapFrom] = useState("");
  const [swapTo, setSwapTo] = useState("");
  const [swapData, setSwapData] = useState<{ quote: StockQuote; profile: CompanyProfile | null; financials: BasicFinancials } | null>(null);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapApplying, setSwapApplying] = useState(false);

  const swapFromHolding = holdings.find((h) => h.id === swapFrom);

  const fetchSwapData = useCallback(async () => {
    const ticker = swapTo.trim().toUpperCase();
    if (!ticker) return;
    setSwapLoading(true);
    try {
      const [quote, profile, financials] = await Promise.all([
        getQuote(ticker),
        getCompanyProfile(ticker).catch(() => null),
        getBasicFinancials(ticker).catch(() => ({} as BasicFinancials)),
      ]);
      setSwapData({ quote, profile, financials });
    } catch {
      toast({ title: "Ticker not found", description: `Could not find data for ${ticker}`, variant: "destructive" });
      setSwapData(null);
    }
    setSwapLoading(false);
  }, [swapTo]);

  const swapSectorBefore = useMemo(() => {
    const map = new Map<string, number>();
    holdings.forEach((h) => {
      const sector = sectorMap?.get(h.ticker) ?? "Other";
      map.set(sector, (map.get(sector) ?? 0) + h.weight);
    });
    return [...map.entries()].map(([name, value], i) => ({ name, value: +value.toFixed(1), fill: SECTOR_COLORS[i % SECTOR_COLORS.length] }));
  }, [holdings, sectorMap]);

  const swapSectorAfter = useMemo(() => {
    if (!swapFromHolding || !swapData) return swapSectorBefore;
    const removedSector = sectorMap?.get(swapFromHolding.ticker) ?? "Other";
    const addedSector = swapData.profile?.finnhubIndustry ?? "Other";
    const map = new Map<string, number>();
    holdings.forEach((h) => {
      if (h.id === swapFrom) return;
      const sector = sectorMap?.get(h.ticker) ?? "Other";
      map.set(sector, (map.get(sector) ?? 0) + h.weight);
    });
    map.set(addedSector, (map.get(addedSector) ?? 0) + swapFromHolding.weight);
    return [...map.entries()].map(([name, value], i) => ({ name, value: +value.toFixed(1), fill: SECTOR_COLORS[i % SECTOR_COLORS.length] }));
  }, [swapFromHolding, swapData, holdings, sectorMap, swapFrom, swapSectorBefore]);

  const handleApplySwap = async () => {
    if (!swapFromHolding || !swapData || !portfolioId) return;
    setSwapApplying(true);
    try {
      const newTicker = swapTo.trim().toUpperCase();
      const shares = swapFromHolding.positionValue / swapData.quote.c;
      await supabase.from("holdings").delete().eq("id", swapFromHolding.id);
      await supabase.from("holdings").insert({
        portfolio_id: portfolioId,
        ticker: newTicker,
        company_name: swapData.profile?.name ?? newTicker,
        shares: parseFloat(shares.toFixed(6)),
        avg_cost_basis: swapData.quote.c,
        conviction_rating: 3,
      });
      toast({ title: "Swap applied ✓", description: `Sold ${swapFromHolding.ticker}, bought ${newTicker}` });
      onApplied();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setSwapApplying(false);
  };

  // ========= Scenario 3: Add Cash =========
  const [cashAmount, setCashAmount] = useState("");
  const [cashTarget, setCashTarget] = useState("");
  const [cashData, setCashData] = useState<{ quote: StockQuote; profile: CompanyProfile | null } | null>(null);
  const [cashLoading, setCashLoading] = useState(false);
  const [cashApplying, setCashApplying] = useState(false);
  const [cashIsNew, setCashIsNew] = useState(false);

  const cashTargetHolding = holdings.find((h) => h.id === cashTarget);

  useEffect(() => {
    if (cashTarget && !cashTargetHolding) {
      // It's a custom ticker
      setCashIsNew(true);
    } else {
      setCashIsNew(false);
      setCashData(null);
    }
  }, [cashTarget, cashTargetHolding]);

  const fetchCashData = useCallback(async () => {
    if (!cashIsNew || !cashTarget) return;
    setCashLoading(true);
    try {
      const ticker = cashTarget.trim().toUpperCase();
      const [quote, profile] = await Promise.all([
        getQuote(ticker),
        getCompanyProfile(ticker).catch(() => null),
      ]);
      setCashData({ quote, profile });
    } catch {
      toast({ title: "Ticker not found", variant: "destructive" });
      setCashData(null);
    }
    setCashLoading(false);
  }, [cashTarget, cashIsNew]);

  const cashNum = parseFloat(cashAmount) || 0;
  const cashPreview = useMemo(() => {
    if (cashNum <= 0) return null;
    const newTotal = totalValue + cashNum;
    if (cashTargetHolding) {
      const newPosValue = cashTargetHolding.positionValue + cashNum;
      const newShares = cashTargetHolding.shares + cashNum / cashTargetHolding.currentPrice;
      const newWeight = (newPosValue / newTotal) * 100;
      const oldWeight = cashTargetHolding.weight;
      return { newPosValue, newShares, newWeight, oldWeight, newTotal, ticker: cashTargetHolding.ticker };
    }
    if (cashIsNew && cashData) {
      const shares = cashNum / cashData.quote.c;
      const newWeight = (cashNum / newTotal) * 100;
      return { newPosValue: cashNum, newShares: shares, newWeight, oldWeight: 0, newTotal, ticker: cashTarget.toUpperCase() };
    }
    return null;
  }, [cashNum, cashTargetHolding, cashIsNew, cashData, totalValue, cashTarget]);

  const handleApplyCash = async () => {
    if (!cashPreview || !portfolioId) return;
    setCashApplying(true);
    try {
      if (cashTargetHolding) {
        const addShares = cashNum / cashTargetHolding.currentPrice;
        const totalShares = cashTargetHolding.shares + addShares;
        const newAvg = (cashTargetHolding.shares * cashTargetHolding.avgCostBasis + cashNum) / totalShares;
        await supabase.from("holdings").update({
          shares: parseFloat(totalShares.toFixed(6)),
          avg_cost_basis: parseFloat(newAvg.toFixed(4)),
        }).eq("id", cashTargetHolding.id);
      } else if (cashIsNew && cashData) {
        const ticker = cashTarget.trim().toUpperCase();
        const shares = cashNum / cashData.quote.c;
        await supabase.from("holdings").insert({
          portfolio_id: portfolioId,
          ticker,
          company_name: cashData.profile?.name ?? ticker,
          shares: parseFloat(shares.toFixed(6)),
          avg_cost_basis: cashData.quote.c,
          conviction_rating: 3,
        });
      }
      toast({ title: "Investment applied ✓", description: `Added $${cashNum.toLocaleString()} to ${cashPreview.ticker}` });
      onApplied();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setCashApplying(false);
  };

  const tabs: { key: Scenario; label: string; icon: typeof TrendingDown }[] = [
    { key: "crash", label: "Market Crash", icon: TrendingDown },
    { key: "swap", label: "Position Swap", icon: ArrowRightLeft },
    { key: "cash", label: "Add Cash", icon: DollarSign },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto bg-card border-border p-0">
        <DialogHeader className="p-5 pb-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-foreground text-lg">What If Simulator</DialogTitle>
            <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground text-xs gap-1">
              <RotateCcw size={12} /> Reset
            </Button>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b border-border mx-5">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors relative ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Icon size={13} /> {t.label}
                {active && <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-primary rounded-full" />}
              </button>
            );
          })}
        </div>

        <div className="p-5 pt-4">
          {/* ========== CRASH ========== */}
          {tab === "crash" && (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground text-xs">What if the market drops {Math.abs(crashPct)}%?</Label>
                <Slider
                  value={[crashPct]}
                  onValueChange={([v]) => setCrashPct(v)}
                  min={-50}
                  max={-5}
                  step={1}
                  className="mt-3"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>-50%</span>
                  <span className="font-mono font-semibold text-loss text-sm">{crashPct}%</span>
                  <span>-5%</span>
                </div>
              </div>

              {/* Total loss */}
              <div className="rounded-lg border border-loss/30 bg-loss/5 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Estimated Portfolio Loss</p>
                <p className="font-mono text-2xl font-bold text-loss">-{fmtDollar(Math.abs(totalLoss))}</p>
                <p className="font-mono text-xs text-muted-foreground mt-1">
                  Portfolio: {fmtDollar(totalValue)} → {fmtDollar(totalValue + totalLoss)}
                </p>
              </div>

              {/* Table */}
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-secondary/50 border-b border-border">
                      <th className="text-left py-2 px-3 text-muted-foreground font-semibold">Ticker</th>
                      <th className="text-right py-2 px-3 text-muted-foreground font-semibold">Current</th>
                      <th className="text-right py-2 px-3 text-muted-foreground font-semibold">Est. New</th>
                      <th className="text-right py-2 px-3 text-muted-foreground font-semibold">Drop</th>
                      <th className="text-right py-2 px-3 text-muted-foreground font-semibold">Loss</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crashResults.map((r) => (
                      <tr key={r.ticker} className="border-b border-border/30">
                        <td className="py-2 px-3 font-mono font-semibold text-foreground">{r.ticker}</td>
                        <td className="py-2 px-3 text-right font-mono text-muted-foreground">{fmtDollar(r.currentValue)}</td>
                        <td className="py-2 px-3 text-right font-mono text-foreground">{fmtDollar(r.newValue)}</td>
                        <td className="py-2 px-3 text-right font-mono text-loss">{r.dropPct.toFixed(1)}%</td>
                        <td className="py-2 px-3 text-right font-mono text-loss">-{fmtDollar(Math.abs(r.loss))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Hardest hit */}
              {crashResults.length > 0 && (
                <div className="flex items-start gap-2 rounded-md bg-warning/10 border border-warning/20 px-3 py-2">
                  <AlertTriangle size={14} className="text-warning shrink-0 mt-0.5" />
                  <p className="text-[11px] text-muted-foreground">
                    Hardest hit: <span className="text-foreground font-semibold">{crashResults[0].ticker}</span> would lose{" "}
                    <span className="text-loss font-mono">{fmtDollar(Math.abs(crashResults[0].loss))}</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ========== SWAP ========== */}
          {tab === "swap" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-muted-foreground text-xs">Sell</Label>
                  <Select value={swapFrom} onValueChange={setSwapFrom}>
                    <SelectTrigger className="mt-1 bg-secondary border-border text-xs">
                      <SelectValue placeholder="Select holding…" />
                    </SelectTrigger>
                    <SelectContent>
                      {holdings.map((h) => (
                        <SelectItem key={h.id} value={h.id} className="text-xs">
                          {h.ticker} — {fmtDollar(h.positionValue)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Buy (new ticker)</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={swapTo}
                      onChange={(e) => { setSwapTo(e.target.value.toUpperCase()); setSwapData(null); }}
                      placeholder="MSFT"
                      className="bg-secondary border-border font-mono text-xs"
                    />
                    <Button size="sm" onClick={fetchSwapData} disabled={!swapTo.trim() || swapLoading} className="text-xs shrink-0">
                      {swapLoading ? <Loader2 size={12} className="animate-spin" /> : "Lookup"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Side-by-side comparison */}
              {swapFromHolding && swapData && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <ComparisonCard
                      label="Current Position"
                      ticker={swapFromHolding.ticker}
                      value={swapFromHolding.positionValue}
                      sector={sectorMap?.get(swapFromHolding.ticker) ?? "—"}
                      divYield={swapFromHolding.divYield}
                      pe={null}
                      variant="sell"
                    />
                    <ComparisonCard
                      label="Proposed Position"
                      ticker={swapTo.toUpperCase()}
                      value={swapFromHolding.positionValue}
                      sector={swapData.profile?.finnhubIndustry ?? "—"}
                      divYield={swapData.financials?.dividendYieldIndicatedAnnual ?? null}
                      pe={swapData.financials?.peNormalizedAnnual ?? null}
                      variant="buy"
                    />
                  </div>

                  {/* Sector allocation before/after */}
                  <div className="grid grid-cols-2 gap-3">
                    <MiniDonut title="Before" data={swapSectorBefore} />
                    <MiniDonut title="After" data={swapSectorAfter} />
                  </div>

                  <Button onClick={handleApplySwap} disabled={swapApplying} className="w-full gap-2">
                    {swapApplying ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Apply This Swap
                  </Button>
                </>
              )}
            </div>
          )}

          {/* ========== CASH ========== */}
          {tab === "cash" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-muted-foreground text-xs">Amount to invest ($)</Label>
                  <Input
                    type="number"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    placeholder="1000"
                    className="mt-1 bg-secondary border-border font-mono text-xs"
                    min="0"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Into</Label>
                  <Select value={cashTarget} onValueChange={(v) => { setCashTarget(v); setCashData(null); }}>
                    <SelectTrigger className="mt-1 bg-secondary border-border text-xs">
                      <SelectValue placeholder="Select or type…" />
                    </SelectTrigger>
                    <SelectContent>
                      {holdings.map((h) => (
                        <SelectItem key={h.id} value={h.id} className="text-xs">
                          {h.ticker} ({fmtPct(h.weight)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2 mt-1.5">
                    <Input
                      value={cashIsNew ? cashTarget : ""}
                      onChange={(e) => { setCashTarget(e.target.value.toUpperCase()); }}
                      placeholder="Or enter new ticker…"
                      className="bg-secondary border-border font-mono text-xs"
                    />
                    {cashIsNew && (
                      <Button size="sm" onClick={fetchCashData} disabled={cashLoading || !cashTarget} className="text-xs shrink-0">
                        {cashLoading ? <Loader2 size={12} className="animate-spin" /> : "Lookup"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Preview */}
              {cashPreview && (
                <>
                  <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">New position value</span>
                      <span className="font-mono text-foreground">{fmtDollar(cashPreview.newPosValue)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Shares</span>
                      <span className="font-mono text-foreground">{cashPreview.newShares.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Portfolio weight</span>
                      <span className="font-mono text-foreground">
                        {fmtPct(cashPreview.oldWeight)} → <span className="text-primary">{fmtPct(cashPreview.newWeight)}</span>
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">New portfolio total</span>
                      <span className="font-mono text-foreground">{fmtDollar(cashPreview.newTotal)}</span>
                    </div>
                  </div>

                  {/* Concentration warning */}
                  {cashPreview.newWeight > 20 && (
                    <div className="flex items-start gap-2 rounded-md bg-warning/10 border border-warning/20 px-3 py-2">
                      <AlertTriangle size={14} className="text-warning shrink-0 mt-0.5" />
                      <p className="text-[11px] text-muted-foreground">
                        {cashPreview.ticker} would be <span className="text-warning font-semibold">{fmtPct(cashPreview.newWeight)}</span> of your portfolio — high concentration risk
                      </p>
                    </div>
                  )}

                  <Button onClick={handleApplyCash} disabled={cashApplying} className="w-full gap-2">
                    {cashApplying ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Apply This Investment
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ComparisonCard({ label, ticker, value, sector, divYield, pe, variant }: {
  label: string; ticker: string; value: number; sector: string; divYield: number | null; pe: number | null; variant: "sell" | "buy";
}) {
  const borderColor = variant === "sell" ? "border-loss/30" : "border-gain/30";
  const bgColor = variant === "sell" ? "bg-loss/5" : "bg-gain/5";
  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} p-3 space-y-1.5`}>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="font-mono text-sm font-bold text-foreground">{ticker}</p>
      <div className="space-y-1 text-[11px]">
        <div className="flex justify-between"><span className="text-muted-foreground">Value</span><span className="font-mono text-foreground">{fmtDollar(value)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Sector</span><span className="text-foreground">{sector}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Div Yield</span><span className="font-mono text-foreground">{divYield != null ? divYield.toFixed(2) + "%" : "—"}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">P/E</span><span className="font-mono text-foreground">{pe != null ? pe.toFixed(1) : "—"}</span></div>
      </div>
    </div>
  );
}

function MiniDonut({ title, data }: { title: string; data: { name: string; value: number; fill: string }[] }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/20 p-3">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide text-center mb-1">{title}</p>
      <div className="h-[100px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={25} outerRadius={42} strokeWidth={1} stroke="hsl(240, 16%, 8%)">
              {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
            </Pie>
            <Tooltip
              contentStyle={{ background: "hsl(240, 16%, 8%)", border: "1px solid hsl(240, 14%, 16%)", borderRadius: 6, fontSize: 10 }}
              itemStyle={{ color: "hsl(215, 25%, 91%)" }}
              formatter={(value: number) => [`${value.toFixed(1)}%`, ""]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-0.5 mt-1">
        {data.slice(0, 4).map((d) => (
          <div key={d.name} className="flex items-center gap-1.5 text-[10px]">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: d.fill }} />
            <span className="text-muted-foreground truncate">{d.name}</span>
            <span className="ml-auto font-mono text-foreground">{d.value.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
