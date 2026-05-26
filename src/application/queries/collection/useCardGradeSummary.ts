/**
 * useCardGradeSummary — per-grade price summary for a card.
 * `GET /v1/cards/{id}/grade-summary?window_days=30`.
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type { GradeSummaryResponseWire } from "@/infrastructure/http";
import { queryKeys } from "../queryKeys";

export interface UseCardGradeSummaryOptions {
  windowDays?: number;
}

export function useCardGradeSummary(
  id: string | null | undefined,
  opts: UseCardGradeSummaryOptions = {},
) {
  const windowDays = opts.windowDays ?? 30;
  return useQuery<GradeSummaryResponseWire>({
    queryKey: queryKeys.cards.gradeSummary(id ?? "", windowDays),
    queryFn: () => {
      const qs = new URLSearchParams({ window_days: String(windowDays) });
      return apiFetch<GradeSummaryResponseWire>(
        `${ENDPOINTS.cards.gradeSummary(id as string)}?${qs.toString()}`,
        { skipAuth: true },
      );
    },
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}
