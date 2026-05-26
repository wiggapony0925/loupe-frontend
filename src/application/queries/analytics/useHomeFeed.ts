/**
 * useHomeFeed — single React Query subscription for the Command-tab rails
 * (top movers + recent scans), powered by `GET /v1/home/feed`.
 *
 * Replaces the previous N+1 client fan-out (`useMyGrades` → per-card
 * `/v1/cards/{id}` + `/v1/cards/{id}/market`) with one authenticated
 * round-trip. The backend computes 1-year change % from real
 * `price_history`, dedupes by `card_id`, and sorts by `|change_pct_1y|`.
 */
import { useQuery } from "@tanstack/react-query";
import {
  fetchHomeFeed,
  type HomeFeed,
  type HomeFeedParams,
} from "@/infrastructure/repositories/homeRepository";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { queryKeys } from "../queryKeys";

export function useHomeFeed(params: HomeFeedParams = {}) {
  const { isAuthenticated } = useAuth();
  const topMovers = params.topMovers ?? 5;
  const recentScans = params.recentScans ?? 6;
  return useQuery<HomeFeed>({
    queryKey: queryKeys.home.feed(topMovers, recentScans),
    queryFn: () => fetchHomeFeed({ topMovers, recentScans }),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
}
