/**
 * usePublicSparklines — batch price lookup for catalog card ids in ONE call
 * (`GET /v1/public/sparklines?ids=a,b,c`, public, no auth).
 *
 * Each returned series' LAST point is the card's current market price — which
 * makes this the cheapest way to price a whole scan cart / session at once
 * (the scanner's running "Total"). Ids are sorted into a stable cache key so
 * the same set never refetches; unknown ids simply come back missing.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import { queryKeys } from "../queryKeys";

interface PublicSparklineWire {
  card_id: string;
  points: number[];
  change_pct: number | null;
}

export interface UsePublicSparklinesResult {
  /** Current market price for a catalog id, or null when unknown/unpriced. */
  priceOf: (id: string | null | undefined) => number | null;
  /** Sum of known prices over `ids` (null when none are priced yet). */
  totalUsd: number | null;
  isLoading: boolean;
}

export function usePublicSparklines(ids: string[]): UsePublicSparklinesResult {
  // Stable key: order-independent, deduped.
  const idsKey = useMemo(() => [...new Set(ids)].sort().join(","), [ids]);

  const query = useQuery({
    queryKey: queryKeys.cards.publicSparklines(idsKey),
    queryFn: () =>
      apiFetch<{ sparklines: PublicSparklineWire[] }>(
        ENDPOINTS.publicCatalog.sparklines,
        { query: { ids: idsKey }, skipAuth: true },
      ),
    enabled: idsKey.length > 0,
    staleTime: 120_000,
  });

  return useMemo(() => {
    const byId = new Map<string, number>();
    for (const s of query.data?.sparklines ?? []) {
      const last = s.points.length > 0 ? s.points[s.points.length - 1] : undefined;
      if (last != null && Number.isFinite(last)) byId.set(s.card_id, last);
    }
    const priceOf = (id: string | null | undefined) =>
      id != null ? (byId.get(id) ?? null) : null;
    let total = 0;
    let priced = 0;
    for (const id of idsKey ? idsKey.split(",") : []) {
      const p = byId.get(id);
      if (p != null) {
        total += p;
        priced += 1;
      }
    }
    return {
      priceOf,
      totalUsd: priced > 0 ? total : null,
      isLoading: query.isLoading,
    };
  }, [query.data, query.isLoading, idsKey]);
}
