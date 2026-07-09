import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { useActiveCollection } from "@/application/stores/activeCollectionStore";
import { queryKeys } from "../queryKeys";

export function useMyGrades<T = unknown>() {
  const { isAuthenticated } = useAuth();
  const { collectionId } = useActiveCollection();
  return useQuery<T>({
    queryKey: [...queryKeys.me.grades(), collectionId ?? "all"],
    queryFn: () =>
      apiFetch<T>(ENDPOINTS.me.grades, {
        query: collectionId ? { collection_id: collectionId } : undefined,
      }),
    enabled: isAuthenticated,
    // Writes invalidate via invalidateHoldingCaches; 30s only covers drift.
    staleTime: 30_000,
  });
}
