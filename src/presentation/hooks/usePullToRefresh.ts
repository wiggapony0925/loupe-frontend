/**
 * Pull-to-refresh that spins ONLY when the user pulls.
 *
 * The bug this exists to prevent: binding `RefreshControl`'s `refreshing`
 * to a query's `isFetching` / `isRefetching`. Those are true for ANY fetch,
 * including the background revalidation that fires whenever a screen regains
 * focus — so simply navigating to a tab yanked the spinner down and pushed
 * the whole page with it. The screen appeared to reload every time you
 * looked at it, and on Android the header could end up below the viewport.
 *
 * Background refetches are supposed to be invisible: React Query keeps the
 * previous data on screen and swaps it when the new data lands. The spinner
 * is an acknowledgement of a GESTURE, so it belongs to local state that only
 * the gesture sets.
 *
 *   const { refreshing, onRefresh } = usePullToRefresh(() => query.refetch());
 *   <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
 */
import { useCallback, useRef, useState } from "react";

export function usePullToRefresh(refresh: () => Promise<unknown> | unknown) {
  const [refreshing, setRefreshing] = useState(false);
  // A pull that resolves instantly reads as "nothing happened" — the spinner
  // appears and vanishes in the same frame. Hold it briefly so the gesture
  // is acknowledged.
  const startedAt = useRef(0);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    startedAt.current = Date.now();
    try {
      await refresh();
    } finally {
      const elapsed = Date.now() - startedAt.current;
      const MIN_VISIBLE_MS = 350;
      if (elapsed < MIN_VISIBLE_MS) {
        await new Promise((r) => setTimeout(r, MIN_VISIBLE_MS - elapsed));
      }
      setRefreshing(false);
    }
  }, [refresh]);

  return { refreshing, onRefresh };
}
