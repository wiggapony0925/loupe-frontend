/**
 * useCardListings — live (non-sold) marketplace listings for a card.
 * Fan-out happens server-side (`GET /v1/cards/{id}/listings`).
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type { ListingsResponseWire } from "@/infrastructure/http";
import { queryKeys } from "./queryKeys";

export interface UseCardListingsOptions {
  limit?: number;
}

export function useCardListings(
  id: string | null | undefined,
  opts: UseCardListingsOptions = {},
) {
  const limit = opts.limit ?? 20;
  return useQuery<ListingsResponseWire>({
    queryKey: queryKeys.cards.listings(id ?? "", limit),
    queryFn: () => {
      const qs = new URLSearchParams({ limit: String(limit) });
      return apiFetch<ListingsResponseWire>(
        `${ENDPOINTS.cards.listings(id as string)}?${qs.toString()}`,
        { skipAuth: true },
      );
    },
    enabled: !!id,
    staleTime: 60_000,
  });
}
