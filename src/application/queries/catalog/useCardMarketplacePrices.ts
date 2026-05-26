/**
 * useCardMarketplacePrices — lowest active listing per provider.
 * `GET /v1/cards/{id}/marketplace-prices?limit=50`.
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type { MarketplacePricesResponseWire } from "@/infrastructure/http";
import { queryKeys } from "../queryKeys";

export interface UseCardMarketplacePricesOptions {
  limit?: number;
}

export function useCardMarketplacePrices(
  id: string | null | undefined,
  opts: UseCardMarketplacePricesOptions = {},
) {
  const limit = opts.limit ?? 50;
  return useQuery<MarketplacePricesResponseWire>({
    queryKey: queryKeys.cards.marketplacePrices(id ?? "", limit),
    queryFn: () => {
      const qs = new URLSearchParams({ limit: String(limit) });
      return apiFetch<MarketplacePricesResponseWire>(
        `${ENDPOINTS.cards.marketplacePrices(id as string)}?${qs.toString()}`,
        { skipAuth: true },
      );
    },
    enabled: !!id,
    staleTime: 60_000,
  });
}
