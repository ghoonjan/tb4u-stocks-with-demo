import { TrendingUp } from "lucide-react";

interface LogoMarkProps {
  size?: number;
  className?: string;
}

export function LogoMark({ size = 28, className = "" }: LogoMarkProps) {
  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Soft glow behind icon */}
      <div
        className="absolute inset-0 rounded-full opacity-30 blur-lg"
        style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)" }}
      />
      <TrendingUp
        size={size * 0.7}
        className="relative text-primary"
        strokeWidth={2.5}
      />
    </div>
  );
}
