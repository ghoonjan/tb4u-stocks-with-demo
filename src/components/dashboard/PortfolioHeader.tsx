import { useState } from "react";
import { TrendingUp, TrendingDown, LogOut, FlaskConical, Info, Share2, Mail, Menu, X, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { getMarketStatus, getNextFomc, type MacroData } from "@/hooks/useMacroData";
import type { StockQuote } from "@/services/marketData";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FreshnessIndicator } from "@/components/dashboard/FreshnessIndicator";
import { LogoMark } from "@/components/LogoMark";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { MarketHeartbeat } from "@/components/dashboard/MarketHeartbeat";
import { plArrow } from "@/constants";

interface PortfolioHeaderProps {
  email: string | null;
  onLogout: () => void;
  totalValue?: number;
  todayPL?: number;
  todayPLPct?: number;
  refreshing?: boolean;
  lastUpdated?: Date | null;
  priceError?: boolean;
  macroData?: MacroData;
  macroLoading?: boolean;
  onWhatIf?: () => void;
  onShare?: () => void;
  onDigestSettings?: () => void;
  simpleReturn?: number | null;
  twr?: number | null;
  twrAvailable?: boolean;
}

const fmtPrice = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtChg = (n: number) => (n >= 0 ? "+" : "") + n.toFixed(2) + "%";

function MacroItem({ label, quote, decimals = 2 }: { label: string; quote: StockQuote | null; decimals?: number }) {
  if (!quote) {
    return (
      <div className="flex items-center gap-2 px-3 sm:px-4 shrink-0">
        <span className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</span>
        <span className="font-mono text-xs text-muted-foreground">—</span>
      </div>
    );
  }
  const color = quote.dp >= 0 ? "text-gain" : "text-loss";
  return (
    <div className="flex items-center gap-2 px-3 sm:px-4 shrink-0">
      <span className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className="font-mono text-xs text-foreground">
        <AnimatedNumber
          value={quote.c}
          delay={400}
          duration={800}
          format={(n) => n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
        />
      </span>
      <span className={`font-mono text-[11px] ${color}`}>
        {plArrow(quote.dp)} {fmtChg(quote.dp)}
      </span>
    </div>
  );
}

export function PortfolioHeader({
  email, onLogout, totalValue = 0, todayPL = 0, todayPLPct = 0,
  refreshing, lastUpdated, priceError, macroData, macroLoading, onWhatIf, onShare,
  simpleReturn, twr, twrAvailable, onDigestSettings,
}: PortfolioHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
  const plSign = todayPL >= 0 ? "+" : "";
  const plColorClass = todayPL >= 0 ? "text-gain" : "text-loss";
  const PLIcon = todayPL >= 0 ? TrendingUp : TrendingDown;
  const market = getMarketStatus();
  const valueGlowClass = todayPL >= 0 ? "value-glow-gain" : "value-glow-loss";

  const spyDp = macroData?.spy?.dp ?? 0;
  const vsSP = todayPLPct - spyDp;
  const vsSign = vsSP >= 0 ? "+" : "";
  const vsColor = vsSP >= 0 ? "text-gain" : "text-loss";
  const vsLabel = vsSP >= 0 ? "beating" : "trailing";

  const fomc = getNextFomc();

  return (
    <TooltipProvider delayDuration={200}>
      <div className="border-b border-border relative" data-tour="header">
        <MarketHeartbeat />

        {/* Mobile header */}
        <div className="flex md:hidden items-center justify-between px-3 py-3 relative z-[1]">
          <div className="flex items-center gap-2">
            <LogoMark size={24} />
            <span className="text-base font-extrabold tracking-[-0.02em] uppercase" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              TB4U
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 rounded-full border ${market.border} ${market.bg} px-2 py-0.5`}>
              {market.pulse && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${market.bg} opacity-75`} />
                  <span className={`relative inline-flex h-1.5 w-1.5 rounded-full bg-current ${market.color}`} />
                </span>
              )}
              <span className={`text-[10px] font-medium ${market.color}`}>{market.label}</span>
            </div>
            <button onClick={toggleTheme} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground" aria-label="Toggle theme">
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground">
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile portfolio value row */}
        <div className="flex md:hidden items-center justify-between px-3 pb-2 relative z-[1]">
          <div>
            <p className={`font-mono text-xl font-bold text-foreground tracking-tight ${valueGlowClass}`}>
              $<AnimatedNumber value={totalValue} duration={1200} delay={0} format={fmtPrice} />
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <PLIcon size={12} className={plColorClass} />
            <span className={`font-mono text-xs font-semibold ${plColorClass}`}>
              {plArrow(todayPL)} {plSign}$<AnimatedNumber value={Math.abs(todayPL)} duration={1000} delay={200} format={fmtPrice} />
            </span>
            <span className={`font-mono text-[11px] ${plColorClass}`}>
              ({plSign}<AnimatedNumber value={Math.abs(todayPLPct)} duration={1000} delay={200} format={(n) => n.toFixed(2)} />%)
            </span>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-card/80 backdrop-blur-sm px-3 py-3 space-y-2 relative z-[2] animate-in fade-in slide-in-from-top-2 duration-200">
            {simpleReturn != null && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Simple Return</span>
                <span className={`font-mono font-semibold ${simpleReturn >= 0 ? "text-gain" : "text-loss"}`}>
                  {plArrow(simpleReturn)} {simpleReturn >= 0 ? "+" : ""}{simpleReturn.toFixed(2)}%
                </span>
              </div>
            )}
            {twrAvailable && twr != null && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">True Performance</span>
                <span className={`font-mono font-semibold ${twr >= 0 ? "text-gain" : "text-loss"}`}>
                  {plArrow(twr)} {twr >= 0 ? "+" : ""}{twr.toFixed(2)}%
                </span>
              </div>
            )}
            {macroData?.spy && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">vs S&P 500</span>
                <span className={`font-mono font-semibold ${vsColor}`}>{vsSign}{Math.abs(vsSP).toFixed(2)}% ({vsLabel})</span>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={() => { onShare?.(); setMobileMenuOpen(false); }} className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <Share2 size={13} /> Share
              </button>
              <button onClick={() => { onWhatIf?.(); setMobileMenuOpen(false); }} className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <FlaskConical size={13} /> What If
              </button>
              <button onClick={() => { onDigestSettings?.(); setMobileMenuOpen(false); }} className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <Mail size={13} /> Digest
              </button>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-border/50">
              <span className="font-mono text-[11px] text-muted-foreground truncate max-w-[200px]">{email}</span>
              <button onClick={onLogout} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground">
                <LogOut size={13} /> Log out
              </button>
            </div>
          </div>
        )}

        {/* Desktop header (unchanged) */}
        <div className="hidden md:flex h-[72px] items-center justify-between px-6 relative z-[1]">
          {/* Left — Logo lockup */}
          <div className="flex items-center gap-3">
            <LogoMark size={28} />
            <span
              className="text-xl font-extrabold tracking-[-0.02em] uppercase"
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                textShadow: "0 0 40px rgba(99,102,241,0.15)",
              }}
            >
              TB4U
            </span>
            <span className="h-4 w-px bg-border" aria-hidden="true" />
            <span className="text-xs text-muted-foreground">My Portfolio</span>
          </div>

          {/* Center */}
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className={`font-mono text-2xl font-bold text-foreground tracking-tight ${valueGlowClass}`}>
                $<AnimatedNumber value={totalValue} duration={1200} delay={0} format={fmtPrice} />
              </p>
            </div>
            <div className="flex flex-col items-start">
              <div className="flex items-center gap-1">
                <PLIcon size={13} className={plColorClass} />
                <span className={`font-mono text-sm font-semibold ${plColorClass}`}>
                  {plArrow(todayPL)} {plSign}$<AnimatedNumber value={Math.abs(todayPL)} duration={1000} delay={200} format={fmtPrice} />
                </span>
                <span className={`font-mono text-xs ${plColorClass}`}>
                  ({plSign}<AnimatedNumber value={Math.abs(todayPLPct)} duration={1000} delay={200} format={(n) => n.toFixed(2)} />%)
                </span>
              </div>
              {macroData?.spy && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={`text-[11px] cursor-default ${vsColor}`}>
                      vs S&P: {vsSign}{Math.abs(vsSP).toFixed(2)}%
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs bg-card border-border">
                    Your portfolio is {vsLabel} the S&P 500 by {Math.abs(vsSP).toFixed(2)}% today
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            {simpleReturn != null && (
              <div className="flex flex-col items-start gap-0.5 border-l border-border pl-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">Simple Return</span>
                  <span className={`font-mono text-xs font-semibold ${simpleReturn >= 0 ? "text-gain" : "text-loss"}`}>
                    {plArrow(simpleReturn)} {simpleReturn >= 0 ? "+" : ""}{simpleReturn.toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">True Performance</span>
                  {twrAvailable && twr != null ? (
                    <>
                      <span className={`font-mono text-xs font-semibold ${twr >= 0 ? "text-gain" : "text-loss"}`}>
                        {plArrow(twr)} {twr >= 0 ? "+" : ""}{twr.toFixed(2)}%
                      </span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info size={10} className="text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-[10px] bg-card border-border max-w-[220px]">
                          Time-Weighted Return removes the distortion of cash deposits and withdrawals, showing your actual investing skill.
                        </TooltipContent>
                      </Tooltip>
                    </>
                  ) : (
                    <span className="text-[10px] text-muted-foreground italic">Log trades to unlock TWR</span>
                  )}
                </div>
              </div>
            )}
            {refreshing && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <span className="text-[10px]">Refreshing…</span>
              </div>
            )}
            {priceError && <span className="text-[10px] text-warning">Data may be delayed</span>}
          </div>

          {/* Right */}
          <div className="flex items-center gap-4">
            <button onClick={onShare} className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground">
              <Share2 size={13} /> Share
            </button>
            <button onClick={onWhatIf} className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground">
              <FlaskConical size={13} /> What If
            </button>
            <button onClick={onDigestSettings} className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground">
              <Mail size={13} /> Digest
            </button>
            <div className={`flex items-center gap-2 rounded-full border ${market.border} ${market.bg} px-3 py-1`}>
              {market.pulse && (
                <span className="relative flex h-2 w-2">
                  <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${market.bg} opacity-75`} />
                  <span className={`relative inline-flex h-2 w-2 rounded-full bg-current ${market.color}`} />
                </span>
              )}
              <span className={`text-[11px] font-medium ${market.color}`}>{market.label}</span>
            </div>
            <FreshnessIndicator lastUpdated={lastUpdated ?? null} onRefresh={() => {}} refreshing={refreshing} />
            <span className="h-6 w-px bg-border" />
            <span className="font-mono text-[11px] text-muted-foreground hidden lg:inline">{email}</span>
            <button onClick={toggleTheme} className="flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label="Toggle theme">
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button onClick={onLogout} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
              <LogOut size={13} />
            </button>
          </div>
        </div>

        {/* Macro strip */}
        <div className="flex h-9 items-center border-t border-border bg-card/50 overflow-x-auto relative z-[1] scrollbar-none" data-tour="macro" role="region" aria-label="Market indicators">
          <MacroItem label="S&P 500" quote={macroData?.spy ?? null} />
          <span className="h-3 w-px bg-border shrink-0" />
          <div className="flex items-center gap-2 px-3 sm:px-4 shrink-0">
            <span className="text-[11px] text-muted-foreground uppercase tracking-wide">10Y</span>
            <span className="font-mono text-xs text-muted-foreground">—</span>
          </div>
          <span className="h-3 w-px bg-border shrink-0" />
          <div className="flex items-center gap-2 px-3 sm:px-4 shrink-0">
            <span className="text-[11px] text-muted-foreground uppercase tracking-wide">VIX</span>
            <span className="font-mono text-xs text-muted-foreground">—</span>
          </div>
          <span className="h-3 w-px bg-border shrink-0" />
          <MacroItem label="DXY" quote={macroData?.uup ?? null} />
          <span className="h-3 w-px bg-border shrink-0" />
          <div className="flex items-center gap-2 px-3 sm:px-4 shrink-0">
            <span className="text-[11px] text-muted-foreground uppercase tracking-wide">FOMC</span>
            <span className="font-mono text-xs text-foreground">{fomc.label}</span>
            <span className="font-mono text-[11px] text-warning">{fomc.daysAway}d</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
