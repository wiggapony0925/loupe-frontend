/**
 * useNearbyStores — card & game shops around a point.
 *
 * Public endpoint (no auth gate — the map works signed-out). The backend
 * owns filtering/ranking/labels and snaps queries to a ~1 km grid with a
 * day-long cache, so refetching as the user pans is cheap; we still round
 * the key client-side so tiny GPS jitter reuses the same query cache row.
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type { NearbyStoresWire } from "@/infrastructure/http";
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
  });
}
