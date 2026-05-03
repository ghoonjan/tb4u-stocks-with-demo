import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PortfolioHeader } from "@/components/dashboard/PortfolioHeader";
import { TemplateAdminPanel } from "@/components/dashboard/TemplateAdminPanel";
import { WelcomeBanner } from "@/components/dashboard/WelcomeBanner";
import { HoldingsTable } from "@/components/dashboard/HoldingsTable";
import { IntelligenceSidebar } from "@/components/dashboard/IntelligenceSidebar";
import { WatchlistPanel } from "@/components/dashboard/WatchlistPanel";
import { HoldingModal } from "@/components/dashboard/HoldingModal";
import { WatchlistModal } from "@/components/dashboard/WatchlistModal";
import { ConfirmDialog } from "@/components/dashboard/ConfirmDialog";
import { TradeJournalModal } from "@/components/dashboard/TradeJournalModal";
import { TradeJournalPanel } from "@/components/dashboard/TradeJournalPanel";
import { WhatIfSimulator } from "@/components/dashboard/WhatIfSimulator";
import { ShareModal } from "@/components/dashboard/ShareModal";
import { MorningBriefing } from "@/components/dashboard/MorningBriefing";
import { useDailyBriefing } from "@/hooks/useDailyBriefing";
import { DigestSettings } from "@/components/dashboard/DigestSettings";
import { usePortfolioData, type HoldingDisplay } from "@/hooks/usePortfolioData";
import { useMacroData } from "@/hooks/useMacroData";
import CopyrightFooter from "@/components/CopyrightFooter";
import { usePerformanceMetrics } from "@/hooks/usePerformanceMetrics";
import { useAnalyticsData } from "@/hooks/useAnalyticsData";
import { toast } from "@/hooks/use-toast";
import { BookOpen, Loader2 } from "lucide-react";
import { useInitializeUser } from "@/hooks/useInitializeUser";
import { OfflineBanner } from "@/components/dashboard/OfflineBanner";
import { OnboardingFlow } from "@/components/dashboard/OnboardingFlow";
import { GradientMeshBackground } from "@/components/GradientMeshBackground";
import { useScrollReveal } from "@/hooks/useScrollReveal";

type AuthenticatedUser = {
  id: string;
  email: string | null;
};

function DashboardContent({ user, onLogout }: { user: AuthenticatedUser; onLogout: () => Promise<void> }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [digestOpen, setDigestOpen] = useState(false);
  const portfolio = usePortfolioData();
  const { macroData, loading: macroLoading } = useMacroData();
  const { simpleReturn, twr, twrAvailable } = usePerformanceMetrics(portfolio.holdings);
  const { analytics: analyticsMap } = useAnalyticsData(portfolio.holdings);
  const briefing = useDailyBriefing({
    holdings: portfolio.holdings,
    totalValue: portfolio.totalValue,
    todayPL: portfolio.todayPL,
    todayPLPct: portfolio.todayPLPct,
    macroData,
  });

  const [holdingModalOpen, setHoldingModalOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<HoldingDisplay | null>(null);
  const [deletingHolding, setDeletingHolding] = useState<HoldingDisplay | null>(null);
  const [watchlistModalOpen, setWatchlistModalOpen] = useState(false);
  const [prefillFromWatchlist, setPrefillFromWatchlist] = useState<{ ticker: string; companyName: string } | null>(null);
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [tradeModalHolding, setTradeModalHolding] = useState<HoldingDisplay | null>(null);
  const [journalPanelOpen, setJournalPanelOpen] = useState(false);
  const [journalRefreshKey, setJournalRefreshKey] = useState(0);
  const [whatIfOpen, setWhatIfOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const watchlistRevealRef = useScrollReveal<HTMLDivElement>();
  const holdingsSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    const syncUserState = async () => {
      if (searchParams.get("action") === "unsubscribe" && searchParams.get("uid") === user.id) {
        await supabase.from("profiles").update({ email_digest_enabled: false }).eq("id", user.id);
        if (!active) return;
        toast({ title: "Unsubscribed", description: "Email digest has been turned off." });
        setSearchParams({});
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", user.id)
        .single();

      if (active && profile && !profile.onboarding_completed) {
        setShowOnboarding(true);
      }
    };

    void syncUserState();

    return () => {
      active = false;
    };
  }, [searchParams, setSearchParams, user.id]);

  const openTradeModal = (holding?: HoldingDisplay) => {
    setTradeModalHolding(holding ?? null);
    setTradeModalOpen(true);
  };

  const holdingModalInitial = editingHolding ?? (prefillFromWatchlist ? {
    ticker: prefillFromWatchlist.ticker,
    companyName: prefillFromWatchlist.companyName,
    shares: 0,
    avgCostBasis: 0,
    currentPrice: 0,
    dayChangePct: 0,
    dayChangeDollar: 0,
    totalPLDollar: 0,
    totalPLPct: 0,
    positionValue: 0,
    weight: 0,
    convictionRating: 3,
    thesis: null,
    targetAllocationPct: null,
    notes: null,
    portfolioId: portfolio.portfolioId ?? "",
    divYield: null,
    id: "",
    purchaseDate: new Date().toISOString().slice(0, 10),
    holdingPeriodDays: 0,
    isLongTerm: false,
  } satisfies HoldingDisplay : null);

  return (
    <div className="min-h-screen bg-background flex flex-col relative pb-14">
      <GradientMeshBackground />
      <OfflineBanner />
      <PortfolioHeader data-tour="header" email={user.email} onLogout={onLogout} totalValue={portfolio.totalValue} todayPL={portfolio.todayPL} todayPLPct={portfolio.todayPLPct} refreshing={portfolio.refreshing} lastUpdated={portfolio.lastUpdated} priceError={portfolio.priceError} macroData={macroData} macroLoading={macroLoading} onWhatIf={() => setWhatIfOpen(true)} onShare={() => setShareOpen(true)} onDigestSettings={() => setDigestOpen(true)} simpleReturn={simpleReturn} twr={twr} twrAvailable={twrAvailable} />
      <TemplateAdminPanel userId={user.id} />
      <WelcomeBanner
        userId={user.id}
        portfolioId={portfolio.portfolioId}
        hasHoldings={portfolio.holdings.length > 0}
        isInitialized={!portfolio.loading}
        onExploreHoldings={() => holdingsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
        onViewWatchlist={() => watchlistRevealRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
        onCleared={portfolio.refetch}
      />
      <div className="flex-1 flex flex-col lg:flex-row gap-3 sm:gap-4 p-2 sm:p-4 max-w-[1600px] mx-auto w-full">
        <div ref={holdingsSectionRef} className="flex-1 lg:w-[62%] min-w-0 layer-surface" data-tour="holdings">
          <HoldingsTable
            holdings={portfolio.holdings}
            loading={portfolio.loading}
            onAddHolding={() => { setEditingHolding(null); setHoldingModalOpen(true); }}
            onEditHolding={(h) => { setEditingHolding(h); setHoldingModalOpen(true); }}
            onDeleteHolding={(h) => setDeletingHolding(h)}
            onAddToWatchlist={(ticker, companyName) => {
              portfolio.addToWatchlist({ ticker, company_name: companyName });
            }}
            onLogTrade={openTradeModal}
            analyticsMap={analyticsMap}
          />
        </div>
        <div className="lg:w-[38%] lg:max-w-[480px] layer-surface" data-tour="sidebar">
          <IntelligenceSidebar
            holdings={portfolio.holdings}
            watchlistTickers={portfolio.watchlist.map((w) => w.ticker)}
            briefingCard={briefing.available ? (
              <MorningBriefing
                content={briefing.briefing?.content ?? null}
                loading={briefing.loading}
                error={briefing.error}
                generatedAt={briefing.briefing?.created_at ?? null}
                generationCount={briefing.briefing?.generation_count ?? 0}
                onRegenerate={briefing.regenerate}
                onDismiss={briefing.dismiss}
                dismissed={briefing.dismissed}
              />
            ) : undefined}
          />
        </div>
      </div>

      <div ref={watchlistRevealRef} className="px-2 sm:px-4 pb-4 max-w-[1600px] mx-auto w-full" data-tour="watchlist">
        <WatchlistPanel
          items={portfolio.watchlist}
          quotes={portfolio.watchlistQuotes}
          financialsMap={portfolio.watchlistFinancials}
          loading={portfolio.loading}
          onAdd={() => setWatchlistModalOpen(true)}
          onDelete={portfolio.deleteWatchlistItem}
          onUpdateTargetPrice={(id, price) => portfolio.updateWatchlistItem(id, { target_price: price })}
          onAddToPortfolio={(ticker, companyName) => {
            setPrefillFromWatchlist({ ticker, companyName });
            setEditingHolding(null);
            setHoldingModalOpen(true);
          }}
        />
      </div>

      <div className="px-2 sm:px-4 pb-2 max-w-[1600px] mx-auto w-full">
        <button
          onClick={() => setJournalPanelOpen(true)}
          className="flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-primary-foreground text-sm font-medium shadow-lg hover:bg-primary/90 transition-all hover:scale-105"
          title="Open Trade Journal"
          aria-label="Open Trade Journal"
        >
          <BookOpen size={16} />
          Journal
        </button>
      </div>

      <HoldingModal
        open={holdingModalOpen}
        onClose={() => { setHoldingModalOpen(false); setEditingHolding(null); setPrefillFromWatchlist(null); }}
        onSubmit={async (data) => {
          if (editingHolding) {
            return portfolio.updateHolding(editingHolding.id, data);
          }
          const ok = await portfolio.addHolding(data);
          if (ok && prefillFromWatchlist) {
            await portfolio.moveWatchlistToPortfolio(data.ticker.toUpperCase(), data.company_name);
            portfolio.refetch();
            setPrefillFromWatchlist(null);
          }
          return ok;
        }}
        initial={holdingModalInitial}
      />

      <ConfirmDialog
        open={!!deletingHolding}
        title="Remove Holding"
        message={`Are you sure you want to remove ${deletingHolding?.ticker} from your portfolio? This action cannot be undone.`}
        confirmLabel="Remove"
        destructive
        onConfirm={async () => {
          if (deletingHolding) {
            await portfolio.deleteHolding(deletingHolding.id, deletingHolding.ticker);
            setDeletingHolding(null);
          }
        }}
        onCancel={() => setDeletingHolding(null)}
      />

      <WatchlistModal
        open={watchlistModalOpen}
        onClose={() => setWatchlistModalOpen(false)}
        onSubmit={portfolio.addToWatchlist}
        maxReached={portfolio.watchlist.length >= 30}
      />

      <TradeJournalModal
        open={tradeModalOpen}
        onClose={() => { setTradeModalOpen(false); setTradeModalHolding(null); }}
        prefillTicker={tradeModalHolding?.ticker}
        prefillPrice={tradeModalHolding?.currentPrice}
        holdingId={tradeModalHolding?.id}
        holdingShares={tradeModalHolding?.shares}
        holdingAvgCost={tradeModalHolding?.avgCostBasis}
        portfolioId={portfolio.portfolioId ?? undefined}
        onTradeLogged={() => {
          setJournalRefreshKey((k) => k + 1);
          portfolio.refetch();
        }}
      />

      <TradeJournalPanel
        open={journalPanelOpen}
        onClose={() => setJournalPanelOpen(false)}
        refreshKey={journalRefreshKey}
      />

      <WhatIfSimulator
        open={whatIfOpen}
        onClose={() => setWhatIfOpen(false)}
        holdings={portfolio.holdings}
        portfolioId={portfolio.portfolioId}
        onApplied={() => portfolio.refetch()}
      />

      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        holdings={portfolio.holdings}
        simpleReturn={simpleReturn}
        twr={twr}
        twrAvailable={twrAvailable}
        spyDp={macroData?.spy?.dp ?? 0}
      />

      <OnboardingFlow
        open={showOnboarding}
        portfolioId={portfolio.portfolioId ?? ""}
        onComplete={() => { setShowOnboarding(false); portfolio.refetch(); }}
      />

      <DigestSettings open={digestOpen} onClose={() => setDigestOpen(false)} />
      <CopyrightFooter />
    </div>
  );
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthenticatedUser | null | undefined>(undefined);
  const hadSessionRef = useRef(false);

  useEffect(() => {
    let active = true;

    const setAuthenticatedUser = (session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]) => {
      if (!active) return;
      if (!session) {
        setUser(null);
        navigate("/auth");
        return;
      }
      hadSessionRef.current = true;
      setUser({
        id: session.user.id,
        email: session.user.email ?? null,
      });
    };

    const syncSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setAuthenticatedUser(session);
      } catch (err) {
        console.error("[Dashboard] getSession failed", err);
        setAuthenticatedUser(null);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && hadSessionRef.current) {
        toast({ title: "Session expired", description: "Please log in again." });
      }
      setAuthenticatedUser(session);
    });

    void syncSession();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (user === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  if (user === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-sm">
        Redirecting to sign in…
      </div>
    );
  }

  return <DashboardGate user={user} onLogout={handleLogout} />;
};

function InitializingOverlay() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4 text-center">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-foreground font-medium">Setting up your portfolio…</p>
      <p className="text-sm text-muted-foreground">This only happens once</p>
    </div>
  );
}

function DashboardGate({ user, onLogout }: { user: AuthenticatedUser; onLogout: () => Promise<void> }) {
  const { isInitializing } = useInitializeUser();
  if (isInitializing) return <InitializingOverlay />;
  return <DashboardContent user={user} onLogout={onLogout} />;
}

export default Dashboard;

