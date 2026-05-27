/**
 * useAppStateRefresh — bridges iOS/Android `AppState` to TanStack Query.
 *
 * React Native does not fire the DOM `focus` event that TanStack Query's
 * `focusManager` listens for by default, so without this hook every
 * "open the app after backgrounding it" cold-open would sit on stale
 * cached data until the user manually pulled-to-refresh.
 *
 * We also proactively rotate the access token on foreground so the next
 * authenticated request lands with a fresh bearer instead of taking the
 * 401 → /v1/auth/refresh → retry round trip — which, on a Cloud Run
 * cold-started container, observably added 10+ seconds to the first
 * paint after backgrounding (see cloudrun-cold-start incident).
 *
 * Mount once, at the root of the provider tree, beneath both
 * `QueryClientProvider` and `AuthProvider`.
 */
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { focusManager, onlineManager, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/presentation/providers/AuthProvider";

export function useAppStateRefresh() {
  const qc = useQueryClient();
  const { isAuthenticated, refreshNow } = useAuth();
  // Track the last state we saw so we only react on real
  // background→active transitions (AppState fires on every state nudge,
  // including inactive→active on iOS control-center pulls).
  const lastState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    // Always assume we're online in the app — React Query defaults to
    // navigator.onLine which is `true` in RN but flips on Hermes if
    // anyone polyfills it. Pin it explicitly.
    onlineManager.setOnline(true);

    const sub = AppState.addEventListener("change", (next) => {
      const wasBackground =
        lastState.current === "background" || lastState.current === "inactive";
      lastState.current = next;
      if (next !== "active" || !wasBackground) return;

      // Tell React Query we're focused. With `refetchOnWindowFocus: true`
      // on the default options, this triggers an immediate refetch of
      // every mounted query whose `staleTime` has elapsed.
      focusManager.setFocused(true);

      // Pre-rotate the bearer so the next request doesn't 401. Fire and
      // forget — the refresh handler also runs on 401 as a safety net.
      if (isAuthenticated) {
        refreshNow().catch(() => {});
      }

      // Drop focus state shortly after so the next foreground transition
      // re-fires `setFocused(true)` (TanStack treats this as edge-triggered).
      setTimeout(() => focusManager.setFocused(undefined), 0);
    });

    return () => sub.remove();
  }, [qc, isAuthenticated, refreshNow]);
}
