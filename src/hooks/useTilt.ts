import { useRef, useCallback } from "react";

export function useTilt(maxRotation = 3) {
  const ref = useRef<HTMLDivElement>(null);
  const rafId = useRef<number>(0);

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (!el) return;

      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        const rotateY = x * maxRotation;
        const rotateX = -y * maxRotation;
        el.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;

        // Light tracking gradient
        const bgX = ((e.clientX - rect.left) / rect.width) * 100;
        const bgY = ((e.clientY - rect.top) / rect.height) * 100;
        el.style.setProperty(
          "--tilt-light",
          `radial-gradient(circle at ${bgX}% ${bgY}%, rgba(255,255,255,0.04), transparent 60%)`
        );
      });
    },
    [maxRotation]
  );

  const onMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = "transform 600ms cubic-bezier(0.16, 1, 0.3, 1)";
    el.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg)";
    el.style.setProperty("--tilt-light", "none");
    setTimeout(() => {
      if (el) el.style.transition = "";
    }, 600);
  }, []);

  const onMouseEnter = useCallback(() => {
    const el = ref.current;
    if (el) el.style.transition = "";
  }, []);

  return { ref, onMouseMove, onMouseLeave, onMouseEnter };
}
