import { useQuery } from "@tanstack/react-query";
import { fetchFilterMetadata, type FilterMetadata } from "@/infrastructure/repositories/forensicRepository";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { queryKeys } from "../queryKeys";

export function useFilterMetadata() {
  const { isAuthenticated } = useAuth();
  return useQuery<FilterMetadata>({
    queryKey: queryKeys.collection.filters(),
    queryFn: fetchFilterMetadata,
    enabled: isAuthenticated,
    staleTime: 24 * 60 * 60 * 1000, // Cache for 24 hours since it's static metadata
  });
}
