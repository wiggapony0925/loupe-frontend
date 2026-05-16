import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";
import type { TcgKey, TrendingResponseWire } from "@/api/types";

type TrendingTcg = TcgKey | "all";

interface Options {
  tcg?: TrendingTcg;
  limit?: number;
  enabled?: boolean;
}

export function useTrendingCards({ tcg = "all", limit = 24, enabled = true }: Options = {}) {
  return useQuery<TrendingResponseWire>({
    queryKey: ["cards", "trending", tcg, limit],
    queryFn: () =>
      apiFetch<TrendingResponseWire>(ENDPOINTS.cards.trending, {
        query: { tcg, limit },
        skipAuth: true,
      }),
    enabled,
    staleTime: 15 * 60 * 1000,
  });
}
