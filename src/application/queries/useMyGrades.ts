import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { queryKeys } from "./queryKeys";

export function useMyGrades<T = unknown>() {
  const { isAuthenticated } = useAuth();
  return useQuery<T>({
    queryKey: queryKeys.me.grades(),
    queryFn: () => apiFetch<T>(ENDPOINTS.me.grades),
    enabled: isAuthenticated,
  });
}
