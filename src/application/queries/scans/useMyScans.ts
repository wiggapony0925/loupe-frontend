import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { queryKeys } from "../queryKeys";

export function useMyScans<T = unknown>() {
  const { isAuthenticated } = useAuth();
  return useQuery<T>({
    queryKey: queryKeys.scans.mine(),
    queryFn: () => apiFetch<T>(ENDPOINTS.scans.list),
    enabled: isAuthenticated,
    // NOT covered by invalidateHoldingCaches — a short staleTime is the only
    // thing that surfaces a new scan here, so keep it at the 30s tier.
    staleTime: 30_000,
  });
}
