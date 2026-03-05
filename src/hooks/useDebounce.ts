import { useRef, useCallback } from "react";

/**
 * Returns a debounced version of the callback.
 * The returned function delays invoking `fn` until after `delay` ms
 * have elapsed since the last invocation.
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number,
): T {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  return useCallback(
    ((...args: unknown[]) => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => fn(...args), delay);
    }) as T,
    [fn, delay],
  );
}
