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
import { queryKeys } from "../queryKeys";

export function useAnalyticsOverview() {
  const { isAuthenticated } = useAuth();
  return useQuery<AnalyticsOverview>({
    queryKey: queryKeys.analytics.overview(),
    queryFn: fetchAnalyticsOverview,
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
}
