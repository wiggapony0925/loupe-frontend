/**
 * useNearbyStores — card & game shops around a point.
 *
 * Public endpoint (no auth gate — the map works signed-out). The backend
 * owns filtering/ranking/labels and snaps queries to a ~1 km grid with a
 * day-long cache, so refetching as the user pans is cheap; we still round
 * the key client-side so tiny GPS jitter reuses the same query cache row.
 */
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type {
  PlaceSuggestionsWire,
  NearbyStoresWire,
  SavedStoresWire,
  StoreDetailWire,
  StoreReviewWire,
  StoreSaveWire,
} from "@/infrastructure/http";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { queryKeys } from "../queryKeys";

export function useNearbyStores(
  center: { lat: number; lng: number } | null,
  radiusKm = 25,
) {
  const lat = center ? Number(center.lat.toFixed(2)) : null;
  const lng = center ? Number(center.lng.toFixed(2)) : null;
  return useQuery<NearbyStoresWire>({
    queryKey: queryKeys.stores.nearby(lat ?? 0, lng ?? 0, radiusKm),
    queryFn: () =>
      apiFetch<NearbyStoresWire>(ENDPOINTS.publicCatalog.storesNearby, {
        query: { lat: lat as number, lng: lng as number, radius_km: radiusKm },
      }),
    enabled: lat != null && lng != null,
    staleTime: 10 * 60_000,
    // Reopening the map inside half an hour is instant, and searching a
    // new area keeps the previous results on screen while it loads —
    // the drawer never blanks mid-search.
    gcTime: 30 * 60_000,
    placeholderData: keepPreviousData,
  });
}

/** One shop with its photo and community reviews. */
export function useStoreDetail(storeId: string | null) {
  return useQuery<StoreDetailWire>({
    queryKey: queryKeys.stores.detail(storeId ?? ""),
    queryFn: () =>
      apiFetch<StoreDetailWire>(ENDPOINTS.publicCatalog.storeDetail(storeId as string)),
    enabled: !!storeId,
    staleTime: 60_000,
  });
}

/** Write or edit MY review of a shop (one per collector per store). */
export function useUpsertStoreReview() {
  const qc = useQueryClient();
  return useMutation<
    StoreReviewWire,
    Error,
    { storeId: string; rating: number; body?: string | null }
  >({
    mutationFn: ({ storeId, rating, body }) =>
      apiFetch<StoreReviewWire>(ENDPOINTS.publicCatalog.storeReview(storeId), {
        method: "PUT",
        json: { rating, body: body ?? null },
      }),
    // The rating changes both the detail sheet AND the map card's ★.
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.stores.all }),
  });
}

/** Remove my review. */
export function useDeleteStoreReview() {
  const qc = useQueryClient();
  return useMutation<void, Error, { storeId: string }>({
    mutationFn: ({ storeId }) =>
      apiFetch<void>(ENDPOINTS.publicCatalog.storeReview(storeId), {
        method: "DELETE",
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.stores.all }),
  });
}

/** Heart a shop into (or out of) my saved places. Optimistic. */
export function useToggleSaveStore() {
  const qc = useQueryClient();
  return useMutation<
    StoreSaveWire,
    Error,
    { storeId: string; saved: boolean }
  >({
    mutationFn: ({ storeId, saved }) =>
      apiFetch<StoreSaveWire>(ENDPOINTS.publicCatalog.storeSave(storeId), {
        method: saved ? "DELETE" : "PUT",
      }),
    onSuccess: (data) => {
      // Patch the flag everywhere it renders rather than refetching the
      // map — a heart must never lag behind the tap.
      qc.setQueriesData<NearbyStoresWire>(
        { queryKey: queryKeys.stores.all },
        (old) =>
          old && "stores" in old
            ? {
                ...old,
                stores: old.stores.map((s) =>
                  s.id === data.store_id ? { ...s, is_saved: data.is_saved } : s,
                ),
              }
            : old,
      );
      qc.setQueriesData<StoreDetailWire>(
        { queryKey: queryKeys.stores.detail(data.store_id) },
        (old) =>
          old ? { ...old, store: { ...old.store, is_saved: data.is_saved } } : old,
      );
      void qc.invalidateQueries({ queryKey: queryKeys.stores.saved() });
    },
  });
}

/** My saved places, newest first. */
export function useSavedStores(enabled = true) {
  const { isAuthenticated } = useAuth();
  return useQuery<SavedStoresWire>({
    queryKey: queryKeys.stores.saved(),
    queryFn: () => apiFetch<SavedStoresWire>(ENDPOINTS.publicCatalog.storesSaved),
    enabled: isAuthenticated && enabled,
    staleTime: 60_000,
  });
}

/**
 * City / region / country autocomplete for the profile location field.
 *
 * Location used to be a free-text box, so profiles carried "whatberel" —
 * unusable for grouping or trust, and easy to abuse. This makes it a CHOICE.
 * The label the server returns is what gets stored, so the same city can't
 * read two ways across surfaces.
 */
export function usePlaceSearch(query: string) {
  const q = query.trim();
  return useQuery<PlaceSuggestionsWire>({
    queryKey: queryKeys.stores.places(q.toLowerCase()),
    queryFn: () =>
      apiFetch<PlaceSuggestionsWire>(ENDPOINTS.publicCatalog.placeSearch, {
        query: { q },
      }),
    // Two characters is the server's own floor; below it the answer is empty.
    enabled: q.length >= 2,
    // Place names don't move. Caching hard keeps a typeahead off a free
    // upstream and makes backspacing instant.
    staleTime: 24 * 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
  });
}
