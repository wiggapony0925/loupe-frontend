import { QueryClient } from "@tanstack/react-query";

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
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});
