/**
 * useCardSparklines — fetch every owned-card's 14-point trend in a
 * single request (`/v1/grades/sparklines`).
 *
 * Each entry's `cardId` is the **GradedCard.id**, not the catalog card
 * id, so vault rows can map directly without a second join. Cards with
 * no upstream price history get a flat line at their current estimate
 * (the backend never fabricates motion).
 */
import { useMemo } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type { CardSparklineWire } from "@/infrastructure/http";
import type { CardSparklineSeries } from "@/domain/charts";
import { queryKeys } from "./queryKeys";

export interface UseCardSparklinesOptions {
  /** Disable the query (e.g. while the user is signed out). */
  enabled?: boolean;
}

export interface UseCardSparklinesResult {
  query: UseQueryResult<CardSparklineSeries[]>;
  /** O(1) lookup by GradedCard.id. */
  byCardId: Map<string, CardSparklineSeries>;
}

export function useCardSparklines(
  options: UseCardSparklinesOptions = {},
): UseCardSparklinesResult {
  const { enabled = true } = options;
  const query = useQuery({
    queryKey: queryKeys.portfolio.sparklines(),
    queryFn: async () => {
      const wire = await apiFetch<CardSparklineWire[]>(
        `${ENDPOINTS.me.grades}/sparklines`,
      );
      return wire.map((w) => ({
        cardId: w.cardId,
        points: w.points,
        deltaPct: w.deltaPct,
      }));
    },
    enabled,
    staleTime: 60_000,
  });

  const byCardId = useMemo(() => {
    const m = new Map<string, CardSparklineSeries>();
    for (const s of query.data ?? []) m.set(s.cardId, s);
    return m;
  }, [query.data]);

  return { query, byCardId };
}
