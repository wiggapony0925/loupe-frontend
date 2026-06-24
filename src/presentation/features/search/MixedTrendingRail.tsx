/**
 * MixedTrendingRail — a themed home rail backed by the mixed Pokémon · Magic ·
 * Yu-Gi-Oh! trending feed (`useMixedTrending`). This is the mobile counterpart
 * to the web home page's "Trending now" / "Most valuable right now" / "Steals
 * under $5" carousels:
 *
 *   - `sort="trending"`            → "Trending now"
 *   - `sort="value"`              → "Most valuable right now"
 *   - `sort="value"` + `maxPrice` → "Steals under $X"
 *
 * Unlike {@link HotRightNowRail} (single TCG), this interleaves the three
 * games with a value fallback so the rail stays populated even when an
 * upstream trending feed times out.
 */
import React from "react";
import { ScrollView, View } from "react-native";
import { useMixedTrending } from "@/application/queries/catalog/useMixedTrending";
import { CardHorizontalRail } from "@/presentation/cards";
import { Skeleton } from "@/presentation/components/Skeleton";
import { QueryState } from "@/presentation/components/QueryState";

export function MixedTrendingRail({
  sort,
  maxPrice,
  limit = 12,
  edgeBleed = 20,
}: {
  sort: "trending" | "value";
  /** Cap to cards at/under this USD price (powers "Steals under $X"). */
  maxPrice?: number;
  limit?: number;
  /** See {@link HotRightNowRail} — horizontal padding of the parent container. */
  edgeBleed?: number;
}) {
  const q = useMixedTrending(sort, { maxPrice });
  const results = q.cards.slice(0, limit);

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
      onRetry={() => q.refetch()}
    >
      <CardHorizontalRail cards={results} tileSize="md" showPrice edgeBleed={edgeBleed} />
    </QueryState>
  );
}
