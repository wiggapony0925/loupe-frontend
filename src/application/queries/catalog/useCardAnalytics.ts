/**
 * useCardAnalytics — derived market metrics from the Loupe API
 * (`GET /v1/cards/{id}/analytics`, public).
 *
 * Figures are composed server-side (market cap, momentum, volatility, grade
 * premium, all-time high/low, liquidity) so web + mobile show identical
 * numbers without each recomputing them.
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type { CardAnalyticsWire } from "@/infrastructure/http";
import { queryKeys } from "../queryKeys";

export function useCardAnalytics(id: string | null | undefined) {
  return useQuery<CardAnalyticsWire>({
    queryKey: queryKeys.cards.analytics(id ?? ""),
    queryFn: () =>
      apiFetch<CardAnalyticsWire>(ENDPOINTS.cards.analytics(id as string), {
        skipAuth: true,
      }),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}
