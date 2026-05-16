import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";
import type { CardSearchResponse, TcgKey } from "@/api/types";

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
  return useQuery<CardSearchResponse>({
    queryKey: ["cards", "search", tcg, trimmed, limit],
    queryFn: () =>
      apiFetch<CardSearchResponse>(ENDPOINTS.cards.search, {
        query: { q: trimmed, tcg, limit },
        skipAuth: true,
      }),
    enabled: isEnabled,
    staleTime: 60_000,
  });
}
