/**
 * AppProviders — single mount point composing every cross-cutting provider.
 * Order: QueryClient → Auth → Theme → children.
 */
import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { AuthProvider } from "@/providers/AuthProvider";

interface Props {
  children: React.ReactNode;
}

export function AppProviders({ children }: Props) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>{children}</ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
