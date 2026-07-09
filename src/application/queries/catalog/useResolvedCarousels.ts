/**
 * useResolvedCarousels — a game's discovery carousels ALREADY resolved into
 * cards by the backend (`/v1/public/carousels/resolved`).
 *
 * The backend runs each recipe against the shelf/catalog, applies the
 * price/rarity/sort/limit lens, prepends a trending anchor + appends an explore
 * rail, and DROPS any rail too thin to show. So the client just renders
 * `rails[].cards` — identical to web, with zero client-side filtering (this is
 * why the mobile rails used to come back empty: the filtering diverged). The
 * endpoint is per-game, so the hook is disabled for the mixed `"all"` scope.
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type { ResolvedCarouselsWire, TcgKey } from "@/infrastructure/http";
import { queryKeys } from "../queryKeys";

export function useResolvedCarousels(game: TcgKey | "all", enabled = true) {
  return useQuery<ResolvedCarouselsWire>({
    queryKey: queryKeys.cards.resolvedCarousels(game),
    queryFn: () =>
      apiFetch<ResolvedCarouselsWire>(ENDPOINTS.publicCatalog.carouselsResolved, {
        query: { game },
        skipAuth: true,
      }),
    enabled: enabled && game !== "all",
    // Resolved rails are cached server-side (15m); keep them a while client-side.
    staleTime: 10 * 60 * 1000,
  });
}
