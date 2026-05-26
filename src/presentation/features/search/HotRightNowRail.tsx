/**
 * HotRightNow — themed home rail backed by `/v1/cards/trending`.
 *
 * Previously this called `/v1/cards/search?q=charizard`, which is why the
 * "live HOT right now" rail surfaced 60 Charizard variants regardless of
 * TCG. We now hit the real trending endpoint, which mixes modern chase
 * subtypes (Pokémon ex/VMAX/VSTAR, Scryfall EDHREC ordering, YGO newest)
 * and serves out of a 15-min server-side Redis cache.
 *
 * Pass `tcg` to scope the rail to one TCG ("pokemon" / "magic" / "yugioh")
 * for multi-rail home layouts; omit for a mixed "all" feed.
 */
import React from "react";
import { ScrollView, View } from "react-native";
import { useTrendingCards } from "@/application/queries/catalog/useTrendingCards";
import { CardHorizontalRail } from "@/presentation/cards";
import { Skeleton } from "@/presentation/components/Skeleton";
import { QueryState } from "@/presentation/components/QueryState";
import type { TcgKey } from "@/infrastructure/http";

export function HotRightNowRail({
  tcg = "all",
  limit = 8,
  edgeBleed = 20,
}: {
  tcg?: TcgKey | "all";
  limit?: number;
  /**
   * Horizontal padding of the parent screen container, in dp. The rail
   * uses a matching negative margin so it scrolls edge-to-edge while
   * tiles still start aligned with surrounding section text. Defaults
   * to 20 (the value used by `(tabs)/index.tsx` and `(tabs)/search.tsx`).
   * Pass `0` to opt out when rendering inside an unpadded container.
   */
  edgeBleed?: number;
}) {
  const q = useTrendingCards({ tcg, limit });
  const results = (q.data?.cards ?? []).slice(0, limit);

  return (
    <QueryState
      isLoading={q.isLoading}
      isError={q.isError}
      isEmpty={!q.isLoading && !q.isError && results.length === 0}
      loadingFallback={
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={edgeBleed > 0 ? { marginHorizontal: -edgeBleed } : undefined}
          contentContainerStyle={{
            gap: 12,
            paddingLeft: edgeBleed > 0 ? edgeBleed : 0,
            paddingRight: edgeBleed > 0 ? edgeBleed : 4,
          }}
        >
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ width: 120 }}>
              <Skeleton width={120} height={168} radius={12} />
            </View>
          ))}
        </ScrollView>
      }
      emptyTitle="No live catalog data"
      emptyMessage="Backend is reachable but no results."
      errorMessage="Live catalog unavailable"
      onRetry={() => void q.refetch()}
    >
      <CardHorizontalRail cards={results} tileSize="md" showPrice edgeBleed={edgeBleed} />
    </QueryState>
  );
}
