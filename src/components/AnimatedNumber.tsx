import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  delay?: number;
  format?: (n: number) => string;
  className?: string;
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function AnimatedNumber({
  value,
  duration = 1200,
  delay = 0,
  format = (n) => n.toFixed(2),
  className = "",
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState("0");
  const prevValue = useRef(0);
  const rafRef = useRef<number>(0);
  const hasBooted = useRef(false);

  useEffect(() => {
    const startValue = hasBooted.current ? prevValue.current : 0;
    const actualDuration = hasBooted.current ? 400 : duration;
    const actualDelay = hasBooted.current ? 0 : delay;

    const timeout = setTimeout(() => {
      const startTime = performance.now();

      const tick = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / actualDuration, 1);
        const easedProgress = easeOut(progress);
        const current = startValue + (value - startValue) * easedProgress;
        setDisplay(format(current));

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          prevValue.current = value;
          hasBooted.current = true;
        }
      };

      rafRef.current = requestAnimationFrame(tick);
    }, actualDelay);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration, delay, format]);

  return <span className={className}>{display}</span>;
}
