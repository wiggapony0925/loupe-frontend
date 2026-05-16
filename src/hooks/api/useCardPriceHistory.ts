/**
 * useCardPriceHistory — fetch a card's price history series from the
 * Loupe API (`GET /v1/cards/{id}/prices?range=…`).
 *
 * Server emits a deterministic synthesized walk seeded by the card id
 * until we have a real historical-prices upstream, so the chart is
 * stable across refreshes.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";
import type { PriceHistoryWire } from "@/api/types";
import { queryKeys } from "./queryKeys";

export type PriceHistoryRange = "7d" | "30d" | "90d" | "180d" | "1y";

export interface UseCardPriceHistoryOptions {
  id: string | null | undefined;
  range?: PriceHistoryRange;
  house?: string;
  grade?: string;
  enabled?: boolean;
}

export function useCardPriceHistory({
  id,
  range = "30d",
  house = "raw",
  grade,
  enabled = true,
}: UseCardPriceHistoryOptions): UseQueryResult<PriceHistoryWire> {
  return useQuery({
    queryKey: queryKeys.cards.priceHistory(id ?? "", range, house, grade),
    queryFn: () => {
      const qs = new URLSearchParams({ range, house });
      if (grade) qs.set("grade", grade);
      return apiFetch<PriceHistoryWire>(
        `${ENDPOINTS.cards.prices(id!)}?${qs.toString()}`,
      );
    },
    enabled: enabled && !!id,
    staleTime: 5 * 60_000,
  });
}
