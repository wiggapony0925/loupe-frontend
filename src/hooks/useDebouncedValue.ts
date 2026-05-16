/**
 * useDebouncedValue — returns `value` after it has stayed unchanged
 * for `delay` ms. Cancels the timer on every change and on unmount so
 * fast typing never produces a stale flush.
 *
 * Typical use: debounce a search-input string before firing a query.
 *
 *   const [q, setQ] = useState("");
 *   const debouncedQ = useDebouncedValue(q, 300);
 *   useCardSearch({ q: debouncedQ });
 */
import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    if (delay <= 0) {
      setDebounced(value);
      return;
    }
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}
