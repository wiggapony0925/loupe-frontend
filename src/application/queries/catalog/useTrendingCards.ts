import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import { prefetchCardImages } from "@/shared/cardImage";
import type { TcgKey, TrendingResponseWire } from "@/infrastructure/http";
import { queryKeys } from "../queryKeys";

type TrendingTcg = TcgKey | "all";

interface Options {
  tcg?: TrendingTcg;
  limit?: number;
  enabled?: boolean;
  /**
   * Server-side ordering. `"trending"` (default) is the movement feed;
   * `"value"` sorts by current market price (the reliable feed — see
   * `useMixedTrending`). Forwarded as `?sort=`.
   */
  sort?: "trending" | "value";
  /** Cap results to cards at/under this USD price. Forwarded as `?max_price=`. */
  maxPrice?: number;
}

export function useTrendingCards({
  tcg = "all",
  limit = 24,
  enabled = true,
  sort = "trending",
  maxPrice,
}: Options = {}) {
  const query = useQuery<TrendingResponseWire>({
    queryKey: queryKeys.cards.trending(tcg, limit, sort, maxPrice ?? null),
    queryFn: () =>
      apiFetch<TrendingResponseWire>(ENDPOINTS.cards.trending, {
        query: {
          tcg,
          limit,
          sort,
          ...(maxPrice != null ? { max_price: maxPrice } : {}),
        },
        skipAuth: true,
      }),
    enabled,
    staleTime: 15 * 60 * 1000,
  });

  // Warm the disk cache for the small thumbnails as soon as results
  // land. Tiles render right after, so this turns most cold-cache
  // requests into cache hits and hides slow CDN tail latencies.
  useEffect(() => {
    if (query.data?.cards) prefetchCardImages(query.data.cards);
  }, [query.data]);

  return query;
}
