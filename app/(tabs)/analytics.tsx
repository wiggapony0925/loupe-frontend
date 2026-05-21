/**
 * Analytics — the data-viz home for the collection.
 *
 * PriceCharting × Robinhood layout:
 *   • Hero portfolio chart with interactive scrubber + range pills
 *   • 6-up stats grid (holdings, sets, avg grade, gem rate, avg value, vintage)
 *   • Set indexes (per-set aggregate value + sparkline + share-of-book)
 *   • Top gainers / Top losers split
 *   • Concentration card (top-1/3/5 share of portfolio)
 *   • Decade distribution histogram
 *   • Grade distribution bars
 */
import React from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/application/queries/queryKeys";
import { fetchCardSparklines, fetchCollection } from "@/infrastructure/repositories/forensicRepository";
import { GradeBars, HoldingRow, PortfolioChart } from "@/presentation/features/analytics";
import { LiveAnalyticsCard } from "@/presentation/features/analytics/LiveAnalyticsCard";
import {
  ConcentrationCard,
  SetIndexes,
  StatsGrid,
  YearDistribution,
} from "@/presentation/features/analytics/MarketSegments";
import { SectionHeader } from "@/presentation/components/SectionHeader";
import { Skeleton } from "@/presentation/components/Skeleton";
import { ErrorState } from "@/presentation/components/ErrorState";
import { ReportsSection } from "@/presentation/features/reports";
import { COPY } from "@/shared/copy";
import { normalizeError } from "@/shared/errors";
import { useThemedPalette } from "@/presentation/theme/tokens";

export default function AnalyticsScreen() {
  useThemedPalette();
  const collection = useQuery({ queryKey: queryKeys.collection.list(), queryFn: fetchCollection });
  const sparks = useQuery({
    queryKey: ["card-sparklines"],
    queryFn: fetchCardSparklines,
    staleTime: 60_000,
  });

  const cards = collection.data ?? [];
  const sparkMap = new Map((sparks.data ?? []).map((s) => [s.cardId, s]));
  const totalValue = cards.reduce((s, c) => s + c.estimatedValueUsd, 0);

  const enriched = cards
    .map((c) => ({ card: c, sp: sparkMap.get(c.id) }))
    .filter((x): x is { card: typeof x.card; sp: NonNullable<typeof x.sp> } => !!x.sp);

  const gainers = [...enriched].sort((a, b) => b.sp.deltaPct - a.sp.deltaPct).slice(0, 3);
  const losers = [...enriched].sort((a, b) => a.sp.deltaPct - b.sp.deltaPct).slice(0, 3);

  const loading = collection.isLoading || sparks.isLoading;
  const errored = collection.isError || sparks.isError;
  const erroredNormalized = collection.isError
    ? normalizeError(collection.error)
    : sparks.isError
      ? normalizeError(sparks.error)
      : null;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-bg">
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 64, gap: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
            Performance
          </Text>
          <Text className="mt-1 text-3xl font-semibold tracking-tight text-ink">
            Analytics
          </Text>
        </View>

        <LiveAnalyticsCard />

        {errored && erroredNormalized ? (
          <ErrorState
            title={COPY.analyticsError.title}
            message={erroredNormalized.message}
            code={erroredNormalized.code}
            onRetry={() => {
              void collection.refetch();
              void sparks.refetch();
            }}
            compact
          />
        ) : null}

        <PortfolioChart fallbackTotal={totalValue} />

        <View>
          <SectionHeader eyebrow="Snapshot" title="Book stats" />
          {loading ? <SkeletonGrid /> : <StatsGrid cards={cards} />}
        </View>

        <View>
          <SectionHeader eyebrow="Markets" title="Set indexes" />
          {loading ? (
            <SkeletonBlock height={220} />
          ) : (
            <SetIndexes cards={cards} sparkMap={sparkMap} />
          )}
        </View>

        <View>
          <SectionHeader eyebrow="Movers" title="Top gainers" />
          {loading ? (
            <SkeletonBlock height={150} />
          ) : (
            <View className="overflow-hidden rounded-2xl border border-line bg-bg-elevated px-3">
              {gainers.map(({ card, sp }, i) => (
                <View key={card.id} className={i > 0 ? "border-t border-line" : ""}>
                  <HoldingRow card={card} spark={sp.points} deltaPct={sp.deltaPct} />
                </View>
              ))}
            </View>
          )}
        </View>

        <View>
          <SectionHeader eyebrow="Movers" title="Top losers" />
          {loading ? (
            <SkeletonBlock height={150} />
          ) : (
            <View className="overflow-hidden rounded-2xl border border-line bg-bg-elevated px-3">
              {losers.map(({ card, sp }, i) => (
                <View key={card.id} className={i > 0 ? "border-t border-line" : ""}>
                  <HoldingRow card={card} spark={sp.points} deltaPct={sp.deltaPct} />
                </View>
              ))}
            </View>
          )}
        </View>

        <View>
          <SectionHeader eyebrow="Risk" title="Concentration" />
          {loading ? <SkeletonBlock height={140} /> : <ConcentrationCard cards={cards} />}
        </View>

        <View>
          <SectionHeader eyebrow="Vintage" title="By decade" />
          {loading ? <SkeletonBlock height={150} /> : <YearDistribution cards={cards} />}
        </View>

        <View>
          <SectionHeader eyebrow="Mix" title="Quality breakdown" />
          {loading ? <SkeletonBlock height={140} /> : <GradeBars cards={cards} />}
        </View>

        <ReportsSection />
      </ScrollView>
    </SafeAreaView>
  );
}

function SkeletonGrid() {
  return (
    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View
          key={i}
          className="rounded-xl border border-line bg-bg-elevated px-3 py-2.5"
          style={{ flexBasis: "31%", flexGrow: 1 }}
        >
          <Skeleton width={48} height={8} />
          <View className="h-2" />
          <Skeleton width={64} height={16} />
        </View>
      ))}
    </View>
  );
}

function SkeletonBlock({ height }: { height: number }) {
  return (
    <View className="rounded-2xl border border-line bg-bg-elevated p-4">
      <Skeleton width="100%" height={height - 32} />
    </View>
  );
}
