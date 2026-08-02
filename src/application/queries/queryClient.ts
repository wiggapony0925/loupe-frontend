import { QueryClient, onlineManager } from "@tanstack/react-query";
import { isOnlineNow, subscribeOnline } from "@/shared/network";

// Teach TanStack what "online" means on a phone.
//
// Its default detection is a DOM `online`/`offline` listener, which never
// fires in React Native — so every query assumed a live connection, burned its
// retries into a dead socket, and reported plain failures instead of pausing.
// Bridging NetInfo means queries park while offline and resume the moment the
// connection is back, without a manual refresh.
onlineManager.setEventListener((setOnline) => {
  setOnline(isOnlineNow());
  return subscribeOnline(setOnline);
});

// Scan reports are immutable once written — refetching is intentionally lazy.
//
// `refetchOnWindowFocus: true` is what wires into TanStack's `focusManager`.
// On RN there is no DOM `focus` event, so `useAppStateRefresh` (mounted at
// the providers root) bridges `AppState` → `focusManager.setFocused()` so
// that returning to the foreground triggers an immediate refetch of any
// stale queries — fixing the "doesn't refresh immediately after reopening"
// symptom while still respecting `staleTime` for queries that just ran.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 30s mirrors the web client's global (loupe-web AppProviders). This is
      // the user-collection tier — slower data (catalog, market, config)
      // opts up per-hook, so a hook that forgets staleTime over-fetches
      // instead of showing stale vault data.
      staleTime: 30_000,
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});
