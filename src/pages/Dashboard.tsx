import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PortfolioHeader } from "@/components/dashboard/PortfolioHeader";
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
import { BookOpen } from "lucide-react";
import { OfflineBanner } from "@/components/dashboard/OfflineBanner";
import { OnboardingFlow } from "@/components/dashboard/OnboardingFlow";
import { GradientMeshBackground } from "@/components/GradientMeshBackground";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const Dashboard = () => {
  const [email, setEmail] = useState<string | null>(null);
  const navigate = useNavigate();
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

  // Modal states
  const [holdingModalOpen, setHoldingModalOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<HoldingDisplay | null>(null);
  const [deletingHolding, setDeletingHolding] = useState<HoldingDisplay | null>(null);
  const [watchlistModalOpen, setWatchlistModalOpen] = useState(false);
  const [prefillFromWatchlist, setPrefillFromWatchlist] = useState<{ ticker: string; companyName: string } | null>(null);

  // Trade journal states
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [tradeModalHolding, setTradeModalHolding] = useState<HoldingDisplay | null>(null);
  const [journalPanelOpen, setJournalPanelOpen] = useState(false);
  const [journalRefreshKey, setJournalRefreshKey] = useState(0);
  const [whatIfOpen, setWhatIfOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const watchlistRevealRef = useScrollReveal<HTMLDivElement>();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        toast({ title: "Session expired", description: "Please log in again." });
        navigate("/auth");
        return;
      }
      setEmail(session.user.email ?? null);
    });
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { navigate("/auth"); return; }
      setEmail(session.user.email ?? null);

      // Handle unsubscribe from email digest
      if (searchParams.get("action") === "unsubscribe" && searchParams.get("uid") === session.user.id) {
        await supabase.from("profiles").update({ email_digest_enabled: false }).eq("id", session.user.id);
        toast({ title: "Unsubscribed", description: "Email digest has been turned off." });
        setSearchParams({});
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", session.user.id)
        .single();
      if (profile && !profile.onboarding_completed) {
        setShowOnboarding(true);
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate, searchParams, setSearchParams]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const openTradeModal = (holding?: HoldingDisplay) => {
    setTradeModalHolding(holding ?? null);
    setTradeModalOpen(true);
  };

  // Build initial for HoldingModal from prefill or editing
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
  } satisfies HoldingDisplay : null);

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      <GradientMeshBackground />
      <OfflineBanner />
      <PortfolioHeader data-tour="header" email={email} onLogout={handleLogout} totalValue={portfolio.totalValue} todayPL={portfolio.todayPL} todayPLPct={portfolio.todayPLPct} refreshing={portfolio.refreshing} lastUpdated={portfolio.lastUpdated} priceError={portfolio.priceError} macroData={macroData} macroLoading={macroLoading} onWhatIf={() => setWhatIfOpen(true)} onShare={() => setShareOpen(true)} onDigestSettings={() => setDigestOpen(true)} simpleReturn={simpleReturn} twr={twr} twrAvailable={twrAvailable} />

      <div className="flex-1 flex flex-col lg:flex-row gap-3 sm:gap-4 p-2 sm:p-4 max-w-[1600px] mx-auto w-full">
        <div className="flex-1 lg:w-[62%] min-w-0 layer-surface" data-tour="holdings">
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

      {/* Floating Journal Button */}
      <button
        onClick={() => setJournalPanelOpen(true)}
        className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-40 flex items-center gap-2 rounded-full bg-primary px-3 py-2 sm:px-4 sm:py-2.5 text-primary-foreground text-xs sm:text-sm font-medium shadow-lg hover:bg-primary/90 transition-all hover:scale-105"
        title="Open Trade Journal"
        aria-label="Open Trade Journal"
      >
        <BookOpen size={14} className="sm:w-4 sm:h-4" />
        <span className="hidden sm:inline">Journal</span>
      </button>

      {/* Add/Edit Holding Modal */}
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

      {/* Delete Confirmation */}
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

      {/* Watchlist Modal */}
      <WatchlistModal
        open={watchlistModalOpen}
        onClose={() => setWatchlistModalOpen(false)}
        onSubmit={portfolio.addToWatchlist}
        maxReached={portfolio.watchlist.length >= 30}
      />

      {/* Trade Journal Modal */}
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

      {/* Trade Journal Panel */}
      <TradeJournalPanel
        open={journalPanelOpen}
        onClose={() => setJournalPanelOpen(false)}
        refreshKey={journalRefreshKey}
      />

      {/* What If Simulator */}
      <WhatIfSimulator
        open={whatIfOpen}
        onClose={() => setWhatIfOpen(false)}
        holdings={portfolio.holdings}
        portfolioId={portfolio.portfolioId}
        onApplied={() => portfolio.refetch()}
      />

      {/* Share Modal */}
      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        holdings={portfolio.holdings}
        simpleReturn={simpleReturn}
        twr={twr}
        twrAvailable={twrAvailable}
        spyDp={macroData?.spy?.dp ?? 0}
      />

      {/* Onboarding */}
      <OnboardingFlow
        open={showOnboarding}
        portfolioId={portfolio.portfolioId ?? ""}
        onComplete={() => { setShowOnboarding(false); portfolio.refetch(); }}
      />

      {/* Digest Settings */}
      <DigestSettings open={digestOpen} onClose={() => setDigestOpen(false)} />
      <CopyrightFooter />
    </div>
  );
};

export default Dashboard;
