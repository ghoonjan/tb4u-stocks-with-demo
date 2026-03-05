interface LogoMarkProps {
  size?: number;
  className?: string;
}

export function LogoMark({ size = 28, className = "" }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 120 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size * 2}
      height={size}
      className={className}
    >
      <defs>
        <linearGradient id="infGrad" x1="0" y1="30" x2="120" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="50%" stopColor="#c4b5fd" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
        <filter id="infGlow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Bright outer glow */}
      <path
        d="M30 30 C30 12, 50 12, 60 30 C70 48, 90 48, 90 30 C90 12, 70 12, 60 30 C50 48, 30 48, 30 30 Z"
        stroke="#c4b5fd"
        strokeWidth="6"
        fill="none"
        opacity="0.3"
        filter="url(#infGlow)"
      />
      {/* Main infinity path */}
      <path
        d="M30 30 C30 12, 50 12, 60 30 C70 48, 90 48, 90 30 C90 12, 70 12, 60 30 C50 48, 30 48, 30 30 Z"
        stroke="url(#infGrad)"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
        filter="url(#infGlow)"
      />
      {/* Animated dot */}
      <circle r="4" fill="#e0e7ff">
        <animateMotion
          dur="3s"
          repeatCount="indefinite"
          path="M30 30 C30 12, 50 12, 60 30 C70 48, 90 48, 90 30 C90 12, 70 12, 60 30 C50 48, 30 48, 30 30 Z"
        />
      </circle>
      {/* Pulsing glow on dot */}
      <circle r="4" fill="none" stroke="#e0e7ff" opacity="0.5">
        <animateMotion
          dur="3s"
          repeatCount="indefinite"
          path="M30 30 C30 12, 50 12, 60 30 C70 48, 90 48, 90 30 C90 12, 70 12, 60 30 C50 48, 30 48, 30 30 Z"
        />
        <animate attributeName="r" values="4;14;4" dur="1.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.6;0;0.6" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}
