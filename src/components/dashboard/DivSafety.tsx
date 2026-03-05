import { Shield, AlertTriangle } from "lucide-react";

export interface DivSafetyResult {
  score: number;       // 1-10
  rating: "Strong" | "Moderate" | "Weak";
  payoutScore: number;
  yieldScore: number;
  growthScore: number;
  payoutLabel: string;
  yieldLabel: string;
  growthLabel: string;
  summary: string;
}

export function calcDivSafety(
  divYield: number,
  payoutRatio: number | null,
  divGrowth5Y: number | null,
): DivSafetyResult | null {
  if (divYield <= 0) return null;

  // Payout ratio (40%)
  let payoutScore: number;
  let payoutLabel: string;
  const pr = payoutRatio ?? 50; // default to moderate if unknown
  if (pr < 30) { payoutScore = 10; payoutLabel = "Very safe"; }
  else if (pr <= 50) { payoutScore = 8; payoutLabel = "Healthy"; }
  else if (pr <= 70) { payoutScore = 6; payoutLabel = "Moderate"; }
  else if (pr <= 90) { payoutScore = 4; payoutLabel = "Stretched"; }
  else if (pr <= 100) { payoutScore = 2; payoutLabel = "Dangerous"; }
  else { payoutScore = 0; payoutLabel = "Unsustainable"; }

  // Yield reasonableness (30%)
  let yieldScore: number;
  let yieldLabel: string;
  if (divYield >= 3 && divYield <= 5) { yieldScore = 10; yieldLabel = "Sweet spot"; }
  else if (divYield >= 1 && divYield < 3) { yieldScore = 8; yieldLabel = "Sustainable"; }
  else if (divYield > 5 && divYield <= 7) { yieldScore = 6; yieldLabel = "Elevated"; }
  else if (divYield > 7) { yieldScore = 3; yieldLabel = "Yield trap risk"; }
  else { yieldScore = 5; yieldLabel = "Low"; }

  // Growth (30%)
  let growthScore: number;
  let growthLabel: string;
  if (divGrowth5Y == null) { growthScore = 5; growthLabel = "No data"; }
  else if (divGrowth5Y > 0) { growthScore = 10; growthLabel = `+${divGrowth5Y.toFixed(1)}% annually`; }
  else if (divGrowth5Y === 0) { growthScore = 5; growthLabel = "Flat"; }
  else { growthScore = 2; growthLabel = "Declining"; }

  const score = payoutScore * 0.4 + yieldScore * 0.3 + growthScore * 0.3;
  const rating: DivSafetyResult["rating"] = score >= 8 ? "Strong" : score >= 5 ? "Moderate" : "Weak";

  let summary: string;
  if (rating === "Strong") {
    summary = "This dividend appears well-covered by earnings with room for continued growth.";
  } else if (rating === "Moderate") {
    summary = "This dividend is adequate but may face pressure if earnings decline.";
  } else {
    summary = "This dividend may be at risk — monitor payout ratio and earnings closely.";
  }

  return { score, rating, payoutScore, yieldScore, growthScore, payoutLabel, yieldLabel, growthLabel, summary };
}

export function DivSafetyBadge({ rating }: { rating: "Strong" | "Moderate" | "Weak" | null }) {
  if (!rating) return <span className="text-[10px] text-muted-foreground/40">—</span>;

  const config = {
    Strong: { icon: Shield, bg: "bg-gain/15", text: "text-gain", border: "border-gain/30" },
    Moderate: { icon: AlertTriangle, bg: "bg-warning/15", text: "text-warning", border: "border-warning/30" },
    Weak: { icon: AlertTriangle, bg: "bg-loss/15", text: "text-loss", border: "border-loss/30" },
  }[rating];

  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-semibold border ${config.bg} ${config.text} ${config.border}`}>
      <Icon size={9} /> {rating}
    </span>
  );
}
