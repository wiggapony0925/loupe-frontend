/**
 * useOtaFreshness — makes every OTA update land at the next natural
 * boundary instead of "the cold start after next".
 *
 * Stock expo-updates behavior (checkAutomatically: ON_LOAD +
 * fallbackToCacheTimeout: 0) launches the CACHED bundle instantly,
 * downloads the new one in the background, and applies it only on the
 * NEXT cold start — so a freshly published update is invisible until the
 * user force-quits twice. This hook closes that gap:
 *
 *  1. Launch: if the ON_LOAD download finishes within the first seconds
 *     of a session, swap to it immediately — the user has barely arrived.
 *  2. Foreground: a pending (already downloaded) update applies the moment
 *     the app comes back from background — it reads as a fresh open, and
 *     nothing mid-session is ever yanked away.
 *  3. Foreground with nothing pending: check + download in the background
 *     (throttled), so the update is staged for the next boundary.
 *
 * Mount once, next to useAppStateRefresh. No-ops in dev clients, where
 * the Updates API is unavailable.
 */
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import * as Updates from "expo-updates";

/** Downloads finishing this soon after launch swap in place. */
const EARLY_LAUNCH_MS = 12_000;
/** Don't hit the update server more often than this on foregrounds. */
const MIN_CHECK_INTERVAL_MS = 60_000;

export function useOtaFreshness() {
  const { isUpdatePending } = Updates.useUpdates();
  // Mirror into a ref so the AppState listener (mounted once) always sees
  // the current value without re-subscribing.
  const pendingRef = useRef(isUpdatePending);
  pendingRef.current = isUpdatePending;
  const sessionStart = useRef(Date.now());
  const lastCheck = useRef(0);
  const lastState = useRef<AppStateStatus>(AppState.currentState);

  // (1) Early-launch swap: the ON_LOAD check downloaded a new bundle while
  // the splash was still warm — reload now rather than next cold start.
  useEffect(() => {
    if (!Updates.isEnabled || !isUpdatePending) return;
    if (Date.now() - sessionStart.current <= EARLY_LAUNCH_MS) {
      Updates.reloadAsync().catch(() => {});
    }
  }, [isUpdatePending]);

  // (2)+(3) Foreground boundary: apply what's staged, else stage what's new.
  useEffect(() => {
    if (!Updates.isEnabled) return;
    const sub = AppState.addEventListener("change", (next) => {
      const wasBackground =
        lastState.current === "background" || lastState.current === "inactive";
      lastState.current = next;
      if (next !== "active" || !wasBackground) return;

      if (pendingRef.current) {
        Updates.reloadAsync().catch(() => {});
        return;
      }

      const now = Date.now();
      if (now - lastCheck.current < MIN_CHECK_INTERVAL_MS) return;
      lastCheck.current = now;
      Updates.checkForUpdateAsync()
        .then((r) => (r.isAvailable ? Updates.fetchUpdateAsync() : null))
        .catch(() => {
          // Offline / update server unreachable — the app keeps running the
          // bundle it has; the next foreground tries again.
        });
    });
    return () => sub.remove();
  }, []);
}
