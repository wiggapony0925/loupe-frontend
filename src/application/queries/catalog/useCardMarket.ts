/**
 * useCardMarket — fetch the rich per-house × per-grade market snapshot
 * from the Loupe API (`GET /v1/cards/{id}/market`).
 *
 * The endpoint returns the summary, per-range price history, and a
 * deterministic synthesized table of houses (PSA/CGC/BGS/SGC/TAG) ×
 * grades (10..3) so the detail page is stable across refreshes.
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type { MarketResponseWire } from "@/infrastructure/http";
import { queryKeys } from "../queryKeys";

export function useCardMarket(id: string | null | undefined) {
  return useQuery<MarketResponseWire>({
    queryKey: queryKeys.cards.market(id ?? ""),
    queryFn: () =>
      apiFetch<MarketResponseWire>(ENDPOINTS.cards.market(id as string), {
        skipAuth: true,
      }),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}
