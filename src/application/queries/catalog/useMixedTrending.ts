/**
 * useMixedTrending — a reliably *mixed* trending feed for the home rails,
 * mirroring the web client's `useMixedTrending`.
 *
 * Round-robins Pokémon · Magic · Yu-Gi-Oh! so a rail never collapses to a
 * single game. The `tcg=all` feed (and even per-game `sort=trending`)
 * collapses when an upstream times out — Pokémon/Yu-Gi-Oh trending often
 * return nothing while Magic's does. Each game's `sort=value` feed *is*
 * reliable, so we use it as a per-game fallback: prefer the requested sort,
 * fall back to value, then interleave. All six queries are cached + deduped
 * by TanStack (and collapse to three when `sort` is already `"value"`), so
 * sharing this across multiple rails costs nothing extra.
 */
import { useMemo } from "react";
import type { CardSearchResult } from "@/infrastructure/http";
import { useTrendingCards } from "./useTrendingCards";

export function useMixedTrending(
  sort: "trending" | "value",
  opts: { perTcg?: number; maxPrice?: number } = {},
) {
  const perTcg = opts.perTcg ?? 8;
  const maxPrice = opts.maxPrice;

  const pkT = useTrendingCards({ tcg: "pokemon", sort, limit: perTcg, maxPrice });
  const mgT = useTrendingCards({ tcg: "magic", sort, limit: perTcg, maxPrice });
  const ygT = useTrendingCards({ tcg: "yugioh", sort, limit: perTcg, maxPrice });
  // Reliable fallback (deduped to the same query when sort is already "value").
  const pkV = useTrendingCards({ tcg: "pokemon", sort: "value", limit: perTcg, maxPrice });
  const mgV = useTrendingCards({ tcg: "magic", sort: "value", limit: perTcg, maxPrice });
  const ygV = useTrendingCards({ tcg: "yugioh", sort: "value", limit: perTcg, maxPrice });

  const cards = useMemo<CardSearchResult[]>(() => {
    const pick = (primary?: CardSearchResult[], fallback?: CardSearchResult[]) =>
      primary && primary.length > 0 ? primary : (fallback ?? []);
    const lists = [
      pick(pkT.data?.cards, pkV.data?.cards),
      pick(mgT.data?.cards, mgV.data?.cards),
      pick(ygT.data?.cards, ygV.data?.cards),
    ];
    const out: CardSearchResult[] = [];
    const seen = new Set<string>();
    const max = Math.max(0, ...lists.map((l) => l.length));
    for (let i = 0; i < max; i++) {
      for (const list of lists) {
        const card = list[i];
        if (card && !seen.has(card.id)) {
          seen.add(card.id);
          out.push(card);
        }
      }
    }
    return out;
  }, [pkT.data, mgT.data, ygT.data, pkV.data, mgV.data, ygV.data]);

  return {
    cards,
    isLoading:
      cards.length === 0 &&
      (pkV.isLoading || mgV.isLoading || ygV.isLoading || pkT.isLoading),
    isError: pkV.isError && mgV.isError && ygV.isError,
    refetch: () => {
      void pkT.refetch();
      void mgT.refetch();
      void ygT.refetch();
      void pkV.refetch();
      void mgV.refetch();
      void ygV.refetch();
    },
  };
}
