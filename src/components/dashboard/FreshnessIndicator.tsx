import { useMemo } from "react";
import { RefreshCw } from "lucide-react";

interface FreshnessIndicatorProps {
  lastUpdated: Date | null;
  onRefresh: () => void;
  refreshing?: boolean;
}

export function FreshnessIndicator({ lastUpdated, onRefresh, refreshing }: FreshnessIndicatorProps) {
  const { color, label } = useMemo(() => {
    if (!lastUpdated) return { color: "bg-muted-foreground", label: "No data" };
    const age = (Date.now() - lastUpdated.getTime()) / 1000;
    if (age < 60) return { color: "bg-gain", label: "Live" };
    if (age < 300) return { color: "bg-warning", label: `${Math.floor(age / 60)}m ago` };
    return { color: "bg-muted-foreground", label: `${Math.floor(age / 60)}m ago` };
  }, [lastUpdated]);

  const timeStr = lastUpdated
    ? lastUpdated.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/New_York" }) + " ET"
    : "--:--:-- ET";

  return (
    <button
      onClick={onRefresh}
      disabled={refreshing}
      className="group flex items-center gap-2 text-right hover:opacity-80 transition-opacity disabled:opacity-50"
      title="Click to refresh"
    >
      <div className="flex flex-col items-end">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            {color === "bg-gain" && (
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${color} opacity-75`} />
            )}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${color}`} />
          </span>
          <span className="text-[10px] text-muted-foreground">{label}</span>
        </div>
        <p className="font-mono text-[11px] text-muted-foreground">{timeStr}</p>
      </div>
      <RefreshCw size={11} className={`text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ${refreshing ? "animate-spin opacity-100" : ""}`} />
    </button>
  );
}
