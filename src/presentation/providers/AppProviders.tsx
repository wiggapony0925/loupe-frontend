/**
 * AppProviders — single mount point composing every cross-cutting provider.
 * Order: QueryClient → Api → Auth → Theme → children.
 */
import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/application/queries/queryClient";
import { ApiProvider } from "@/api";
import { ThemeProvider } from "@/presentation/theme/ThemeProvider";
import { AuthProvider } from "@/presentation/providers/AuthProvider";

interface Props {
  children: React.ReactNode;
}

export function AppProviders({ children }: Props) {
  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider>
        <AuthProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </AuthProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}
