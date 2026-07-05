/**
 * useUserSettings — the signed-in user's server-side settings
 * (`GET /v1/me/settings`) + an optimistic patch mutation
 * (`PATCH /v1/me/settings`).
 *
 * These are the settings that must live on the SERVER because the backend
 * acts on them: `push_notifications_enabled` gates whether the price worker
 * pushes alerts to this device, and `email_announcements_enabled` gates
 * product/blog emails. Device-only preferences (haptics, capture) stay in
 * the local `settingsStore`.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type { UserSettings, UserSettingsUpdate } from "@/infrastructure/http";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { queryKeys } from "../queryKeys";

export function useUserSettings() {
  const { isAuthenticated } = useAuth();
  return useQuery<UserSettings>({
    queryKey: queryKeys.me.settings(),
    queryFn: () => apiFetch<UserSettings>(ENDPOINTS.me.settings),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
}

export function useUpdateUserSettings() {
  const qc = useQueryClient();
  return useMutation<UserSettings, Error, UserSettingsUpdate>({
    mutationFn: (patch) =>
      apiFetch<UserSettings>(ENDPOINTS.me.settings, { method: "PATCH", json: patch }),
    // Optimistic: flip the cached value immediately so the switch never lags;
    // roll back on error, and reconcile with the server's copy on success.
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: queryKeys.me.settings() });
      const prev = qc.getQueryData<UserSettings>(queryKeys.me.settings());
      if (prev) {
        qc.setQueryData<UserSettings>(queryKeys.me.settings(), { ...prev, ...patch });
      }
      return { prev };
    },
    onError: (_err, _patch, ctx) => {
      const prev = (ctx as { prev?: UserSettings } | undefined)?.prev;
      if (prev) qc.setQueryData(queryKeys.me.settings(), prev);
    },
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.me.settings(), data);
    },
  });
}
