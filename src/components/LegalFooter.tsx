// ============================================================
// EDIT THIS CONFIG TO UPDATE LEGAL FOOTER TEXT
// ============================================================
const FOOTER_CONFIG = {
  disclaimer: "For educational and informational purposes only. Not financial advice.",
  dataAttribution: "Market data provided by Finnhub. Prices can be delayed up to 15 minutes.",
  showDisclaimer: true,
  showAttribution: true,
};
// ============================================================

const LegalFooter = () => {
  const { disclaimer, dataAttribution, showDisclaimer, showAttribution } = FOOTER_CONFIG;
  if (!showDisclaimer && !showAttribution) return null;

  return (
    <div className="w-full px-4 py-4 text-center text-[11px] text-muted-foreground/70 space-y-1 max-w-[1600px] mx-auto">
      {showDisclaimer && <p>{disclaimer}</p>}
      {showAttribution && <p className="opacity-80">{dataAttribution}</p>}
    </div>
  );
};

export default LegalFooter;
