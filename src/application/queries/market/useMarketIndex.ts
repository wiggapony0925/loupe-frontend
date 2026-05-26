/**
 * useMarketIndex — fetch a normalized cohort index series.
 *
 * Currently the only index is `psa10` — the average PSA-10 spot price
 * across every catalog card any Loupe user owns, normalized to 100 at
 * the first bucket. Pair with `usePortfolioHistory` and overlay the
 * lines (both starting at 100 visually) to show relative performance.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type { MarketIndexHistoryWire } from "@/infrastructure/http";
import type { PortfolioTimeframe } from "@/domain/charts";
import { queryKeys } from "../queryKeys";

export interface UseMarketIndexOptions {
  indexId: "psa10";
  range: PortfolioTimeframe;
  enabled?: boolean;
}

export function useMarketIndex({
  indexId,
  range,
  enabled = true,
}: UseMarketIndexOptions): UseQueryResult<MarketIndexHistoryWire> {
  return useQuery({
    queryKey: queryKeys.marketIndex.history(indexId, range),
    queryFn: () =>
      apiFetch<MarketIndexHistoryWire>(
        `${ENDPOINTS.market.indexHistory(indexId)}?range=${encodeURIComponent(range)}`,
      ),
    enabled,
    staleTime: 5 * 60_000,
  });
}
