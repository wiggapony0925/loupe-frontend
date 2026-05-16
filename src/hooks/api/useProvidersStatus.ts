/**
 * useProvidersStatus — capability/configuration matrix for upstream
 * data providers (eBay, PSA, TCGplayer, PriceCharting, 130point, GoCollect).
 * Used to power the "Data Sources" footer on the card detail page.
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";
import type { ProvidersStatusResponseWire } from "@/api/types";
import { queryKeys } from "./queryKeys";

export function useProvidersStatus() {
  return useQuery<ProvidersStatusResponseWire>({
    queryKey: queryKeys.system.providersStatus(),
    queryFn: () =>
      apiFetch<ProvidersStatusResponseWire>(ENDPOINTS.providers.status, {
        skipAuth: true,
      }),
    staleTime: 60 * 60_000,
  });
}
