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
    retry: 0,
    staleTime: 15_000,
  });
}
