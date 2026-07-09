/**
 * useAnalyticsOverview — single React Query subscription for the
 * Analytics tab. Powered by `GET /v1/analytics/overview`.
 */
import { useQuery } from "@tanstack/react-query";
import {
  fetchAnalyticsOverview,
  type AnalyticsOverview,
} from "@/infrastructure/repositories/analyticsRepository";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { useActiveCollection } from "@/application/stores/activeCollectionStore";
import { queryKeys } from "../queryKeys";

export function useAnalyticsOverview() {
  const { isAuthenticated } = useAuth();
  const { collectionId } = useActiveCollection();
  return useQuery<AnalyticsOverview>({
    queryKey: [...queryKeys.analytics.overview(), collectionId ?? "all"],
    queryFn: () => fetchAnalyticsOverview(collectionId),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
}
