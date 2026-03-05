/** Animated SVG illustrations for empty states */

export function WelcomeAnimation({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 120" className={`w-32 h-20 ${className}`} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="emptyGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="hsl(var(--primary))" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      {/* Chart line drawing up */}
      <path
        d="M20,90 Q60,85 90,60 T150,25 L170,20"
        fill="none"
        stroke="url(#emptyGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="animate-draw-line"
      />
      {/* Peak dot */}
      <circle cx="170" cy="20" r="3" fill="hsl(var(--primary))" className="animate-peak-glow" />
      <circle cx="170" cy="20" r="3" fill="none" stroke="hsl(var(--primary))" opacity="0.3">
        <animate attributeName="r" values="3;10;3" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
      </circle>
      {/* Diamond at peak */}
      <path
        d="M170,10 L178,20 L170,30 L162,20 Z"
        fill="none"
        stroke="url(#emptyGrad)"
        strokeWidth="1"
        opacity="0.4"
        className="animate-peak-glow"
      />
    </svg>
  );
}

export function WatchlistAnimation({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 60" className={`w-12 h-12 ${className}`} xmlns="http://www.w3.org/2000/svg">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const angle = (i / 8) * Math.PI * 2;
        const r = 22;
        const cx = 30 + Math.cos(angle) * r;
        const cy = 30 + Math.sin(angle) * r;
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r="2"
            fill="hsl(var(--primary))"
            opacity="0.5"
            className="animate-assemble-dots"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        );
      })}
    </svg>
  );
}

export function JournalAnimation({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 40" className={`w-14 h-10 ${className}`} xmlns="http://www.w3.org/2000/svg">
      {/* Pen */}
      <g className="animate-pen-write">
        <line x1="10" y1="30" x2="22" y2="18" stroke="hsl(var(--muted-foreground))" strokeWidth="2" strokeLinecap="round" />
        <polygon points="22,18 24,16 22,20" fill="hsl(var(--primary))" />
      </g>
      {/* Writing line */}
      <line
        x1="14"
        y1="30"
        x2="45"
        y2="30"
        stroke="hsl(var(--primary))"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.4"
        className="animate-journal-line"
      />
    </svg>
  );
}
