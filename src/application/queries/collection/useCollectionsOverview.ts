/**
 * useCollectionsOverview — the portfolio switcher's data.
 *
 * `GET /v1/collections/overview` returns the synthetic **All** entry
 * (everything owned; `is_all`, never deletable) plus each collection with a
 * live card count + total value. Backend-owned — we just render it.
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import { useAuth } from "@/presentation/providers/AuthProvider";

/** Mirrors `CollectionSummary` in `app/schemas/collection.py`. */
export interface CollectionSummary {
  /** null for the synthetic "All" entry. */
  id: string | null;
  name: string;
  color: string | null;
  card_count: number;
  total_value_usd: number;
  is_all: boolean;
  deletable: boolean;
}

export function useCollectionsOverview() {
  const { isAuthenticated } = useAuth();
  return useQuery<CollectionSummary[]>({
    queryKey: ["collection", "overview"],
    queryFn: () =>
      apiFetch<CollectionSummary[]>(ENDPOINTS.collections.overview),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });
}
