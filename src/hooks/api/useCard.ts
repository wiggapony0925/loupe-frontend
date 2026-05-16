import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";
import type { CardSearchResult } from "@/api/types";

export function useCard(id: string | null | undefined) {
  return useQuery<CardSearchResult>({
    queryKey: ["cards", "item", id],
    queryFn: () =>
      apiFetch<CardSearchResult>(ENDPOINTS.cards.item(id as string), {
        skipAuth: true,
      }),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}
