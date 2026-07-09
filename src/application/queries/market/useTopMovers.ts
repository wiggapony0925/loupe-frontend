/**
 * useTopMovers — server-rendered Top Movers for the signed-in operator.
 *
 * Thin adapter over `useHomeFeed` (powered by `GET /v1/home/feed`) that
 * shapes the response into the `TopMoverRow` interface consumed by the
 * Command Center's `MoverSparkRow`.
 *
 * Previous implementation fanned out N parallel `/cards/{id}` +
 * `/cards/{id}/market` requests and sorted on the client. The backend
 * now does the deduplication, 1-year change-% computation (from real
 * `price_history`), and ranking — so all that's left here is mapping
 * the wire payload onto the `CardWire` shape the movers row expects.
 */
import { useMemo } from "react";
import type { CardWire, TrendInfo } from "@/presentation/cards";
import type { TcgKey } from "@/infrastructure/http";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { useHomeFeed } from "../analytics/useHomeFeed";

export interface TopMoverRow {
  /** GradedCard.id — keys `/v1/grades/sparklines` for the row's real sparkline. */
  gradeId: string;
  card: CardWire;
  /** Estimated USD price (`graded.estimated_value_usd`). */
  price: number | null;
  /** Trailing 1-year change. `null` when the backend lacked history. */
  trend: TrendInfo | null;
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
  /** Number of movers the backend should return. Defaults to 5. */
  limit?: number;
  /** Legacy option, ignored — the backend bounds enrichment itself. */
  enrichLimit?: number;
  /** Scope the movers to the active collection (omit for the whole vault). */
  collectionId?: string | null;
}

export function useTopMovers({
  limit = 5,
  collectionId = null,
}: UseTopMoversOptions = {}): UseTopMoversResult {
  const { isAuthenticated } = useAuth();
  const feed = useHomeFeed({ topMovers: limit, collectionId });

  const rows = useMemo<TopMoverRow[]>(() => {
    const movers = feed.data?.topMovers ?? [];
    const out: TopMoverRow[] = [];
    for (const m of movers) {
      // Skip rows where the backend couldn't even resolve the card
      // identity — the UI has nothing to render without an id/name.
      if (!m.cardId || !m.cardName) continue;
      const card: CardWire = {
        id: m.cardId,
        name: m.cardName,
        // Default to pokemon when the backend hasn't classified the tcg
        // yet (e.g. legacy rows). The movers row doesn't render the tcg
        // badge so this is purely a type-system requirement.
        tcg: (m.cardTcg ?? "pokemon") as TcgKey,
        set_name: m.cardSetName ?? undefined,
        number: m.cardNumber ?? undefined,
        year: m.cardYear ?? undefined,
        image_url: m.cardImageUrl ?? undefined,
        source: "vault",
      };
      out.push({
        gradeId: m.gradeId,
        card,
        price: m.priceUsd,
        trend: m.changePct1y != null ? { pct: m.changePct1y } : null,
      });
    }
    return out;
  }, [feed.data]);

  return {
    rows,
    isAuthenticated,
    isLoading: feed.isLoading,
    isError: feed.isError,
    isEmpty: feed.isSuccess && (feed.data?.topMovers.length ?? 0) === 0,
    refetch: () => {
      void feed.refetch();
    },
  };
}
