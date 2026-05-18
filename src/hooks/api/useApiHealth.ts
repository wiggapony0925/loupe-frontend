import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";
import type { HealthResponse } from "@/api/types";
import { queryKeys } from "./queryKeys";

export function useApiHealth() {
  return useQuery<HealthResponse>({
    queryKey: queryKeys.system.health(),
    queryFn: () =>
      apiFetch<HealthResponse>(ENDPOINTS.system.health, { skipAuth: true }),
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    // Cold-mount fetches can race the simulator network coming up; retry a
    // few times with backoff so a single transient failure doesn't pin the
    // header pill to "API down" for 30s.
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    staleTime: 15_000,
  });
}
