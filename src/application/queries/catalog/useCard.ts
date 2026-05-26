import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type { CardSearchResult } from "@/infrastructure/http";
import { queryKeys } from "../queryKeys";

export function useCard(id: string | null | undefined) {
  return useQuery<CardSearchResult>({
    queryKey: queryKeys.cards.item(id ?? ""),
    queryFn: () =>
      apiFetch<CardSearchResult>(ENDPOINTS.cards.item(id as string), {
        skipAuth: true,
      }),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}
