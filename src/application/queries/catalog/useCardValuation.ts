/**
 * useCardValuation — Loupe Value for one card
 * (`GET /v1/cards/{id}/valuation`, public).
 *
 * Returns an equilibrium fair value plus the three independent signals behind
 * it (sold comps, live listings, catalog price) and a per-grade ladder. The
 * point is transparency: the app already promises "no mock numbers", and a
 * single unexplained figure is indistinguishable from one. Showing what the
 * number was built from is what makes it checkable.
 *
 * Upstream takes ~2s, so this is deliberately lazy: a long `staleTime`, and no
 * screen should block its first paint on it.
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type { CardValuationWire } from "@/infrastructure/http";
import { queryKeys } from "../queryKeys";

export function useCardValuation(id: string | null | undefined) {
  return useQuery<CardValuationWire>({
    queryKey: queryKeys.cards.valuation(id ?? ""),
    queryFn: () => apiFetch<CardValuationWire>(ENDPOINTS.cards.valuation(id as string)),
    enabled: !!id,
    // Fair value moves on daily comp data, not intraday — and the call is
    // slow. Re-fetching it on every revisit would cost seconds for a number
    // that hasn't changed.
    staleTime: 15 * 60 * 1000,
    retry: 1,
  });
}
