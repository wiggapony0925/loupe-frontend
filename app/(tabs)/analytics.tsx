/**
 * Analytics — server-driven data-viz home for the collection.
 *
 * Single round-trip to `GET /v1/analytics/overview` produces every
 * widget on the screen: stats grid, set indexes, gainers/losers,
 * concentration card, decade distribution, grade distribution.
 *
 * Layout: PriceCharting × Robinhood.
 */
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { routes } from "@/shared/routes";
import { useAnalyticsOverview } from "@/application/queries";
import { GradeBars, PortfolioChart } from "@/presentation/features/analytics";
import { LiveAnalyticsCard } from "@/presentation/features/analytics/LiveAnalyticsCard";
import {
  ConcentrationCard,
  SetIndexes,
  StatsGrid,
  YearDistribution,
} from "@/presentation/features/analytics/MarketSegments";
import { CardImage } from "@/presentation/components/CardImage";
import { SectionHeader } from "@/presentation/components/SectionHeader";
import { Skeleton } from "@/presentation/components/Skeleton";
import { ErrorState } from "@/presentation/components/ErrorState";
import { ReportsSection } from "@/presentation/features/reports";
import { COPY } from "@/shared/copy";
import { normalizeError } from "@/shared/errors";
import { compactUsd } from "@/shared/format";
import { useThemedPalette } from "@/presentation/theme/tokens";
import type { AnalyticsMoverRow } from "@/infrastructure/repositories/analyticsRepository";

export default function AnalyticsScreen() {
  useThemedPalette();
  const q = useAnalyticsOverview();
  const data = q.data;
  const loading = q.isLoading;
  const erroredNormalized = q.isError ? normalizeError(q.error) : null;

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

        {erroredNormalized ? (
          <ErrorState
            title={COPY.analyticsError.title}
            message={erroredNormalized.message}
            code={erroredNormalized.code}
            onRetry={() => {
              void q.refetch();
            }}
            compact
          />
        ) : null}

        <PortfolioChart
          fallbackTotal={data?.stats.totalValueUsd ?? 0}
          bleedX={20}
        />

        <View>
          <SectionHeader eyebrow="Snapshot" title="Book stats" />
          {loading || !data ? <SkeletonGrid /> : <StatsGrid stats={data.stats} />}
        </View>

        <View>
          <SectionHeader eyebrow="Markets" title="Set indexes" />
          {loading || !data ? (
            <SkeletonBlock height={220} />
          ) : (
            <SetIndexes indexes={data.setIndexes} />
          )}
        </View>

        <View>
          <SectionHeader eyebrow="Movers" title="Top gainers" />
          {loading || !data ? (
            <SkeletonBlock height={150} />
          ) : (
            <MoverList rows={data.movers.gainers} emptyHint="No gainers yet" />
          )}
        </View>

        <View>
          <SectionHeader eyebrow="Movers" title="Top losers" />
          {loading || !data ? (
            <SkeletonBlock height={150} />
          ) : (
            <MoverList rows={data.movers.losers} emptyHint="No losers yet" />
          )}
        </View>

        <View>
          <SectionHeader eyebrow="Risk" title="Concentration" />
          {loading || !data ? (
            <SkeletonBlock height={140} />
          ) : (
            <ConcentrationCard concentration={data.concentration} />
          )}
        </View>

        <View>
          <SectionHeader eyebrow="Vintage" title="By decade" />
          {loading || !data ? (
            <SkeletonBlock height={150} />
          ) : (
            <YearDistribution buckets={data.yearDistribution} />
          )}
        </View>

        <View>
          <SectionHeader eyebrow="Mix" title="Quality breakdown" />
          {loading || !data ? (
            <SkeletonBlock height={140} />
          ) : (
            <GradeBars buckets={data.gradeDistribution} />
          )}
        </View>

        <ReportsSection />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── Mover row (lightweight; matches the server payload shape) ──── */

function MoverList({ rows, emptyHint }: { rows: AnalyticsMoverRow[]; emptyHint: string }) {
  if (rows.length === 0) {
    return (
      <View className="rounded-2xl border border-line bg-bg-elevated px-4 py-6">
        <Text className="text-center text-[12px] text-ink-muted">{emptyHint}</Text>
      </View>
    );
  }
  return (
    <View className="overflow-hidden rounded-2xl border border-line bg-bg-elevated px-3">
      {rows.map((row, i) => (
        <View key={row.gradeId} className={i > 0 ? "border-t border-line" : ""}>
          <MoverRow row={row} />
        </View>
      ))}
    </View>
  );
}

function MoverRow({ row }: { row: AnalyticsMoverRow }) {
  const p = useThemedPalette();
  const up = row.changePct1y >= 0;
  const tint = up ? p.accent.mint : p.accent.rose;
  const onPress = () => {
    if (row.cardId) router.push(routes.card(row.cardId));
  };
  return (
    <Pressable
      onPress={onPress}
      disabled={!row.cardId}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      className="flex-row items-center gap-3 px-1 py-3"
    >
      <View
        className="overflow-hidden rounded-lg"
        style={{ width: 36, height: 50, backgroundColor: p.bg.elevated }}
      >
        <CardImage
          uri={row.cardImageUrl}
          width={36}
          height={50}
          rounded={8}
          priority="low"
          recyclingKey={row.gradeId}
          alt={row.cardName ?? "Card"}
        />
      </View>
      <View className="flex-1">
        <Text numberOfLines={1} className="text-[15px] font-semibold text-ink">
          {row.cardName ?? "Unknown card"}
        </Text>
        <Text numberOfLines={1} className="text-[11px] text-ink-dim">
          {row.setName ?? "—"}
        </Text>
      </View>
      <View className="items-end" style={{ minWidth: 78 }}>
        <Text className="text-[15px] font-semibold tracking-tight text-ink">
          {compactUsd(row.valueUsd)}
        </Text>
        <Text className="text-[11px] font-semibold" style={{ color: tint }}>
          {up ? "+" : ""}
          {row.changePct1y.toFixed(2)}%
        </Text>
      </View>
    </Pressable>
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
