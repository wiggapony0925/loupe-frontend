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

interface Props {
  children: React.ReactNode;
}

export function AppProviders({ children }: Props) {
  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider>
        <AuthProvider>{children}</AuthProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}
