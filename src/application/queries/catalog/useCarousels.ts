/**
 * useCarousels — the backend-owned marketplace carousel pool for a game.
 *
 * Fetches `/v1/public/carousels?game=<tcg>`, which returns the canonical
 * curated shelf pool (upgraded to AI-authored shelves when a model is
 * configured). This is the SINGLE SOURCE OF TRUTH the web renders too — mobile
 * compiles each recipe into a card rail (see `CarouselRail`) so both clients
 * show the same carousels. The endpoint is per-game, so the hook is disabled
 * for the mixed `"all"` scope (which has no priced pool).
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type { CarouselResponseWire, TcgKey } from "@/infrastructure/http";
import { queryKeys } from "../queryKeys";

export function useCarousels(game: TcgKey | "all", enabled = true) {
  return useQuery<CarouselResponseWire>({
    queryKey: queryKeys.cards.carousels(game),
    queryFn: () =>
      apiFetch<CarouselResponseWire>(ENDPOINTS.publicCatalog.carousels, {
        query: { game },
        skipAuth: true,
      }),
    // Per-game only — the mixed "all" feed has no server pool.
    enabled: enabled && game !== "all",
    // Shelves are cached daily server-side; a long client staleTime avoids
    // refetching them on every visit to the discover surface.
    staleTime: 30 * 60 * 1000,
  });
}
