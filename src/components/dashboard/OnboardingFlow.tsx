import { useState, useEffect, useRef, useCallback } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { getCompanyProfile, getQuote } from "@/services/marketData";
import { Star, ArrowRight, Check, X, Loader2, Plus, BarChart3, Brain, TrendingUp, Target, User } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Step = "profile" | "welcome" | "holdings" | "preferences" | "tour";

const STEP_ORDER: Step[] = ["profile", "welcome", "holdings", "preferences", "tour"];

const profileSchema = z.object({
  email: z.string().trim().email({ message: "Enter a valid email address" }).max(255),
  fullName: z.string().trim().min(1, { message: "Full name is required" }).max(100),
});

// ─── Step 0: Profile ─────────────────────────────────────────────
function ProfileStep({ onNext }: { onNext: () => void }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [errors, setErrors] = useState<{ email?: string; fullName?: string }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      setEmail(
        (profile?.email && profile.email.trim()) ||
        user.email ||
        (typeof meta.email === "string" ? meta.email : "") ||
        ""
      );
      setFullName(
        (profile?.full_name && profile.full_name.trim()) ||
        (typeof meta.full_name === "string" ? meta.full_name : "") ||
        (typeof meta.name === "string" ? meta.name : "") ||
        ""
      );
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async () => {
    const result = profileSchema.safeParse({ email, fullName });
    if (!result.success) {
      const fieldErrors: { email?: string; fullName?: string } = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as "email" | "fullName";
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      toast({ title: "Not signed in", variant: "destructive" });
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ email: result.data.email, full_name: result.data.fullName })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save profile", description: error.message, variant: "destructive" });
      return;
    }
    onNext();
  };

  return (
    <div className="flex flex-col items-center text-center animate-fade-in px-4 w-full max-w-md mx-auto">
      <div className="rounded-2xl bg-primary/10 p-5 mb-5">
        <User size={40} className="text-primary" />
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-2">Tell us about you</h2>
      <p className="text-sm text-muted-foreground mb-6">
        We'll use this to personalize your experience.
      </p>

      <div className="w-full space-y-4 text-left mb-6">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Full name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={loading || saving}
            placeholder="Jane Doe"
            maxLength={100}
            className={`w-full rounded-md border ${errors.fullName ? "border-destructive" : "border-border"} bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50`}
          />
          {errors.fullName && <p className="mt-1 text-[11px] text-destructive">{errors.fullName}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading || saving}
            placeholder="you@example.com"
            maxLength={255}
            className={`w-full rounded-md border ${errors.email ? "border-destructive" : "border-border"} bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50`}
          />
          {errors.email && <p className="mt-1 text-[11px] text-destructive">{errors.email}</p>}
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading || saving}
        className="flex items-center gap-2 rounded-lg bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : null}
        Continue <ArrowRight size={16} />
      </button>
    </div>
  );
}

interface AddedHolding {
  ticker: string;
  companyName: string;
  shares: number;
  avgCost: number;
  conviction: number;
  targetPct: number | null;
  id?: string; // after saved
  currentPrice?: number;
}

interface OnboardingFlowProps {
  open: boolean;
  portfolioId: string;
  holdingsCount?: number;
  onComplete: () => void;
}

// ─── Step 1: Welcome ─────────────────────────────────────────────
function WelcomeStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <div className="flex flex-col items-center text-center animate-fade-in px-4">
      <div className="rounded-2xl bg-primary/10 p-5 mb-5">
        <Target size={40} className="text-primary" />
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-2">Welcome to TB4U 🎯</h2>
      <p className="text-sm text-muted-foreground mb-8 max-w-md">
        Your portfolio command center. Let's set it up in 2 minutes.
      </p>

      <div className="grid grid-cols-3 gap-6 mb-10 w-full max-w-lg">
        {[
          { icon: BarChart3, label: "Track everything in one place", emoji: "📊" },
          { icon: Brain, label: "AI-powered insights and alerts", emoji: "🧠" },
          { icon: TrendingUp, label: "Make smarter, data-driven decisions", emoji: "📈" },
        ].map((f) => (
          <div key={f.emoji} className="flex flex-col items-center gap-2 rounded-lg border border-border bg-secondary/30 p-4">
            <span className="text-2xl">{f.emoji}</span>
            <p className="text-[11px] text-muted-foreground leading-tight text-center">{f.label}</p>
          </div>
        ))}
      </div>

      <button
        onClick={onNext}
        className="flex items-center gap-2 rounded-lg bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all hover:scale-105"
      >
        Let's Go <ArrowRight size={16} />
      </button>
      <button onClick={onSkip} className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors">
        Skip setup — I'll explore on my own
      </button>
    </div>
  );
}

// ─── Ticker Search ───────────────────────────────────────────────
function TickerSearch({ onSelect, disabled }: { onSelect: (ticker: string, name: string) => void; disabled?: boolean }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<{ ticker: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback(async (q: string) => {
    if (q.length < 1) { setResult(null); setError(null); return; }
    setSearching(true);
    setError(null);
    try {
      const profile = await getCompanyProfile(q.toUpperCase());
      if (profile) {
        setResult({ ticker: profile.ticker, name: profile.name });
      } else {
        setResult(null);
        setError("Ticker not found");
      }
    } catch {
      setResult(null);
      setError("Lookup failed");
    }
    setSearching(false);
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (query.length >= 1) {
      debounceRef.current = setTimeout(() => search(query), 400);
    } else {
      setResult(null);
      setError(null);
    }
    return () => clearTimeout(debounceRef.current);
  }, [query, search]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value.toUpperCase())}
          placeholder="Enter ticker (e.g. AAPL)"
          disabled={disabled}
          className={`w-full rounded-md border ${error ? "border-destructive" : "border-border"} bg-secondary px-3 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50`}
        />
        {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
      {result && (
        <button
          onClick={() => { onSelect(result.ticker, result.name); setQuery(""); setResult(null); }}
          className="flex w-full items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-left hover:bg-secondary/50 transition-colors"
        >
          <span className="font-mono text-sm font-bold text-foreground">{result.ticker}</span>
          <span className="text-xs text-muted-foreground truncate">{result.name}</span>
          <Plus size={14} className="ml-auto text-primary shrink-0" />
        </button>
      )}
    </div>
  );
}

// ─── Step 2: Add Holdings ────────────────────────────────────────
function HoldingsStep({
  holdings, onAdd, onRemove, onNext, onSkip, saving,
}: {
  holdings: AddedHolding[];
  onAdd: (ticker: string, name: string) => void;
  onRemove: (ticker: string) => void;
  onNext: () => void;
  onSkip: () => void;
  saving: boolean;
}) {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [shares, setShares] = useState("");
  const [cost, setCost] = useState("");

  const handleSelect = (ticker: string, name: string) => {
    if (holdings.find((h) => h.ticker === ticker)) return;
    setSelectedTicker(ticker);
    // Auto-fill with current price
    getQuote(ticker).then((q) => {
      setCost(q.c.toFixed(2));
    }).catch(() => {});
    onAdd(ticker, name);
    setSelectedTicker(null);
  };

  const totalValue = holdings.reduce((s, h) => s + h.shares * (h.currentPrice ?? h.avgCost), 0);

  return (
    <div className="animate-fade-in px-4 w-full max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-foreground mb-1 text-center">Add Your First Holdings</h2>
      <p className="text-sm text-muted-foreground mb-6 text-center">
        Let's add your top 3–5 holdings to get started
      </p>

      {holdings.length < 5 && (
        <TickerSearch onSelect={handleSelect} disabled={holdings.length >= 5} />
      )}

      {/* Added holdings */}
      {holdings.length > 0 && (
        <div className="mt-4 space-y-2">
          {holdings.map((h) => (
            <HoldingQuickEdit
              key={h.ticker}
              holding={h}
              onChange={(shares, cost) => {
                h.shares = shares;
                h.avgCost = cost;
              }}
              onRemove={() => onRemove(h.ticker)}
            />
          ))}
        </div>
      )}

      {holdings.length > 0 && totalValue > 0 && (
        <div className="mt-4 rounded-md border border-gain/30 bg-gain/5 px-3 py-2 text-center">
          <p className="text-xs text-gain">
            Great! You've added {holdings.length} holding{holdings.length !== 1 ? "s" : ""} worth approximately <span className="font-mono font-semibold">${totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-col items-center gap-2">
        <button
          onClick={onNext}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : null}
          {holdings.length === 0 ? "Skip" : "Continue"} <ArrowRight size={16} />
        </button>
        {holdings.length > 0 && (
          <button onClick={onSkip} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Skip — I'll set up later
          </button>
        )}
      </div>
    </div>
  );
}

function HoldingQuickEdit({ holding, onChange, onRemove }: {
  holding: AddedHolding;
  onChange: (shares: number, cost: number) => void;
  onRemove: () => void;
}) {
  const [shares, setShares] = useState(holding.shares > 0 ? String(holding.shares) : "");
  const [cost, setCost] = useState(holding.avgCost > 0 ? String(holding.avgCost) : "");

  useEffect(() => {
    const s = parseFloat(shares) || 0;
    const c = parseFloat(cost) || 0;
    onChange(s, c);
  }, [shares, cost]);

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
      <div className="min-w-[60px]">
        <span className="font-mono text-sm font-bold text-foreground">{holding.ticker}</span>
        <p className="text-[10px] text-muted-foreground truncate max-w-[80px]">{holding.companyName}</p>
      </div>
      <input
        type="number"
        placeholder="Shares"
        value={shares}
        onChange={(e) => setShares(e.target.value)}
        className="w-20 rounded border border-border bg-secondary px-2 py-1 text-xs font-mono text-foreground focus:border-primary focus:outline-none"
      />
      <span className="text-muted-foreground text-xs">@</span>
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
        <input
          type="number"
          placeholder="Cost"
          step="0.01"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          className="w-24 rounded border border-border bg-secondary pl-5 pr-2 py-1 text-xs font-mono text-foreground focus:border-primary focus:outline-none"
        />
      </div>
      <button onClick={onRemove} className="ml-auto text-muted-foreground hover:text-destructive transition-colors">
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Step 3: Preferences ─────────────────────────────────────────
function PreferencesStep({
  holdings, onUpdateConviction, onUpdateTarget, onNext, onSkip,
}: {
  holdings: AddedHolding[];
  onUpdateConviction: (ticker: string, rating: number) => void;
  onUpdateTarget: (ticker: string, pct: number | null) => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const [showTargets, setShowTargets] = useState(false);

  if (holdings.length === 0) {
    return (
      <div className="animate-fade-in px-4 text-center">
        <h2 className="text-xl font-bold text-foreground mb-2">Preferences</h2>
        <p className="text-sm text-muted-foreground mb-6">No holdings to configure. Let's move on!</p>
        <button onClick={onNext} className="flex items-center gap-2 mx-auto rounded-lg bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          Continue <ArrowRight size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in px-4 w-full max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-foreground mb-1 text-center">Set Your Preferences</h2>
      <p className="text-sm text-muted-foreground mb-6 text-center">Rate your conviction for each position</p>

      <div className="space-y-3 mb-6">
        {holdings.map((h) => (
          <div key={h.ticker} className="rounded-md border border-border bg-card px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="font-mono text-sm font-bold text-foreground">{h.ticker}</span>
                <span className="text-xs text-muted-foreground ml-2">{h.companyName}</span>
              </div>
              <ConvictionInput value={h.conviction} onChange={(v) => onUpdateConviction(h.ticker, v)} />
            </div>
            {showTargets && (
              <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/50">
                <span className="text-[11px] text-muted-foreground">Target %</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={h.targetPct ?? ""}
                  onChange={(e) => onUpdateTarget(h.ticker, e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="—"
                  className="w-16 rounded border border-border bg-secondary px-2 py-1 text-xs font-mono text-foreground focus:border-primary focus:outline-none text-center"
                />
                <span className="text-[10px] text-muted-foreground">%</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {!showTargets && (
        <div className="rounded-md border border-border bg-secondary/30 px-4 py-3 mb-6">
          <p className="text-xs text-muted-foreground mb-2">Want to set target allocation percentages? This helps alert you when your portfolio drifts.</p>
          <div className="flex gap-2">
            <button onClick={() => setShowTargets(true)} className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
              Yes, help me set targets
            </button>
            <button onClick={onNext} className="rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
              Not now
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col items-center gap-2">
        <button onClick={onNext} className="flex items-center gap-2 rounded-lg bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all">
          Continue <ArrowRight size={16} />
        </button>
        <button onClick={onSkip} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Skip
        </button>
      </div>
    </div>
  );
}

function ConvictionInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          onClick={() => onChange(i)}
          className="p-0.5 transition-colors"
        >
          <Star size={16} className={i <= value ? "fill-primary text-primary" : "text-muted-foreground/30 hover:text-muted-foreground/60"} />
        </button>
      ))}
    </div>
  );
}

// ─── Step 4: Tour ────────────────────────────────────────────────
type TourStepDef = { selector: string; title: string; description: string; emphasize?: boolean };

function buildTourSteps(holdingsCount: number): TourStepDef[] {
  const seededDescription = holdingsCount > 0
    ? `We've pre-loaded ${holdingsCount} sample holding${holdingsCount === 1 ? "" : "s"} so you can explore right away. Click any row for details, or use Add Holding to make it yours.`
    : "Your holdings will appear here. Use Add Holding to start tracking your positions.";
  return [
    { selector: "[data-tour='holdings']", title: "Your Starter Portfolio", description: seededDescription, emphasize: true },
    { selector: "[data-tour='sidebar']", title: "Intelligence Hub", description: "News, events, and analytics — all in one place." },
    { selector: "[data-tour='macro']", title: "Market Pulse", description: "Market pulse at a glance — S&P 500, DXY, FOMC dates." },
    { selector: "[data-tour='header']", title: "Portfolio Performance", description: "Your real-time P&L and performance metrics." },
    { selector: "[data-tour='watchlist']", title: "Watchlist", description: "Track stocks you're considering before buying." },
  ];
}

function TourStep({ step, total, current, onNext, onSkip, onFinish }: {
  step: TourStepDef;
  total: number;
  current: number;
  onNext: () => void;
  onSkip: () => void;
  onFinish: () => void;
}) {
  const isLast = current === total - 1;
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const el = document.querySelector(step.selector);
    if (el) {
      const rect = el.getBoundingClientRect();
      const ringClasses = step.emphasize
        ? ["ring-4", "ring-primary", "ring-offset-2", "ring-offset-background", "relative", "z-[60]", "animate-pulse", "rounded-lg"]
        : ["ring-2", "ring-primary", "ring-offset-2", "ring-offset-background", "relative", "z-[60]"];
      el.classList.add(...ringClasses);
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setPos({
        top: Math.min(rect.bottom + 12, window.innerHeight - 180),
        left: Math.max(16, Math.min(rect.left, window.innerWidth - 340)),
      });
      return () => {
        el.classList.remove(...ringClasses);
      };
    }
  }, [step.selector, step.emphasize]);

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onSkip} />
      {/* Tooltip */}
      {pos && (
        <div
          className="fixed z-[61] w-[300px] rounded-lg border border-border bg-card p-4 shadow-xl animate-fade-in"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              {current + 1}/{total}
            </span>
            <h4 className="text-sm font-semibold text-foreground">{step.title}</h4>
          </div>
          <p className="text-xs text-muted-foreground mb-4">{step.description}</p>
          <div className="flex items-center justify-between">
            <button onClick={onSkip} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
              Skip Tour
            </button>
            <button
              onClick={isLast ? onFinish : onNext}
              className="flex items-center gap-1 rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {isLast ? (
                <>All set! 🎯</>
              ) : (
                <>Next <ArrowRight size={12} /></>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Main Onboarding Flow ────────────────────────────────────────
export function OnboardingFlow({ open, portfolioId, holdingsCount = 0, onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState<Step>("welcome");
  const [holdings, setHoldings] = useState<AddedHolding[]>([]);
  const [saving, setSaving] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);
  const tourSteps = buildTourSteps(holdingsCount);

  const finish = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await supabase.from("profiles").update({ onboarding_completed: true } as any).eq("id", session.user.id);
    }
    onComplete();
  }, [onComplete]);

  const handleAddTicker = (ticker: string, name: string) => {
    if (holdings.find((h) => h.ticker === ticker)) return;
    setHoldings((prev) => [...prev, {
      ticker, companyName: name, shares: 0, avgCost: 0, conviction: 3, targetPct: null,
    }]);
    // Fetch current price for display
    getQuote(ticker).then((q) => {
      setHoldings((prev) => prev.map((h) => h.ticker === ticker ? { ...h, avgCost: h.avgCost || q.c, currentPrice: q.c } : h));
    }).catch(() => {});
  };

  const handleRemoveTicker = (ticker: string) => {
    setHoldings((prev) => prev.filter((h) => h.ticker !== ticker));
  };

  const saveHoldings = async () => {
    const validHoldings = holdings.filter((h) => h.shares > 0 && h.avgCost > 0);
    if (validHoldings.length === 0) return;

    setSaving(true);
    for (const h of validHoldings) {
      await supabase.from("holdings").insert({
        portfolio_id: portfolioId,
        ticker: h.ticker,
        company_name: h.companyName,
        shares: h.shares,
        avg_cost_basis: h.avgCost,
        conviction_rating: h.conviction,
        target_allocation_pct: h.targetPct,
      });
    }
    setSaving(false);
  };

  const handleHoldingsNext = async () => {
    await saveHoldings();
    setStep("preferences");
  };

  const handlePreferencesNext = async () => {
    // Update conviction and target for saved holdings
    const validHoldings = holdings.filter((h) => h.shares > 0 && h.avgCost > 0);
    if (validHoldings.length > 0) {
      for (const h of validHoldings) {
        // Find the holding by ticker and portfolio
        const { data } = await supabase.from("holdings").select("id").eq("portfolio_id", portfolioId).eq("ticker", h.ticker).limit(1);
        if (data?.[0]) {
          await supabase.from("holdings").update({
            conviction_rating: h.conviction,
            target_allocation_pct: h.targetPct,
          }).eq("id", data[0].id);
        }
      }
    }
    setStep("tour");
  };

  if (!open) return null;

  // Tour step
  if (step === "tour") {
    return (
      <TourStep
        step={tourSteps[tourIndex]}
        total={tourSteps.length}
        current={tourIndex}
        onNext={() => setTourIndex((i) => i + 1)}
        onSkip={finish}
        onFinish={finish}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-xl border border-border bg-card shadow-2xl p-8">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {(["welcome", "holdings", "preferences", "tour"] as Step[]).map((s, i) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${
                s === step ? "w-8 bg-primary" : i < ["welcome", "holdings", "preferences", "tour"].indexOf(step) ? "w-4 bg-primary/40" : "w-4 bg-border"
              }`}
            />
          ))}
        </div>

        {step === "welcome" && (
          <WelcomeStep onNext={() => setStep("holdings")} onSkip={finish} />
        )}
        {step === "holdings" && (
          <HoldingsStep
            holdings={holdings}
            onAdd={handleAddTicker}
            onRemove={handleRemoveTicker}
            onNext={handleHoldingsNext}
            onSkip={finish}
            saving={saving}
          />
        )}
        {step === "preferences" && (
          <PreferencesStep
            holdings={holdings.filter((h) => h.shares > 0 && h.avgCost > 0)}
            onUpdateConviction={(ticker, rating) => {
              setHoldings((prev) => prev.map((h) => h.ticker === ticker ? { ...h, conviction: rating } : h));
            }}
            onUpdateTarget={(ticker, pct) => {
              setHoldings((prev) => prev.map((h) => h.ticker === ticker ? { ...h, targetPct: pct } : h));
            }}
            onNext={handlePreferencesNext}
            onSkip={finish}
          />
        )}
      </div>
    </div>
  );
}
