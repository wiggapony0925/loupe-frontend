import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";
import { useAuth } from "@/providers/AuthProvider";
import { queryKeys } from "./queryKeys";

export function useScanners<T = unknown>() {
  const { isAuthenticated } = useAuth();
  return useQuery<T>({
    queryKey: queryKeys.scanners.list(),
    queryFn: () => apiFetch<T>(ENDPOINTS.scanners.list),
    enabled: isAuthenticated,
  });
}
