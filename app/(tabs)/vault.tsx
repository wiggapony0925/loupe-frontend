import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { routes } from "@/shared/routes";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Grid2x2, Layers, List as ListIcon, Plus, Search, X } from "lucide-react-native";
import { CardThumbnail } from "@/presentation/features/collection/CardThumbnail";
import { FilterBar } from "@/presentation/features/collection/FilterBar";
import { PositionRow } from "@/presentation/features/collection/PositionRow";
import { SetProgressCarousel } from "@/presentation/features/collection/SetProgressCarousel";
import { useFilteredCollection } from "@/presentation/features/collection/useFilteredCollection";
import { useVaultFilters } from "@/application/stores/vaultStore";
import { fetchCardSparklines, type CardSparkline } from "@/infrastructure/repositories/forensicRepository";
import { Skeleton } from "@/presentation/components/Skeleton";
import { EmptyState } from "@/presentation/components/EmptyState";
import { COPY } from "@/shared/copy";
import { queryKeys } from "@/application/queries/queryKeys";
import { palette, useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

type ViewMode = "list" | "grid";

export default function VaultScreen() {
  const p = useThemedPalette();
  const router = useRouter();
  const qc = useQueryClient();
  const { cards, isLoading, isFetching, copiesByCardId, uniqueCount, availableSets } =
    useFilteredCollection();
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Pair each holding with its sparkline + delta. Same query Analytics uses,
  // so the React Query cache is shared at no extra cost.
  const sparks = useQuery({
    queryKey: queryKeys.cards.sparklines(),
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
    // Count Loupe-graded copies separately — this is the product-defining
    // story (we evaluated it ourselves) and the only place in the app
    // that surfaces it.
    const loupeGraded = cards.reduce((n, c) => (c.house === "loupe" ? n + 1 : n), 0);
    return { value, avgGrade, count: cards.length, unique: uniqueCount, loupeGraded };
  }, [cards, uniqueCount]);

  const onRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: queryKeys.collection.all });
    qc.invalidateQueries({ queryKey: queryKeys.cards.sparklines() });
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
            {/* Page anchor — every other tab (Command, Analytics, Search)
                has a clear top-of-screen identity. Vault was the only one
                without, which read as a missing nav bar. Eyebrow + title
                pattern matches Analytics for visual consistency. */}
            <VaultPageHeader />
            {isLoading ? (
              <VaultHeaderSkeleton />
            ) : (
              <>
                {/* Order rationale, top to bottom:
                      1. Pills  — headline answer to "what's in my vault?"
                      2. Sets   — discovery rail (what's missing from binders)
                      3. Search / Filter / View toggle — control cluster
                         grouped directly above the list they act on. */}
                <PortfolioPills stats={stats} />
                <SetProgressCarousel />
                <VaultSearchBar />
                <FilterBar availableSets={availableSets} />
                <ViewModeToggle value={viewMode} onChange={setViewMode} />
              </>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const copies = copiesByCardId.get(item.cardId) ?? 1;
          return viewMode === "list" ? (
            <PositionRow card={item} spark={sparkMap.get(item.cardId)} copies={copies} />
          ) : (
            <CardThumbnail card={item} spark={sparkMap.get(item.cardId)} copies={copies} />
          );
        }}
        ListFooterComponent={
          // Once the user has scrolled past their last card the most
          // useful next move is adding another one. We keep the empty
          // state's CTA so this is *only* rendered when there's content
          // above it — otherwise the buttons would stack.
          !isLoading && cards.length > 0 ? (
            <VaultFooterCta
              onAdd={() => router.push(routes.gradeNew())}
              onScan={() => router.push(routes.scanPhone())}
            />
          ) : null
        }
        ListEmptyComponent={
          isLoading ? (
            // Header skeleton (pills/carousel/search/chips) is already
            // rendered by VaultHeaderSkeleton above — here we only need
            // bones for the list rows themselves so the page stops short
            // of the empty-state copy until data lands.
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
                secondaryActionLabel="Add a card"
                onSecondaryAction={() => router.push(routes.gradeNew())}
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
  stats: { value: number; avgGrade: number; count: number; unique: number; loupeGraded: number };
}) {
  // "Holdings" reads as `unique / total` whenever the user owns duplicates
  // so the headline number tells the truth about catalog breadth without
  // hiding the raw card count.
  const holdingsLabel =
    stats.unique > 0 && stats.unique !== stats.count
      ? `${stats.unique}/${stats.count}`
      : stats.count.toString();
  // Avg grade is the only place in the app that summarises *quality*.
  // Hidden when the vault is empty so we don't display "0.0".
  const avgGradeLabel = stats.count > 0 ? stats.avgGrade.toFixed(1) : "—";
  // Loupe-graded is the product-defining stat — how much of the vault
  // we evaluated ourselves vs. self-reported PSA/BGS slabs. Replaces
  // the prior "Today" pill, which already lives on the Command tab.
  const loupeLabel =
    stats.count > 0 ? `${stats.loupeGraded}/${stats.count}` : "—";
  return (
    <View className="flex-row gap-2">
      <PillStat label="Holdings" value={holdingsLabel} />
      <PillStat label="Avg Grade" value={avgGradeLabel} />
      <PillStat label="Loupe-graded" value={loupeLabel} />
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

/**
 * Local search input wired straight to the vault filter store. Substring
 * match is performed in `useFilteredCollection` so the filter chips, the
 * search term, and the duplicate counts all stay in sync from a single
 * source of truth.
 */
function VaultSearchBar() {
  const p = useThemedPalette();
  const query = useVaultFilters((s) => s.query);
  const setQuery = useVaultFilters((s) => s.setQuery);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: p.line.default,
        backgroundColor: p.bg.elevated,
      }}
    >
      <Search size={16} color={p.ink.dim} strokeWidth={2.25} />
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search title, set, year, grade…"
        placeholderTextColor={p.ink.dim}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
        accessibilityLabel="Search your vault"
        style={{
          flex: 1,
          color: p.ink.default,
          fontSize: 14,
          paddingVertical: 0,
        }}
      />
      {query.length > 0 ? (
        <Pressable
          onPress={() => setQuery("")}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <X size={16} color={p.ink.muted} strokeWidth={2.25} />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * End-of-list call to action. The user has just scrolled past their
 * last holding; the most useful next move is adding another card. We
 * expose both entry points so the choice is explicit (scan = Loupe-graded
 * with subgrades, add = self-reported third-party slab) instead of
 * burying one behind a menu.
 */
function VaultFooterCta({ onAdd, onScan }: { onAdd: () => void; onScan: () => void }) {
  const p = useThemedPalette();
  return (
    <View style={{ paddingHorizontal: 14, paddingTop: 24, paddingBottom: 8, gap: 10 }}>
      <Pressable
        onPress={onScan}
        accessibilityRole="button"
        accessibilityLabel="Scan a new card with Loupe"
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          paddingVertical: 14,
          borderRadius: 12,
          backgroundColor: p.accent.mint,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Camera size={16} color="#fff" strokeWidth={2.5} />
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14, letterSpacing: 0.2 }}>
          Scan a new card
        </Text>
      </Pressable>
      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel="Add a card without scanning"
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          paddingVertical: 12,
          borderRadius: 12,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: p.line.default,
          backgroundColor: p.bg.elevated,
          opacity: pressed ? 0.75 : 1,
        })}
      >
        <Plus size={15} color={p.ink.muted} strokeWidth={2.25} />
        <Text style={{ color: p.ink.muted, fontWeight: "600", fontSize: 13 }}>
          Add a card manually
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * Top-of-page anchor for the Vault tab. Mirrors the Analytics tab's
 * eyebrow + display-title pattern so the four tabs feel like one app:
 * Command has a brand bar, Search has its input, Analytics and Vault
 * share the title bar.
 */
function VaultPageHeader() {
  return (
    <View>
      <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
        Collection
      </Text>
      <Text className="mt-1 text-3xl font-semibold tracking-tight text-ink">
        Vault
      </Text>
    </View>
  );
}

/**
 * Loading state for everything in the page header *except* the title
 * (which has no dynamic content and renders immediately). Layout mirrors
 * the real header 1:1 so the page doesn't jump on first paint.
 */
function VaultHeaderSkeleton() {
  const p = useThemedPalette();
  return (
    <View style={{ gap: 20 }}>
      {/* Pills row — three equal-width stat cards. */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              borderRadius: 14,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: p.line.default,
              backgroundColor: p.bg.elevated,
              padding: 12,
              gap: 8,
            }}
          >
            <Skeleton width={60} height={9} />
            <Skeleton width="70%" height={20} />
          </View>
        ))}
      </View>
      {/* Set progress donut tiles. */}
      <View style={{ flexDirection: "row", gap: 12 }}>
        {[0, 1].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              borderRadius: 16,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: p.line.default,
              backgroundColor: p.bg.elevated,
              padding: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Skeleton width={48} height={48} radius={24} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width="70%" height={12} />
              <Skeleton width="40%" height={10} />
            </View>
          </View>
        ))}
      </View>
      {/* Search input. */}
      <Skeleton width="100%" height={40} radius={12} />
      {/* Filter chip row. */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[68, 80, 92, 76].map((w, i) => (
          <Skeleton key={i} width={w} height={28} radius={14} />
        ))}
      </View>
    </View>
  );
}
