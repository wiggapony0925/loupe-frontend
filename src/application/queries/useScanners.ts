import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { queryKeys } from "./queryKeys";

export function useScanners<T = unknown>() {
  const { isAuthenticated } = useAuth();
  return useQuery<T>({
    queryKey: queryKeys.scanners.list(),
    queryFn: () => apiFetch<T>(ENDPOINTS.scanners.list),
    enabled: isAuthenticated,
  });
}
