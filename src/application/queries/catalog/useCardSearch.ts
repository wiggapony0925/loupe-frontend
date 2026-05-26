import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import { prefetchCardImages } from "@/shared/cardImage";
import type { CardSearchResponse, TcgKey } from "@/infrastructure/http";
import { queryKeys } from "../queryKeys";

type SearchTcg = TcgKey | "all";

interface Options {
  q: string;
  tcg?: SearchTcg;
  limit?: number;
  enabled?: boolean;
}

export function useCardSearch({ q, tcg = "all", limit = 20, enabled = true }: Options) {
  const trimmed = q.trim();
  const isEnabled = enabled && trimmed.length >= 2;
  const query = useQuery<CardSearchResponse>({
    queryKey: queryKeys.cards.search(tcg, trimmed, limit),
    queryFn: () =>
      apiFetch<CardSearchResponse>(ENDPOINTS.cards.search, {
        query: { q: trimmed, tcg, limit },
        skipAuth: true,
      }),
    enabled: isEnabled,
    staleTime: 60_000,
  });

  // Warm the disk cache for thumbnails as soon as results land so
  // tiles paint immediately on render instead of waiting on slow
  // third-party CDNs (pokemontcg.io, ygoprodeck.com).
  useEffect(() => {
    if (query.data?.results) prefetchCardImages(query.data.results);
  }, [query.data]);

  return query;
}
