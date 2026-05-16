import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";
import { useAuth } from "@/providers/AuthProvider";
import { queryKeys } from "./queryKeys";

export function useMyScans<T = unknown>() {
  const { isAuthenticated } = useAuth();
  return useQuery<T>({
    queryKey: queryKeys.scans.mine(),
    queryFn: () => apiFetch<T>(ENDPOINTS.scans.list),
    enabled: isAuthenticated,
  });
}
