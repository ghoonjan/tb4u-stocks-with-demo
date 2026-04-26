interface TermBadgeProps {
  isLongTerm: boolean;
  className?: string;
}

/**
 * Long-term (>365 days held) → green badge.
 * Short-term → orange badge.
 * Tax-relevant categorization for capital gains.
 */
export function TermBadge({ isLongTerm, className = "" }: TermBadgeProps) {
  const label = isLongTerm ? "Long-term" : "Short-term";
  const styles = isLongTerm
    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    : "bg-orange-500/15 text-orange-400 border-orange-500/30";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-medium leading-none ${styles} ${className}`}
      aria-label={label}
    >
      {label}
    </span>
  );
}
