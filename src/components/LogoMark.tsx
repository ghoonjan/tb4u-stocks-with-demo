interface LogoMarkProps {
  size?: number;
  className?: string;
}

export function LogoMark({ size = 28, className = "" }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      className={className}
    >
      <defs>
        <linearGradient id="infGrad" x1="0" y1="60" x2="120" y2="60" gradientUnits="userSpaceOnUse">
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
        d="M30 60 C30 42, 50 42, 60 60 C70 78, 90 78, 90 60 C90 42, 70 42, 60 60 C50 78, 30 78, 30 60 Z"
        stroke="#c4b5fd"
        strokeWidth="6"
        fill="none"
        opacity="0.3"
        filter="url(#infGlow)"
      />
      {/* Main infinity path */}
      <path
        d="M30 60 C30 42, 50 42, 60 60 C70 78, 90 78, 90 60 C90 42, 70 42, 60 60 C50 78, 30 78, 30 60 Z"
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
          path="M30 60 C30 42, 50 42, 60 60 C70 78, 90 78, 90 60 C90 42, 70 42, 60 60 C50 78, 30 78, 30 60 Z"
        />
      </circle>
      {/* Pulsing glow on dot */}
      <circle r="4" fill="none" stroke="#e0e7ff" opacity="0.5">
        <animateMotion
          dur="3s"
          repeatCount="indefinite"
          path="M30 60 C30 42, 50 42, 60 60 C70 78, 90 78, 90 60 C90 42, 70 42, 60 60 C50 78, 30 78, 30 60 Z"
        />
        <animate attributeName="r" values="4;14;4" dur="1.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.6;0;0.6" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}
