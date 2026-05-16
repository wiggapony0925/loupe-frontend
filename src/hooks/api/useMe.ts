import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";
import { useAuth } from "@/providers/AuthProvider";
import type { MeResponse } from "@/api/types";

export function useMe() {
  const { isAuthenticated } = useAuth();
  return useQuery<MeResponse>({
    queryKey: ["me"],
    queryFn: () => apiFetch<MeResponse>(ENDPOINTS.me.root),
    enabled: isAuthenticated,
    staleTime: Infinity,
  });
}
