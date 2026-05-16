/**
 * HotRightNow — live home rail backed by `/v1/cards/search`.
 *
 * Pulls a quick mixed-provider sample for the seeded query "charizard"
 * (which exercises all three connected upstreams: Pokémon TCG, Scryfall,
 * YGOProDeck) and shows the top three as horizontally-scrollable
 * cards. Tapping a card routes to `/card/[id]`.
 */
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useCardSearch } from "@/hooks/api/useCardSearch";
import { CardImage } from "@/components/ui/CardImage";
import { Price } from "@/components/ui/Price";
import { Skeleton } from "@/components/ui/Skeleton";
import { QueryState } from "@/components/ui/QueryState";
import { pickCardBlurhash, pickCardImageUrl } from "@/lib/cardImage";
import { useThemedPalette, withAlpha } from "@/theme/tokens";

export function HotRightNowRail({ query = "charizard" }: { query?: string }) {
  const p = useThemedPalette();
  const q = useCardSearch({ q: query, tcg: "all", limit: 6 });
  const results = (q.data?.results ?? []).slice(0, 6);

  return (
    <QueryState
      isLoading={q.isLoading}
      isError={q.isError}
      isEmpty={!q.isLoading && !q.isError && results.length === 0}
      loadingFallback={
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, paddingRight: 4 }}
        >
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} width={120} height={180} radius={14} />
          ))}
        </ScrollView>
      }
      emptyTitle="No live catalog data"
      emptyMessage="Backend is reachable but no results."
      errorMessage="Live catalog unavailable"
      onRetry={() => void q.refetch()}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingRight: 4 }}
      >
        {results.map((card, idx) => {
          const small = pickCardImageUrl(card, "small");
          const normal = pickCardImageUrl(card, "normal");
          const market = card.pricing_summary?.market?.amount ?? null;
          return (
            <Pressable
              key={card.id}
              onPress={() =>
                router.push(`/card/${encodeURIComponent(card.id)}`)
              }
              style={({ pressed }) => ({
                opacity: pressed ? 0.7 : 1,
                width: 130,
              })}
              className="overflow-hidden rounded-2xl border border-line bg-bg-elevated"
            >
              <CardImage
                uri={normal ?? small}
                fallbackUri={small && normal && small !== normal ? small : undefined}
                blurhash={pickCardBlurhash(card)}
                width="100%"
                height={170}
                rounded={0}
                priority={idx < 3 ? "normal" : "low"}
                recyclingKey={card.id}
                alt={card.name}
              />
              <View className="p-2.5">
                <Text
                  numberOfLines={1}
                  className="text-[11px] font-semibold text-ink"
                >
                  {card.name}
                </Text>
                <View className="mt-1 flex-row items-center justify-between">
                  <View
                    style={{
                      paddingHorizontal: 5,
                      paddingVertical: 1,
                      borderRadius: 999,
                      backgroundColor: withAlpha(p.accent.mint, 0.14),
                    }}
                  >
                    <Text
                      style={{
                        color: p.accent.mint,
                        fontSize: 8,
                        fontWeight: "800",
                        letterSpacing: 0.8,
                      }}
                    >
                      {card.tcg.toUpperCase()}
                    </Text>
                  </View>
                  {market !== null ? (
                    <Price
                      usd={market}
                      className="text-[11px] font-semibold text-ink"
                    />
                  ) : (
                    <Text className="text-[10px] text-ink-muted">—</Text>
                  )}
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </QueryState>
  );
}
