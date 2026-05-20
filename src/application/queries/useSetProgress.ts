/**
 * `useSetProgress` — per-set completion progress for the signed-in user.
 *
 * Backs the "Sets" carousel on the Vault tab. Returns one row per set
 * the user owns at least one card from; sets the user has never touched
 * are omitted (showing 0/100 cards for every TCG set ever printed would
 * be useless noise).
 */

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type { SetProgressWire } from "@/infrastructure/http";
import { queryKeys } from "./queryKeys";

export function useSetProgress() {
  return useQuery<SetProgressWire[]>({
    queryKey: queryKeys.sets.progress(),
    queryFn: () => apiFetch<SetProgressWire[]>(ENDPOINTS.sets.progress),
    staleTime: 5 * 60_000,
  });
}
