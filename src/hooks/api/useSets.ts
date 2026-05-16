import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";
import type { CardSetListResponse, TcgKey } from "@/api/types";

export function useSets(tcg: TcgKey | "all" = "magic") {
  return useQuery<CardSetListResponse>({
    queryKey: ["sets", tcg],
    queryFn: () =>
      apiFetch<CardSetListResponse>(ENDPOINTS.sets.list, {
        query: { tcg },
        skipAuth: true,
      }),
    staleTime: 60 * 60_000,
  });
}
