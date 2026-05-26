/**
 * usePortfolioHistory — fetch the signed-in user's portfolio value
 * over time from `/v1/grades/history?range=…`.
 *
 * The backend computes each point as the sum of the user's owned cards'
 * `estimated_value_usd`, using the per-card `price_history` populated by
 * the daily `price_backfill` worker to value each card on the bucket
 * date (last-known-price). Changing the active currency in the UI does
 * NOT trigger a refetch — points stay in USD and the presentation layer
 * converts at render time.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type { PortfolioHistoryWire } from "@/infrastructure/http";
import type { PortfolioSeries, PortfolioTimeframe } from "@/domain/charts";
import { queryKeys } from "../queryKeys";

export interface UsePortfolioHistoryOptions {
  timeframe: PortfolioTimeframe;
  /** Disable the query (e.g. while the user is signed out). */
  enabled?: boolean;
}

function adapt(wire: PortfolioHistoryWire): PortfolioSeries {
  return {
    timeframe: wire.range,
    points: wire.points.map((p) => ({ date: p.date, priceUsd: p.priceUsd })),
    deltaUsd: wire.deltaUsd,
    deltaPct: wire.deltaPct,
  };
}

export function usePortfolioHistory({
  timeframe,
  enabled = true,
}: UsePortfolioHistoryOptions): UseQueryResult<PortfolioSeries> {
  return useQuery({
    queryKey: queryKeys.portfolio.history(timeframe),
    queryFn: async () => {
      const wire = await apiFetch<PortfolioHistoryWire>(
        `${ENDPOINTS.me.grades}/history?range=${encodeURIComponent(timeframe)}`,
      );
      return adapt(wire);
    },
    enabled,
    // The backend caches nothing — but the value only meaningfully
    // changes on a backfill tick (~daily) for most ranges. 60s is a
    // sensible UI staleness window.
    staleTime: 60_000,
  });
}
