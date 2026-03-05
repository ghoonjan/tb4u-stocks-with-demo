import { getMarketStatus } from "@/hooks/useMacroData";

export function MarketHeartbeat() {
  const market = getMarketStatus();
  const isOpen = market.label === "Market Open";
  const blipHeight = isOpen ? 10 : 6;
  const color = isOpen ? "rgba(52,211,153,0.15)" : "rgba(99,102,241,0.08)";

  // Build a repeating blip pattern
  const patternWidth = 200;
  const blipPath = `M0,10 L${patternWidth * 0.4},10 L${patternWidth * 0.45},${10 - blipHeight} L${patternWidth * 0.5},10 L${patternWidth},10`;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
      <svg
        className="absolute inset-0 w-full h-full animate-heartbeat-scroll"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern id="heartbeat" x="0" y="0" width={patternWidth} height="20" patternUnits="userSpaceOnUse">
            <path d={blipPath} fill="none" stroke={color} strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="200%" height="100%" fill="url(#heartbeat)" y="50%" transform="translate(0, -10)" />
      </svg>
    </div>
  );
}
