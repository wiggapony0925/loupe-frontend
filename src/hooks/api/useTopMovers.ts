/**
 * useTopMovers — real top movers for the signed-in operator's vault.
 *
 * Composes `useMyGrades` (user's owned cards) with parallel `useCard` and
 * `useCardMarket` queries to enrich each entry with a name/image and the
 * trailing 1-year market summary, then sorts by `|change_pct_1y|` to
 * surface the biggest movers first.
 *
 * Returns a unified status flag so consumers can show a single
 * loading/error/empty state without juggling N queries themselves.
 */
import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";
import type {
  CardSearchResult,
  GradedCard,
  MarketResponseWire,
} from "@/api/types";
import type { CardWire, TrendInfo } from "@/components/cards";
import { useMyGrades } from "@/hooks/api/useMyGrades";
import { useAuth } from "@/providers/AuthProvider";
import { queryKeys } from "./queryKeys";

export interface TopMoverRow {
  card: CardWire;
  grade: GradedCard;
  price: number;
  trend: TrendInfo;
}

export interface UseTopMoversResult {
  rows: TopMoverRow[];
  isAuthenticated: boolean;
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  refetch: () => void;
}

interface UseTopMoversOptions {
  /** How many cards from /me/grades to enrich + rank. Defaults to 12. */
  enrichLimit?: number;
  /** Final number of movers to surface after sorting. Defaults to 5. */
  limit?: number;
}

export function useTopMovers({
  enrichLimit = 12,
  limit = 5,
}: UseTopMoversOptions = {}): UseTopMoversResult {
  const { isAuthenticated } = useAuth();
  const grades = useMyGrades<GradedCard[]>();
  // Dedupe by card_id BEFORE building useQueries — owning multiple copies
  // of the same card would otherwise register duplicate observers for the
  // same query key, triggering React Query's "Duplicate Queries found"
  // warning on every render (and flooding Metro's log buffer to the
  // point of OOM).
  const enrichmentTargets = useMemo(() => {
    const seen = new Set<string>();
    const out: GradedCard[] = [];
    for (const g of grades.data ?? []) {
      if (!g.card_id || seen.has(g.card_id)) continue;
      seen.add(g.card_id);
      out.push(g);
      if (out.length >= enrichLimit) break;
    }
    return out;
  }, [grades.data, enrichLimit]);

  // Parallel-fetch card metadata + market snapshot for each target.
  const cardQueries = useQueries({
    queries: enrichmentTargets.map((g) => ({
      queryKey: queryKeys.cards.item(g.card_id),
      queryFn: () =>
        apiFetch<CardSearchResult>(ENDPOINTS.cards.item(g.card_id), {
          skipAuth: true,
        }),
      enabled: isAuthenticated && !!g.card_id,
      staleTime: 5 * 60_000,
    })),
  });
  const marketQueries = useQueries({
    queries: enrichmentTargets.map((g) => ({
      queryKey: queryKeys.cards.market(g.card_id),
      queryFn: () =>
        apiFetch<MarketResponseWire>(ENDPOINTS.cards.market(g.card_id), {
          skipAuth: true,
        }),
      enabled: isAuthenticated && !!g.card_id,
      staleTime: 5 * 60_000,
    })),
  });

  const enrichmentLoading =
    enrichmentTargets.length > 0 &&
    (cardQueries.some((q) => q.isLoading) ||
      marketQueries.some((q) => q.isLoading));
  // Per-card enrichment is best-effort: if a single owned card isn't in
  // the catalog (or its market snapshot 404s) we silently drop that row
  // instead of nuking the whole widget. We only surface an error when
  // *every* enrichment failed AND grades returned something to enrich —
  // i.e. the upstream catalog is genuinely down.
  const allEnrichmentsFailed =
    enrichmentTargets.length > 0 &&
    cardQueries.every((q) => q.isError) &&
    marketQueries.every((q) => q.isError);

  const rows = useMemo<TopMoverRow[]>(() => {
    const out: TopMoverRow[] = [];
    enrichmentTargets.forEach((grade, i) => {
      const card = cardQueries[i]?.data;
      const market = marketQueries[i]?.data?.snapshot.summary;
      if (!card || !market) return;
      // Prefer graded average if present; otherwise fall back to raw.
      const priceMoney = market.graded_avg ?? market.raw;
      if (!priceMoney) return;
      out.push({
        card,
        grade,
        price: priceMoney.amount,
        trend: { pct: market.change_pct_1y },
      });
    });
    return out
      .slice()
      .sort((a, b) => Math.abs(b.trend.pct) - Math.abs(a.trend.pct))
      .slice(0, limit);
  }, [enrichmentTargets, cardQueries, marketQueries, limit]);

  const refetch = () => {
    void grades.refetch();
    cardQueries.forEach((q) => void q.refetch());
    marketQueries.forEach((q) => void q.refetch());
  };

  return {
    rows,
    isAuthenticated,
    isLoading: grades.isLoading || enrichmentLoading,
    isError: grades.isError || allEnrichmentsFailed,
    isEmpty:
      isAuthenticated &&
      !grades.isLoading &&
      !grades.isError &&
      (grades.data?.length ?? 0) === 0,
    refetch,
  };
}
