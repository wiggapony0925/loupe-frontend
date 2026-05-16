import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";
import { useAuth } from "@/providers/AuthProvider";

export function useScanners<T = unknown>() {
  const { isAuthenticated } = useAuth();
  return useQuery<T>({
    queryKey: ["scanners"],
    queryFn: () => apiFetch<T>(ENDPOINTS.scanners.list),
    enabled: isAuthenticated,
  });
}
