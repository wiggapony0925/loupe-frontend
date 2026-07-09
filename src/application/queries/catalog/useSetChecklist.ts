/**
 * `useSetChecklist` — the full owned/missing card list for one set.
 *
 * Backs the set-progress bottom sheet: tap a set tile → see every card in
 * the set split into "in your collection" and "still missing". The backend
 * builds the complete list (from the catalog mirror for Pokémon, local index
 * as a fallback) and flags each card `owned` — the client just renders it.
 *
 * Lazy: only fetches while the sheet is open (`enabled`), so the carousel
 * doesn't fire one request per visible tile.
 */

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type { SetChecklistWire } from "@/infrastructure/http";
import { queryKeys } from "../queryKeys";

export function useSetChecklist(setId: string | null, enabled = true) {
  return useQuery<SetChecklistWire>({
    queryKey: queryKeys.sets.checklist(setId ?? ""),
    queryFn: () => apiFetch<SetChecklistWire>(ENDPOINTS.sets.checklist(setId!)),
    enabled: enabled && !!setId,
    staleTime: 5 * 60_000,
  });
}
