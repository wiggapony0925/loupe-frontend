/**
 * HotRightNow — live home rail backed by `/v1/cards/search`.
 *
 * Pulls a quick mixed-provider sample for a seeded query and surfaces it
 * via the reusable `CardHorizontalRail` primitive. Loading/empty/error
 * are funneled through `QueryState` so it composes well in any feed.
 */
import React from "react";
import { ScrollView, View } from "react-native";
import { useCardSearch } from "@/hooks/api/useCardSearch";
import { CardHorizontalRail } from "@/components/cards";
import { Skeleton } from "@/components/ui/Skeleton";
import { QueryState } from "@/components/ui/QueryState";

export function HotRightNowRail({ query = "charizard" }: { query?: string }) {
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
      <CardHorizontalRail cards={results} tileSize="md" showPrice />
    </QueryState>
  );
}
