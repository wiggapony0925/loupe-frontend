import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type { CardSetListResponse, CardSetSummary, TcgKey } from "@/infrastructure/http";
import { queryKeys } from "../queryKeys";

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

/** Sort key for release dates across providers — pokemontcg.io uses
 *  `1999/01/09`, everyone else ISO dashes. Empty = undated. */
const releaseKey = (s: CardSetSummary) => (s.release_date ?? "").replace(/\//g, "-");

/**
 * Newest releases across the date-backed games — the backend-defined feed
 * (`/v1/sets?tcg=all&sort=newest`) behind the home "Newest sets" rail.
 * Older backends ignore `sort`/`limit`, so the ordering + slice are repeated
 * client-side; against a current backend that re-sort is a no-op.
 */
export function useNewestSets(limit = 12) {
  return useQuery({
    queryKey: queryKeys.sets.newest(limit),
    queryFn: () =>
      apiFetch<CardSetListResponse>(ENDPOINTS.sets.list, {
        query: { tcg: "all", sort: "newest", limit },
        skipAuth: true,
      }),
    staleTime: 60 * 60_000,
    select: (data: CardSetListResponse): CardSetSummary[] =>
      [...(data.results ?? [])]
        .filter((s) => releaseKey(s))
        .sort((a, b) => releaseKey(b).localeCompare(releaseKey(a)))
        .slice(0, limit),
  });
}
