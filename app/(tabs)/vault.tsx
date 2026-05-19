import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { routes } from "@/shared/routes";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Grid2x2, Layers, List as ListIcon } from "lucide-react-native";
import { CardThumbnail } from "@/presentation/features/collection/CardThumbnail";
import { FilterBar } from "@/presentation/features/collection/FilterBar";
import { LiveGradesSection } from "@/presentation/features/collection/LiveGradesSection";
import { PositionRow } from "@/presentation/features/collection/PositionRow";
import { useFilteredCollection } from "@/presentation/features/collection/useFilteredCollection";
import { fetchCardSparklines, type CardSparkline } from "@/infrastructure/repositories/forensicRepository";
import { Skeleton } from "@/presentation/components/Skeleton";
import { SectionHeader } from "@/presentation/components/SectionHeader";
import { EmptyState } from "@/presentation/components/EmptyState";
import { COPY } from "@/shared/copy";
import { compactUsd } from "@/shared/format";
import { queryKeys } from "@/application/queries/queryKeys";
import { palette, useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

type ViewMode = "list" | "grid";

export default function VaultScreen() {
  const p = useThemedPalette();
  const router = useRouter();
  const qc = useQueryClient();
  const { cards, isLoading, isFetching } = useFilteredCollection();
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Pair each holding with its sparkline + delta. Same query Analytics uses,
  // so the React Query cache is shared at no extra cost.
  const sparks = useQuery({
    queryKey: ["card-sparklines"],
    queryFn: fetchCardSparklines,
    staleTime: 60_000,
  });
  const sparkMap = useMemo(
    () => new Map((sparks.data ?? []).map((s: CardSparkline) => [s.cardId, s])),
    [sparks.data],
  );

  // Adaptive column count for grid mode: phones get 2 columns, tablets 3-4.
  const { width: screenWidth } = useWindowDimensions();
  const numColumns =
    viewMode === "list" ? 1 : Math.max(2, Math.min(4, Math.floor(screenWidth / 180)));

  const stats = useMemo(() => {
    const value = cards.reduce((s, c) => s + c.estimatedValueUsd, 0);
    const avgGrade = cards.length > 0 ? cards.reduce((s, c) => s + c.grade, 0) / cards.length : 0;
    // Portfolio delta = value-weighted mean of per-card deltas.
    let weightedDelta = 0;
    let totalWeight = 0;
    for (const c of cards) {
      const sp = sparkMap.get(c.id);
      if (sp && c.estimatedValueUsd > 0) {
        weightedDelta += sp.deltaPct * c.estimatedValueUsd;
        totalWeight += c.estimatedValueUsd;
      }
    }
    const portfolioDelta = totalWeight > 0 ? weightedDelta / totalWeight : 0;
    return { value, avgGrade, count: cards.length, portfolioDelta };
  }, [cards, sparkMap]);

  const onRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: queryKeys.collection.all });
    qc.invalidateQueries({ queryKey: ["card-sparklines"] });
  }, [qc]);

  const headerPadX = viewMode === "grid" ? 0 : 14;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-bg">
      <FlatList
        data={isLoading ? [] : cards}
        keyExtractor={(c) => c.id}
        numColumns={numColumns}
        // Force-remount the list when toggling between layouts so FlatList
        // doesn't blow up about numColumns changing mid-flight.
        key={`${viewMode}-${numColumns}`}
        columnWrapperStyle={viewMode === "grid" ? { gap: 12 } : undefined}
        contentContainerStyle={{
          paddingHorizontal: viewMode === "grid" ? 20 : 6,
          paddingTop: 20,
          paddingBottom: 48,
          gap: viewMode === "grid" ? 12 : 0,
        }}
        ItemSeparatorComponent={
          viewMode === "list"
            ? () => (
                <View
                  style={{
                    height: 1,
                    backgroundColor: p.line.default,
                    // Robinhood-style edge-to-edge hairline, with the row's own
                    // horizontal padding inset (POSITION_ROW_INDENT = 16).
                    marginHorizontal: 16,
                  }}
                />
              )
            : undefined
        }
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={onRefresh}
            tintColor={palette.accent.mint}
          />
        }
        ListHeaderComponent={
          <View className="gap-5 pb-4" style={{ paddingHorizontal: headerPadX }}>
            <SectionHeader eyebrow="Collection" title="The Vault" />
            <LiveGradesSection />
            <PortfolioPills stats={stats} />
            <FilterBar />
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
          </View>
        }
        renderItem={({ item }) =>
          viewMode === "list" ? (
            <PositionRow card={item} spark={sparkMap.get(item.id)} />
          ) : (
            <CardThumbnail card={item} spark={sparkMap.get(item.id)} />
          )
        }
        ListEmptyComponent={
          isLoading ? (
            <View
              className={viewMode === "grid" ? "flex-row gap-3" : "gap-3"}
              style={{ paddingHorizontal: viewMode === "grid" ? 0 : 14 }}
            >
              {viewMode === "grid"
                ? [0, 1].map((i) => (
                    <View
                      key={i}
                      className="flex-1 overflow-hidden rounded-2xl border border-line bg-bg-elevated"
                    >
                      <Skeleton width="100%" height={220} radius={0} />
                      <View className="gap-2 p-3">
                        <Skeleton width={80} height={10} />
                        <Skeleton width="80%" height={14} />
                        <Skeleton width="50%" height={10} />
                      </View>
                    </View>
                  ))
                : [0, 1, 2, 3, 4].map((i) => (
                    <View key={i} className="flex-row items-center gap-3 py-3">
                      <Skeleton width={48} height={66} radius={8} />
                      <View className="flex-1 gap-2">
                        <Skeleton width="60%" height={14} />
                        <Skeleton width="40%" height={10} />
                      </View>
                      <View className="items-end gap-2">
                        <Skeleton width={56} height={14} />
                        <Skeleton width={40} height={10} />
                      </View>
                    </View>
                  ))}
            </View>
          ) : (
            <View
              style={{
                paddingTop: 16,
                paddingHorizontal: viewMode === "grid" ? 0 : 14,
              }}
            >
              <EmptyState
                title={COPY.vaultFiltersEmpty.title}
                message={COPY.vaultFiltersEmpty.message}
                icon={Layers}
                secondaryActionLabel="Scan a card"
                onSecondaryAction={() => router.push(routes.scanPhone())}
              />
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

function PortfolioPills({
  stats,
}: {
  stats: { value: number; avgGrade: number; count: number; portfolioDelta: number };
}) {
  const p = useThemedPalette();
  // Anything outside ±99% is almost certainly a data glitch (sparse comp
  // history, divide-by-near-zero) — surface as "—" so we don't broadcast
  // "-329%" to the user.
  const validDelta =
    Number.isFinite(stats.portfolioDelta) && Math.abs(stats.portfolioDelta) < 1;
  const up = stats.portfolioDelta >= 0;
  const deltaTint = up ? p.accent.mint : p.accent.rose;
  const deltaLabel = !validDelta
    ? "—"
    : stats.portfolioDelta === 0
      ? "—"
      : `${up ? "+" : ""}${(stats.portfolioDelta * 100).toFixed(2)}%`;
  return (
    <View className="flex-row gap-2">
      <PillStat label="Holdings" value={stats.count.toString()} />
      <PillStat label="Value" value={compactUsd(stats.value)} />
      <PillStat
        label="Today"
        value={deltaLabel}
        valueColor={!validDelta || stats.portfolioDelta === 0 ? undefined : deltaTint}
      />
    </View>
  );
}

function PillStat({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View className="flex-1 rounded-xl border border-line bg-bg-elevated px-3 py-2.5">
      <Text className="text-[9px] uppercase tracking-[2px] text-ink-dim">{label}</Text>
      <Text
        className="mt-1 text-base font-semibold text-ink"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </Text>
    </View>
  );
}

function ViewModeToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  const p = useThemedPalette();
  const options: { key: ViewMode; Icon: typeof ListIcon; label: string }[] = [
    { key: "list", Icon: ListIcon, label: "List" },
    { key: "grid", Icon: Grid2x2, label: "Grid" },
  ];
  return (
    <View
      style={{
        alignSelf: "flex-start",
        flexDirection: "row",
        padding: 3,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: p.line.default,
        backgroundColor: p.bg.elevated,
      }}
    >
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${opt.label} view`}
            hitSlop={8}
            style={({ pressed }) => ({
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 28,
              borderRadius: 999,
              backgroundColor: active ? p.accent.mint : "transparent",
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <opt.Icon
              size={15}
              color={active ? "#fff" : p.ink.muted}
              strokeWidth={2.25}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
