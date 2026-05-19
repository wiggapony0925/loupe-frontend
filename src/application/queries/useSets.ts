import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type { CardSetListResponse, TcgKey } from "@/infrastructure/http";
import { queryKeys } from "./queryKeys";

export function useSets(tcg: TcgKey | "all" = "magic") {
  return useQuery<CardSetListResponse>({
    queryKey: queryKeys.sets.list(tcg),
    queryFn: () =>
      apiFetch<CardSetListResponse>(ENDPOINTS.sets.list, {
        query: { tcg },
        skipAuth: true,
      }),
    staleTime: 60 * 60_000,
  });
}
