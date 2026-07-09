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
  // Prefer the movement feed, fall back to the reliable value feed. Some games
  // (e.g. Pokémon) return an empty `sort=trending` slice, which used to surface
  // as an ugly "No live catalog data" card; the value feed always has cards.
  const trending = useTrendingCards({ tcg, limit, sort: "trending" });
  const value = useTrendingCards({ tcg, limit, sort: "value" });
  const primary = trending.data?.cards ?? [];
  const results = (primary.length > 0 ? primary : (value.data?.cards ?? [])).slice(
    0,
    limit,
  );
  const isLoading =
    trending.isLoading || (primary.length === 0 && value.isLoading);

  if (isLoading) {
    return (
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
    );
  }

  // Self-hide a genuinely empty rail (matches the web marketplace) rather than
  // showing an empty-state card.
  if (results.length === 0) return null;

  return (
    <CardHorizontalRail cards={results} tileSize="md" showPrice edgeBleed={edgeBleed} />
  );
}
