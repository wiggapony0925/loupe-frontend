import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import { useAuth } from "@/presentation/providers/AuthProvider";
import type { MeResponse } from "@/infrastructure/http";
import { queryKeys } from "./queryKeys";

export function useMe() {
  const { isAuthenticated } = useAuth();
  return useQuery<MeResponse>({
    queryKey: queryKeys.me.profile(),
    queryFn: () => apiFetch<MeResponse>(ENDPOINTS.me.root),
    enabled: isAuthenticated,
    staleTime: Infinity,
  });
}
