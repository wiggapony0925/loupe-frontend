/**
 * useProvidersStatus — capability/configuration matrix for upstream
 * data providers (eBay, PSA, TCGplayer, PriceCharting, 130point, GoCollect).
 * Used to power the "Data Sources" footer on the card detail page.
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type { ProvidersStatusResponseWire } from "@/infrastructure/http";
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
