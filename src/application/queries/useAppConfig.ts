/**
 * Remote app configuration hook.
 *
 * Fetches `/v1/app/config` once per launch, caches it for 5 minutes,
 * and revalidates on focus. The response drives feature flags,
 * server-driven Home rail ordering, and the force-update gate.
 *
 * Consumers should treat every field as optional — when the network is
 * down or the user is on a wifi captive portal we want the app to keep
 * working with whatever last-known config we cached (TanStack does this
 * automatically once the query has resolved at least once).
 */
import { useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import { queryKeys } from "@/application/queries/queryKeys";
import {
  fetchAppConfig,
  type AppConfig,
} from "@/infrastructure/repositories/forensicRepository";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function useAppConfig() {
  const clientVersion = Constants.expoConfig?.version ?? "0.0.0";
  return useQuery<AppConfig>({
    queryKey: queryKeys.appConfig.get(),
    queryFn: () => fetchAppConfig(clientVersion),
    staleTime: FIVE_MINUTES_MS,
    // Don't error-boundary the whole app if /app/config is briefly down;
    // the hook returns `undefined` data and consumers fall back to
    // baked-in defaults.
    retry: 1,
  });
}

/**
 * Convenience accessor — returns the boolean value of a feature flag
 * with a hard-coded default so the call site stays a one-liner:
 *
 *     if (useFeatureFlag("vaultStaggerAnim", true)) { ... }
 */
export function useFeatureFlag(name: string, defaultValue = false): boolean {
  const { data } = useAppConfig();
  if (!data) return defaultValue;
  return data.flags[name] ?? defaultValue;
}
