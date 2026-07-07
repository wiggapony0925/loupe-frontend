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
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LineChart } from "lucide-react-native";
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
import { DonutChart, type DonutDatum } from "@/presentation/components/DonutChart";
import { SectionHeader } from "@/presentation/components/SectionHeader";
import { Skeleton } from "@/presentation/components/Skeleton";
import { ErrorState } from "@/presentation/components/ErrorState";
import { EmptyState } from "@/presentation/components/EmptyState";
import { ReportsSection } from "@/presentation/features/reports";
import { COPY } from "@/shared/copy";
import { normalizeError } from "@/shared/errors";
import { Price, useMoney } from "@/presentation/components/Price";
import { useThemedPalette } from "@/presentation/theme/tokens";
import type {
  AnalyticsKpis,
  AnalyticsMoverRow,
} from "@/infrastructure/repositories/analyticsRepository";

export default function AnalyticsScreen() {
  useThemedPalette();
  // The one reusable currency hook — every $ figure on this page renders in
  // the user's chosen display currency and live-updates when they switch.
  const { format } = useMoney();
  const q = useAnalyticsOverview();
  const data = q.data;
  const loading = q.isLoading;
  const erroredNormalized = q.isError ? normalizeError(q.error) : null;
  // A loaded-but-empty collection used to render the whole widget stack as a
  // wall of "—"/"No … yet" placeholders. Detect zero holdings and show one
  // clean empty state with a path to add a card instead.
  const isEmptyCollection =
    !loading && !erroredNormalized && !!data && data.stats.holdings === 0;

  // Value-by-set allocation — same derivation as the web Analytics donut.
  const allocation: DonutDatum[] = (data?.setIndexes ?? [])
    .filter((s) => s.totalValueUsd > 0)
    .map((s) => ({ label: s.setName, value: s.totalValueUsd }));

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-bg">
      <ScrollView
        // Clear the floating iOS tab-bar pill (see Command screen note).
        contentContainerStyle={{
          padding: 20,
          paddingBottom: Platform.OS === "ios" ? 116 : 64,
          gap: 28,
        }}
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

        {isEmptyCollection ? (
          <EmptyState
            icon={LineChart}
            title="No analytics yet"
            message="Add your first card and Loupe will chart your portfolio value, movers, allocation, and grade mix right here."
            secondaryActionLabel="Scan a card"
            onSecondaryAction={() => router.push(routes.scanEntry())}
          />
        ) : (
          <>
        <PortfolioChart
          fallbackTotal={data?.stats.totalValueUsd ?? 0}
          bleedX={20}
          showPsa10Overlay
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
          <SectionHeader eyebrow="Allocation" title="Value by set" />
          {loading || !data ? (
            <SkeletonBlock height={180} />
          ) : allocation.length === 0 ? (
            <Text className="text-[13px] text-ink-dim">
              Add cards to see how your value is allocated.
            </Text>
          ) : (
            <View className="rounded-2xl border border-line bg-bg-elevated p-4">
              <DonutChart
                data={allocation}
                centerValue={format(data.stats.totalValueUsd)}
                centerLabel="total"
                format={(n) => format(n)}
              />
            </View>
          )}
        </View>

        {/* One Movers section (Robinhood-style), not two stacked headers —
            gainers and losers read as a single story about the past year. */}
        <View>
          <SectionHeader eyebrow="Movers · past year" title="Top movers" />
          {loading || !data ? (
            <SkeletonBlock height={300} />
          ) : (
            <View style={{ gap: 14 }}>
              <MoverGroup
                label="Gainers"
                rows={data.movers.gainers}
                emptyHint="No gainers yet"
              />
              <MoverGroup
                label="Losers"
                rows={data.movers.losers}
                emptyHint="No losers yet"
              />
            </View>
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

        <View>
          <SectionHeader eyebrow="Activity" title="Scanning" />
          {loading || !data ? (
            <SkeletonBlock height={120} />
          ) : (
            <ScanningKpis kpis={data.kpis} />
          )}
        </View>

        <ReportsSection />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── Mover row (lightweight; matches the server payload shape) ──── */

function MoverGroup({
  label,
  rows,
  emptyHint,
}: {
  label: string;
  rows: AnalyticsMoverRow[];
  emptyHint: string;
}) {
  return (
    <View>
      <Text className="mb-1.5 text-[10px] font-semibold uppercase tracking-[2px] text-ink-dim">
        {label}
      </Text>
      <MoverList rows={rows} emptyHint={emptyHint} />
    </View>
  );
}

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
        <Price
          usd={row.valueUsd}
          className="text-[15px] font-semibold tracking-tight text-ink"
        />
        <Text className="text-[11px] font-semibold" style={{ color: tint }}>
          {up ? "+" : ""}
          {row.changePct1y.toFixed(2)}%
        </Text>
      </View>
    </Pressable>
  );
}

/** Scanning activity KPIs — total scans, scan avg grade, gem rate, and the
 *  grading-house split (web Analytics "Scanning" section parity). */
function ScanningKpis({ kpis }: { kpis: AnalyticsKpis }) {
  return (
    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
      <KpiCell label="Total scans" value={kpis.totalScans.toLocaleString()} />
      <KpiCell
        label="Scan avg grade"
        value={kpis.avgGrade ? kpis.avgGrade.toFixed(1) : "—"}
      />
      <KpiCell label="Scan gem rate" value={`${kpis.gemRatePct.toFixed(0)}%`} />
      <KpiCell
        label="Graders"
        value={`PSA ${kpis.graderSplit.psa} · BGS ${kpis.graderSplit.bgs} · CGC ${kpis.graderSplit.cgc}`}
        wide
      />
    </View>
  );
}

function KpiCell({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <View
      className="rounded-xl border border-line bg-bg-elevated px-3 py-2.5"
      style={{ flexBasis: wide ? "100%" : "31%", flexGrow: 1 }}
    >
      <Text className="text-[9px] font-semibold uppercase tracking-[2px] text-ink-dim">
        {label}
      </Text>
      <Text numberOfLines={1} className="mt-1 text-base font-bold text-ink">
        {value}
      </Text>
    </View>
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
