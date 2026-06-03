/**
 * Watchlist query + mutation hooks.
 *
 * The card-detail "heart" toggle, the dedicated Watchlist tab, and any
 * other "is this pinned?" check all share one cached list — when the
 * user pins/unpins anywhere, every consumer re-derives from a single
 * source of truth.
 *
 * Mutations are optimistic: pin/unpin reflects in the UI immediately
 * and rolls back on error. This keeps the heart-tap feel instant even
 * on a slow connection.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type { WatchlistItemWire } from "@/infrastructure/http";
import { queryKeys } from "../queryKeys";

export function useWatchlist(opts: { enabled?: boolean } = {}) {
  const enabled = opts.enabled ?? true;
  return useQuery<WatchlistItemWire[]>({
    queryKey: queryKeys.watchlist.list(),
    queryFn: () =>
      apiFetch<WatchlistItemWire[]>(ENDPOINTS.watchlist.list),
    enabled,
    staleTime: 30_000,
  });
}

/** Derived selector — true when `cardId` is on the signed-in user's watchlist. */
export function useIsWatching(cardId: string | undefined, enabled = true): boolean {
  const { data } = useWatchlist({ enabled });
  if (!cardId || !data) return false;
  return data.some((row) => row.card_id === cardId);
}

export function useAddToWatchlist() {
  const qc = useQueryClient();
  return useMutation<WatchlistItemWire, Error, string>({
    mutationFn: (cardId) =>
      apiFetch<WatchlistItemWire>(ENDPOINTS.watchlist.add, {
        method: "POST",
        json: { card_id: cardId },
      }),
    onMutate: async (cardId) => {
      await qc.cancelQueries({ queryKey: queryKeys.watchlist.all });
      const prev = qc.getQueryData<WatchlistItemWire[]>(
        queryKeys.watchlist.list(),
      );
      if (prev && !prev.some((r) => r.card_id === cardId)) {
        const optimistic: WatchlistItemWire = {
          id: `optimistic-${cardId}`,
          user_id: "",
          card_id: cardId,
          created_at: new Date().toISOString(),
          card_name: null,
          card_image_url: null,
        };
        qc.setQueryData<WatchlistItemWire[]>(queryKeys.watchlist.list(), [
          optimistic,
          ...prev,
        ]);
      }
      return { prev };
    },
    onError: (_err, _cardId, ctx) => {
      const c = ctx as { prev?: WatchlistItemWire[] } | undefined;
      if (c?.prev) {
        qc.setQueryData(queryKeys.watchlist.list(), c.prev);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.watchlist.all });
    },
  });
}

export function useRemoveFromWatchlist() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (cardId) => {
      await apiFetch<void>(ENDPOINTS.watchlist.item(cardId), {
        method: "DELETE",
      });
    },
    onMutate: async (cardId) => {
      await qc.cancelQueries({ queryKey: queryKeys.watchlist.all });
      const prev = qc.getQueryData<WatchlistItemWire[]>(
        queryKeys.watchlist.list(),
      );
      if (prev) {
        qc.setQueryData<WatchlistItemWire[]>(
          queryKeys.watchlist.list(),
          prev.filter((r) => r.card_id !== cardId),
        );
      }
      return { prev };
    },
    onError: (_err, _cardId, ctx) => {
      const c = ctx as { prev?: WatchlistItemWire[] } | undefined;
      if (c?.prev) {
        qc.setQueryData(queryKeys.watchlist.list(), c.prev);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.watchlist.all });
    },
  });
}
