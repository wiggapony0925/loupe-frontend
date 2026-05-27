/**
 * AppProviders — composes cross-cutting data/runtime providers.
 *
 * `ThemeProvider` lives one level **above** this in `app/_layout.tsx`
 * because it owns the Gluestack UI provider (a `<View>` that needs to
 * be near the root) and because `<AppProviders>` consumers may read
 * `useTheme()` — including the auth screens.
 *
 * Order here: QueryClient → Api → Auth → children.
 */
import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/application/queries/queryClient";
import { ApiProvider } from "@/presentation/providers/ApiProvider";
import { AuthProvider } from "@/presentation/providers/AuthProvider";
import { useAppStateRefresh } from "@/presentation/providers/useAppStateRefresh";

interface Props {
  children: React.ReactNode;
}

export function AppProviders({ children }: Props) {
  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider>
        <AuthProvider>
          <AppStateBridge>{children}</AppStateBridge>
        </AuthProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}

/**
 * Tiny inner component that exists purely to host the `useAppStateRefresh`
 * hook beneath both the QueryClient and Auth providers — the hook needs
 * both `useQueryClient()` and `useAuth()` in scope.
 */
function AppStateBridge({ children }: { children: React.ReactNode }) {
  useAppStateRefresh();
  return <>{children}</>;
}
