import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";
import { useAuth } from "@/providers/AuthProvider";

export function useMyGrades<T = unknown>() {
  const { isAuthenticated } = useAuth();
  return useQuery<T>({
    queryKey: ["me", "grades"],
    queryFn: () => apiFetch<T>(ENDPOINTS.me.grades),
    enabled: isAuthenticated,
  });
}
