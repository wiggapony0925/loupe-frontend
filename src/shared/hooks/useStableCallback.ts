/**
 * useStableCallback — returns a callback with a stable identity that
 * always invokes the latest version of `fn`. Use it when you need to
 * pass a callback to a memoized child (or store it in a long-lived
 * data structure) without busting memoization every render, but the
 * callback closes over values that change every render.
 *
 * Equivalent in spirit to the unreleased React `useEffectEvent`.
 */
import { useCallback, useRef } from "react";

export function useStableCallback<T extends (...args: never[]) => unknown>(
  fn: T,
): T {
  const ref = useRef<T>(fn);
  ref.current = fn;
  // The wrapper itself never changes identity; it always forwards to
  // the latest `fn` stored in the ref.
  return useCallback(((...args: never[]) => ref.current(...args)) as T, []);
}
