import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import { MeResponseSchema } from "@/infrastructure/http/schemas";
import { useAuth } from "@/presentation/providers/AuthProvider";
import type { MeResponse } from "@/infrastructure/http";
import { queryKeys } from "./queryKeys";

export function useMe() {
  const { isAuthenticated } = useAuth();
  return useQuery<MeResponse>({
    queryKey: queryKeys.me.profile(),
    queryFn: () =>
      apiFetch<MeResponse>(ENDPOINTS.me.root, { schema: MeResponseSchema }),
    enabled: isAuthenticated,
    // Refresh user profile (email verification, subscription tier, etc.)
    // on a sane cadence instead of pinning it forever in the cache.
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  });
}
