/**
 * Price-alert query + mutation hooks.
 *
 * The list query is keyed by `pending` so the "active alerts only" tab
 * and the "all alerts" tab cache independently. `useCreatePriceAlert` /
 * `useDeletePriceAlert` invalidate both keys via the `alerts` prefix on
 * success so the UI stays consistent without manual cache surgery.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type {
  PriceAlertCreateWire,
  PriceAlertWire,
} from "@/infrastructure/http";
import { queryKeys } from "../queryKeys";

export function usePriceAlerts(opts: { pending?: boolean } = {}) {
  const pending = opts.pending ?? false;
  return useQuery<PriceAlertWire[]>({
    queryKey: queryKeys.alerts.list(pending),
    queryFn: () =>
      apiFetch<PriceAlertWire[]>(ENDPOINTS.alerts.list, {
        query: pending ? { pending: true } : undefined,
      }),
    staleTime: 30_000,
  });
}

export function useCreatePriceAlert() {
  const qc = useQueryClient();
  return useMutation<PriceAlertWire, Error, PriceAlertCreateWire>({
    mutationFn: (payload) =>
      apiFetch<PriceAlertWire>(ENDPOINTS.alerts.create, {
        method: "POST",
        json: payload,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.alerts.all });
    },
  });
}

export function useDeletePriceAlert() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (alertId) => {
      await apiFetch<void>(ENDPOINTS.alerts.item(alertId), {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.alerts.all });
    },
  });
}
