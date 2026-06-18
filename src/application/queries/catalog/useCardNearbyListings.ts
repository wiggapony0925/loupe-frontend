/**
 * useCardNearbyListings — Facebook Marketplace listings near the user for a
 * card (`GET /v1/cards/{id}/nearby-listings`). Scraping happens server-side
 * via Apify; the client only forwards the device coordinates.
 *
 * The query stays disabled until we have both a card id AND coordinates, so
 * we never call the endpoint before the user has granted location access.
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type { NearbyListingsResponseWire } from "@/infrastructure/http";
import { queryKeys } from "../queryKeys";

export interface UseCardNearbyListingsOptions {
  lat: number | null | undefined;
  lng: number | null | undefined;
  radiusKm?: number;
  limit?: number;
}

export function useCardNearbyListings(
  id: string | null | undefined,
  opts: UseCardNearbyListingsOptions,
) {
  const { lat, lng } = opts;
  const radiusKm = opts.radiusKm ?? 40;
  const limit = opts.limit ?? 20;
  const enabled = !!id && lat != null && lng != null;

  return useQuery<NearbyListingsResponseWire>({
    queryKey: queryKeys.cards.nearbyListings(
      id ?? "",
      lat ?? 0,
      lng ?? 0,
      radiusKm,
      limit,
    ),
    queryFn: () => {
      const qs = new URLSearchParams({
        lat: String(lat),
        lng: String(lng),
        radius_km: String(radiusKm),
        limit: String(limit),
      });
      return apiFetch<NearbyListingsResponseWire>(
        `${ENDPOINTS.cards.nearbyListings(id as string)}?${qs.toString()}`,
        { skipAuth: true },
      );
    },
    enabled,
    staleTime: 5 * 60_000, // matches backend cache TTL (FB listings churn).
  });
}
