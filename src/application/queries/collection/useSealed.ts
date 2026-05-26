/**
 * Sealed-product catalog + holdings hooks.
 *
 * - `useSealedSearch` powers the "add sealed" picker — debounced
 *   text + optional product-type filter, hits `/v1/sealed/search`.
 * - `useMySealedHoldings` powers the "My Sealed" vault screen.
 * - The mutation hooks invalidate the holdings list on success so the
 *   vault refreshes without manual cache surgery (mirrors the price-
 *   alert hook pattern).
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type {
  SealedHoldingCreateWire,
  SealedHoldingUpdateWire,
  SealedHoldingWire,
  SealedProductType,
  SealedProductWire,
} from "@/infrastructure/http";

import { queryKeys } from "../queryKeys";

export function useSealedSearch(
  q: string,
  opts: { productType?: SealedProductType | null } = {},
) {
  const productType = opts.productType ?? null;
  const trimmed = q.trim();
  return useQuery<SealedProductWire[]>({
    queryKey: queryKeys.sealed.search(trimmed, productType),
    queryFn: () =>
      apiFetch<SealedProductWire[]>(ENDPOINTS.sealed.search, {
        query: {
          ...(trimmed ? { q: trimmed } : {}),
          ...(productType ? { product_type: productType } : {}),
          limit: 50,
        },
      }),
    // Catalog rarely changes — keep results around for the session.
    staleTime: 5 * 60_000,
  });
}

export function useMySealedHoldings(opts: { includeOpened?: boolean } = {}) {
  const includeOpened = opts.includeOpened ?? true;
  return useQuery<SealedHoldingWire[]>({
    queryKey: queryKeys.sealedHoldings.list(includeOpened),
    queryFn: () =>
      apiFetch<SealedHoldingWire[]>(ENDPOINTS.sealedHoldings.mine, {
        query: { include_opened: includeOpened },
      }),
    staleTime: 30_000,
  });
}

export function useCreateSealedHolding() {
  const qc = useQueryClient();
  return useMutation<SealedHoldingWire, Error, SealedHoldingCreateWire>({
    mutationFn: (payload) =>
      apiFetch<SealedHoldingWire>(ENDPOINTS.sealedHoldings.create, {
        method: "POST",
        json: payload,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sealedHoldings.all });
    },
  });
}

export function useUpdateSealedHolding() {
  const qc = useQueryClient();
  return useMutation<
    SealedHoldingWire,
    Error,
    { id: string; patch: SealedHoldingUpdateWire }
  >({
    mutationFn: ({ id, patch }) =>
      apiFetch<SealedHoldingWire>(ENDPOINTS.sealedHoldings.item(id), {
        method: "PATCH",
        json: patch,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sealedHoldings.all });
    },
  });
}

export function useDeleteSealedHolding() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (holdingId) => {
      await apiFetch<void>(ENDPOINTS.sealedHoldings.item(holdingId), {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sealedHoldings.all });
    },
  });
}
