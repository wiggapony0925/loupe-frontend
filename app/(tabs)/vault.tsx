import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import {
  ArrowDownRight,
  ArrowUpRight,
  Camera,
  ChevronRight,
  FolderKanban,
  Grid2x2,
  Layers,
  List as ListIcon,
  Package,
  PackageOpen,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react-native";
import { routes } from "@/shared/routes";
import { CardThumbnail } from "@/presentation/features/collection/CardThumbnail";
import { CollectionSwitcher } from "@/presentation/features/collection/CollectionSwitcher";
import { FilterSheet } from "@/presentation/features/collection/FilterSheet";
import { PositionRow } from "@/presentation/features/collection/PositionRow";
import { SetProgressCarousel } from "@/presentation/features/collection/SetProgressCarousel";
import { useFilteredCollection } from "@/presentation/features/collection/useFilteredCollection";
import { VaultCollectionActionSheet } from "@/presentation/features/collection/VaultCollectionActionSheet";
import {
  VaultRemoveSheet,
  type VaultRemoveScope,
} from "@/presentation/features/collection/VaultRemoveSheet";
import {
  vaultGridColumns,
  vaultListRows,
} from "@/presentation/features/collection/vaultLayout";
import { ProUsageBanner } from "@/presentation/features/pro";
import { useMySealedHoldings } from "@/application/queries/collection/useSealed";
import { useCollectionsOverview } from "@/application/queries/collection/useCollectionsOverview";
import { useBulkRemoveFromCollection } from "@/application/queries/collection/useCollectionMutations";
import {
  useRegisterVaultSelectionChrome,
  useVaultSelectionChrome,
} from "@/application/hooks/useVaultSelectionChrome";
import { useActiveCollection } from "@/application/stores/activeCollectionStore";
import { useVaultFilters } from "@/application/stores";
import {
  activeFilterCount,
  GRADE_MAX,
  GRADE_MIN,
  type VaultType,
} from "@/application/stores/vaultStore";
import {
  deleteGradedCard,
  fetchCardSparklines,
  type CardSparkline,
} from "@/infrastructure/repositories/forensicRepository";
import { Skeleton } from "@/presentation/components/Skeleton";
import { EmptyState } from "@/presentation/components/EmptyState";
import { ErrorState } from "@/presentation/components/ErrorState";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { invalidateHoldingCaches } from "@/application/queries/invalidateHoldings";
import { useMoney } from "@/presentation/components/Price";
import { COPY } from "@/shared/copy";
import { queryKeys } from "@/application/queries/queryKeys";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

type ViewMode = "list" | "grid";

type SealedVaultStats = {
  holdingCount: number;
  unitCount: number;
  totalCostUsd: number;
  totalEstimatedValueUsd: number | null;
};

export default function VaultScreen() {
  const p = useThemedPalette();
  const router = useRouter();
  const qc = useQueryClient();
  const {
    cards,
    isLoading,
    isFetching,
    isError,
    refetch,
    copiesByCardId,
    uniqueCount,
    loupeGradedCount,
    availableSets,
    availableTags,
    summary,
  } = useFilteredCollection();
  const { isAuthenticated } = useAuth();
  const sealedHoldings = useMySealedHoldings({ includeOpened: false });
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [filterOpen, setFilterOpen] = useState(false);
  const [organizeOpen, setOrganizeOpen] = useState(false);
  const [removeIds, setRemoveIds] = useState<string[] | null>(null);

  // Multi-select + island-navbar chrome — store + hook keep the tab bar
  // and this screen in sync without prop-drilling through TabsLayout.
  const {
    selecting: selectionMode,
    selected: selectedIds,
    busy: selectionBusy,
    beginWith: beginSelectionWith,
    toggle: toggleSelection,
    selectMany,
    clear: clearSelection,
    setBusy: setSelectionBusy,
  } = useVaultSelectionChrome();

  const openOrganize = useCallback(() => setOrganizeOpen(true), []);
  const openRemoveSheet = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setRemoveIds(ids);
  }, []);
  const openRemoveFromIsland = useCallback(() => {
    openRemoveSheet(Array.from(selectedIds));
  }, [openRemoveSheet, selectedIds]);
  // Toggle: everything visible selected → exit; otherwise select all
  // currently filtered holdings (respects search / set / grade filters).
  const toggleSelectAll = useCallback(() => {
    const visibleIds = cards.map((c) => c.id);
    const allSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
    selectMany(allSelected ? [] : visibleIds);
  }, [cards, selectedIds, selectMany]);

  useRegisterVaultSelectionChrome({
    onOrganize: openOrganize,
    onRemove: openRemoveFromIsland,
    onSelectAll: toggleSelectAll,
  });

  const { collectionId: activeCollectionId } = useActiveCollection();
  const { data: portfolios } = useCollectionsOverview();
  const bulkRemove = useBulkRemoveFromCollection();
  const activeCollectionName = useMemo(() => {
    if (!activeCollectionId) return null;
    return portfolios?.find((c) => c.id === activeCollectionId)?.name ?? null;
  }, [activeCollectionId, portfolios]);

  const enterSelection = useCallback(
    (id: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      beginSelectionWith(id);
    },
    [beginSelectionWith],
  );
  const tapToggle = useCallback(
    (id: string) => {
      Haptics.selectionAsync().catch(() => {});
      toggleSelection(id);
    },
    [toggleSelection],
  );

  // Bulk-delete fans out one DELETE per selected grade id. Backend has
  // no batch endpoint yet — if/when it ships we can swap this in
  // place. Promise.allSettled so a single 404 doesn't strand the rest.
  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(ids.map(deleteGradedCard));
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) throw new Error(`${failed} card(s) could not be removed.`);
    },
    onSettled: () => {
      // Refresh every holding-derived cache (list, hero, pills, tiles,
      // analytics, home feed) so they all reflect the smaller vault.
      invalidateHoldingCaches(qc);
    },
  });

  const confirmRemove = useCallback(
    async (scope: VaultRemoveScope) => {
      if (!removeIds || removeIds.length === 0) return;
      setSelectionBusy(true);
      try {
        if (scope === "collection") {
          if (!activeCollectionId) {
            throw new Error("Switch into a collection to remove membership only.");
          }
          await bulkRemove.mutateAsync({
            collectionId: activeCollectionId,
            gradedCardIds: removeIds,
          });
        } else {
          await deleteMutation.mutateAsync(removeIds);
        }
        setRemoveIds(null);
        clearSelection();
      } catch (err) {
        Alert.alert(
          "Couldn't remove cards",
          String((err as Error).message ?? err),
        );
      } finally {
        setSelectionBusy(false);
      }
    },
    [
      removeIds,
      activeCollectionId,
      bulkRemove,
      deleteMutation,
      clearSelection,
      setSelectionBusy,
    ],
  );

  // Pair each holding with its sparkline + delta. Same query Analytics uses,
  // so the React Query cache is shared at no extra cost.
  const sparks = useQuery({
    queryKey: queryKeys.cards.sparklines(),
    queryFn: fetchCardSparklines,
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
  const sparkMap = useMemo(
    () => new Map((sparks.data ?? []).map((s: CardSparkline) => [s.cardId, s])),
    [sparks.data],
  );

  // Grid column count is derived once from screen width. FlatList itself
  // always stays at numColumns=1 — we chunk cards into rows ourselves so
  // toggling list↔grid never remounts the list (RN forbids changing
  // numColumns without a remount, which was shoving the header down).
  const { width: screenWidth } = useWindowDimensions();
  const gridColumns = vaultGridColumns(screenWidth);
  const rows = useMemo(
    () => vaultListRows(isLoading ? [] : cards, viewMode, gridColumns),
    [cards, viewMode, gridColumns, isLoading],
  );

  const stats = useMemo(() => {
    const value = cards.reduce((s, c) => s + c.estimatedValueUsd, 0);
    const avgGrade = cards.length > 0 ? cards.reduce((s, c) => s + c.grade, 0) / cards.length : 0;
    // Loupe-graded count is the product-defining story (we evaluated
    // it ourselves). Prefer the server-side aggregate — which spans the
    // whole vault — and fall back to counting the filtered page so
    // older backends or in-flight requests still render a sensible
    // number instead of a blank pill.
    const loupeGraded =
      loupeGradedCount > 0
        ? loupeGradedCount
        : cards.reduce((n, c) => (c.house === "loupe" ? n + 1 : n), 0);
    return { value, avgGrade, count: cards.length, unique: uniqueCount, loupeGraded };
  }, [cards, uniqueCount, loupeGradedCount]);

  const sealedStats = useMemo(() => {
    const rows = sealedHoldings.data ?? [];
    let unitCount = 0;
    let totalCostUsd = 0;
    let totalEstimatedValueUsd = 0;
    let estimatedCount = 0;
    for (const row of rows) {
      unitCount += row.quantity;
      const costEach = row.purchase_price_usd != null ? Number(row.purchase_price_usd) : null;
      if (costEach != null && Number.isFinite(costEach)) {
        totalCostUsd += costEach * row.quantity;
      }
      const valueEach = row.estimated_value_usd != null ? Number(row.estimated_value_usd) : null;
      if (valueEach != null && Number.isFinite(valueEach)) {
        totalEstimatedValueUsd += valueEach * row.quantity;
        estimatedCount += 1;
      }
    }
    return {
      holdingCount: rows.length,
      unitCount,
      totalCostUsd,
      totalEstimatedValueUsd: estimatedCount > 0 ? totalEstimatedValueUsd : null,
    };
  }, [sealedHoldings.data]);

  const onRefresh = useCallback(() => {
    invalidateHoldingCaches(qc);
  }, [qc]);

  // Constant gutter — never changes with viewMode, so the header
  // doesn't shift when the user toggles list↔grid.
  const PAGE_GUTTER = 20;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-bg">
      <FlatList
        data={rows}
        keyExtractor={(row) => row.map((c) => c.id).join("|")}
        // Always 1 — grid is simulated by chunking into row arrays.
        // Never remounts on viewMode change → header stays put.
        numColumns={1}
        contentContainerStyle={{
          // Constant padding — changing this with viewMode was part of
          // the "everything jumps down" bug on toggle.
          paddingHorizontal: PAGE_GUTTER,
          paddingTop: 20,
          paddingBottom: 132,
          gap: viewMode === "grid" ? 12 : 0,
          flexGrow: 1,
        }}
        ItemSeparatorComponent={
          viewMode === "list"
            ? () => (
                <View
                  style={{
                    height: 1,
                    backgroundColor: p.line.default,
                  }}
                />
              )
            : undefined
        }
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={selectionMode ? () => {} : onRefresh}
            enabled={!selectionMode}
            tintColor={p.accent.mint}
          />
        }
        ListHeaderComponent={
          <View className="gap-4 pb-3">
            {selectionMode ? (
              <VaultSelectionHeader
                count={selectedIds.size}
                valueUsd={cards.reduce(
                  (sum, c) =>
                    selectedIds.has(c.id) ? sum + (c.estimatedValueUsd ?? 0) : sum,
                  0,
                )}
              />
            ) : (
              <VaultPageHeader
                onAdd={() => router.push(routes.gradeNew())}
                onScan={() => router.push(routes.scanEntry())}
                onSealed={() => router.push(routes.sealed())}
              />
            )}
            {isLoading ? (
              <VaultHeaderSkeleton />
            ) : selectionMode ? (
              // Focus mode — hide portfolio chrome so selection feels intentional.
              <>
                <VaultSelectionHint collectionName={activeCollectionName} />
                <VaultListChrome
                  count={cards.length}
                  viewMode={viewMode}
                  onChange={setViewMode}
                />
              </>
            ) : (
              <>
                <ProUsageBanner />
                <PortfolioHero
                  totalValueUsd={summary?.totalValueUsd ?? stats.value}
                  pnlUsd={summary?.unrealizedPnlUsd ?? null}
                  pnlPct={summary?.unrealizedPnlPct ?? null}
                />
                <PortfolioPills stats={stats} />
                <VaultSearchBar onOpenFilters={() => setFilterOpen(true)} />
                <VaultActiveChips />
                <VaultListChrome
                  count={cards.length}
                  viewMode={viewMode}
                  onChange={setViewMode}
                />
              </>
            )}
          </View>
        }
        renderItem={({ item: row }) => {
          if (viewMode === "list") {
            const item = row[0]!;
            const copies = copiesByCardId.get(item.cardId) ?? 1;
            const isSelected = selectedIds.has(item.id);
            const onPress = selectionMode ? () => tapToggle(item.id) : undefined;
            const onLongPress = selectionMode
              ? () => tapToggle(item.id)
              : () => enterSelection(item.id);
            return (
              <PositionRow
                card={item}
                spark={sparkMap.get(item.cardId)}
                copies={copies}
                // FlatList already applies PAGE_GUTTER — don't double-indent.
                indent={0}
                onPress={onPress}
                onLongPress={onLongPress}
                selected={selectionMode ? isSelected : undefined}
                onEdit={
                  selectionMode
                    ? () => router.push(routes.gradeEdit(item.id))
                    : undefined
                }
                onRemove={
                  selectionMode ? () => openRemoveSheet([item.id]) : undefined
                }
              />
            );
          }

          // Grid row — fill missing slots with spacers so the last
          // incomplete row keeps equal tile widths.
          const slots = Array.from({ length: gridColumns }, (_, i) => row[i] ?? null);
          return (
            <View style={{ flexDirection: "row", gap: 12 }}>
              {slots.map((item, i) => {
                if (!item) {
                  return <View key={`pad-${i}`} style={{ flex: 1 }} />;
                }
                const copies = copiesByCardId.get(item.cardId) ?? 1;
                const isSelected = selectedIds.has(item.id);
                const onPress = selectionMode ? () => tapToggle(item.id) : undefined;
                const onLongPress = selectionMode
                  ? () => tapToggle(item.id)
                  : () => enterSelection(item.id);
                return (
                  <View key={item.id} style={{ flex: 1 }}>
                    <CardThumbnail
                      card={item}
                      spark={sparkMap.get(item.cardId)}
                      copies={copies}
                      onPress={onPress}
                      onLongPress={onLongPress}
                      selected={selectionMode ? isSelected : undefined}
                      onEdit={
                        selectionMode
                          ? () => router.push(routes.gradeEdit(item.id))
                          : undefined
                      }
                      onRemove={
                        selectionMode
                          ? () => openRemoveSheet([item.id])
                          : undefined
                      }
                    />
                  </View>
                );
              })}
            </View>
          );
        }}
        ListFooterComponent={
          !isLoading && !selectionMode ? (
            <VaultSupplementalSections
              padX={0}
              sealedStats={sealedStats}
              sealedLoading={sealedHoldings.isLoading}
              onOpenSealed={() => router.push(routes.sealed())}
              onAddSealed={() => router.push(routes.sealedAdd())}
            />
          ) : null
        }
        ListEmptyComponent={
          isLoading ? (
            <View
              className={viewMode === "grid" ? "flex-row gap-3" : "gap-3"}
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
          ) : isError ? (
            <View style={{ paddingTop: 16 }}>
              <ErrorState
                title="Couldn't load your vault"
                message="We hit a snag fetching your collection. Check your connection and try again."
                onRetry={() => void refetch()}
                compact
              />
            </View>
          ) : uniqueCount === 0 ? (
            <View style={{ paddingTop: 16 }}>
              <EmptyState
                title={COPY.vaultEmpty.title}
                message={COPY.vaultEmpty.message}
                icon={Camera}
                secondaryActionLabel="Scan a card"
                onSecondaryAction={() => router.push(routes.scanEntry())}
              />
            </View>
          ) : (
            <View style={{ paddingTop: 16 }}>
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
      <FilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        availableSets={availableSets}
        availableTags={availableTags}
        resultCount={cards.length}
      />
      <VaultCollectionActionSheet
        visible={organizeOpen}
        gradedCardIds={Array.from(selectedIds)}
        onClose={() => setOrganizeOpen(false)}
        onDone={() => clearSelection()}
      />
      <VaultRemoveSheet
        visible={removeIds != null}
        count={removeIds?.length ?? 0}
        collectionName={activeCollectionName}
        busy={selectionBusy}
        onClose={() => {
          if (!selectionBusy) setRemoveIds(null);
        }}
        onConfirm={(scope) => void confirmRemove(scope)}
      />
    </SafeAreaView>
  );
}

function VaultSupplementalSections({
  padX,
  sealedStats,
  sealedLoading,
  onOpenSealed,
  onAddSealed,
}: {
  padX: number;
  sealedStats: SealedVaultStats;
  sealedLoading: boolean;
  onOpenSealed: () => void;
  onAddSealed: () => void;
}) {
  return (
    <View
      style={{
        gap: 18,
        paddingHorizontal: padX,
        paddingTop: 22,
        paddingBottom: 8,
      }}
    >
      <SealedVaultCard
        stats={sealedStats}
        loading={sealedLoading}
        onOpen={onOpenSealed}
        onAdd={onAddSealed}
      />
      <SetProgressCarousel />
    </View>
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
  const loupeLabel = stats.count > 0 ? `${stats.loupeGraded}/${stats.count}` : "—";
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
        style={[
          { fontVariant: ["tabular-nums"] as const, letterSpacing: -0.3 },
          valueColor ? { color: valueColor } : null,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function ViewModeToggle({ value, onChange }: { value: ViewMode; onChange: (m: ViewMode) => void }) {
  const p = useThemedPalette();
  const options: { key: ViewMode; Icon: typeof ListIcon; label: string }[] = [
    { key: "list", Icon: ListIcon, label: "List view" },
    { key: "grid", Icon: Grid2x2, label: "Grid view" },
  ];
  const CELL = 36;
  return (
    <View
      style={{
        flexDirection: "row",
        padding: 3,
        borderRadius: 999,
        backgroundColor: withAlpha(p.ink.muted, 0.1),
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
            accessibilityLabel={opt.label}
            hitSlop={4}
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <View
              style={{
                width: CELL,
                height: CELL,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 999,
                backgroundColor: active ? p.accent.mint : "transparent",
                shadowColor: active ? p.accent.mint : "transparent",
                shadowOpacity: active ? 0.3 : 0,
                shadowRadius: active ? 6 : 0,
                shadowOffset: { width: 0, height: 2 },
                elevation: active ? 3 : 0,
              }}
            >
              <opt.Icon
                size={16}
                color={active ? "#06140d" : withAlpha(p.ink.muted, 0.7)}
                strokeWidth={active ? 2.6 : 2}
              />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Thin chrome row immediately above the holdings list: shows the live
 * filtered count on the left, the layout toggle on the right. Reads as
 * a section header for the list below — Robinhood does the same with
 * its "Stocks · Crypto" / sort-control row.
 */
function VaultListChrome({
  count,
  viewMode,
  onChange,
}: {
  count: number;
  viewMode: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: 4,
      }}
    >
      <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
        {count === 1 ? "1 Holding" : `${count} Holdings`}
      </Text>
      <ViewModeToggle value={viewMode} onChange={onChange} />
    </View>
  );
}

/**
 * Local search input wired straight to the vault filter store. Substring
 * match is performed in `useFilteredCollection` so the filter chips, the
 * search term, and the duplicate counts all stay in sync from a single
 * source of truth.
 */
function VaultSearchBar({ onOpenFilters }: { onOpenFilters: () => void }) {
  const p = useThemedPalette();
  const query = useVaultFilters((s) => s.query);
  const setQuery = useVaultFilters((s) => s.setQuery);
  const activeCount = useVaultFilters(activeFilterCount);
  const hasFilters = activeCount > 0;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View
        style={{
          flex: 1,
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
          style={{ flex: 1, color: p.ink.default, fontSize: 14, paddingVertical: 0 }}
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
      {/* Filters button — opens the sheet; shows a live active-facet count. */}
      <Pressable
        onPress={onOpenFilters}
        accessibilityRole="button"
        accessibilityLabel={`Filters${hasFilters ? `, ${activeCount} active` : ""}`}
        style={({ pressed }) => ({
          width: 46,
          height: 44,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 12,
          borderWidth: 1,
          borderColor: hasFilters ? withAlpha(p.accent.mint, 0.5) : p.line.default,
          backgroundColor: hasFilters ? withAlpha(p.accent.mint, 0.14) : p.bg.elevated,
          opacity: pressed ? 0.75 : 1,
        })}
      >
        <SlidersHorizontal
          size={18}
          color={hasFilters ? p.accent.mint : p.ink.default}
          strokeWidth={2.25}
        />
        {hasFilters ? (
          <View
            style={{
              position: "absolute",
              top: -5,
              right: -5,
              minWidth: 17,
              height: 17,
              paddingHorizontal: 4,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: p.accent.mint,
            }}
          >
            <Text style={{ color: "#06140d", fontSize: 10, fontWeight: "800" }}>{activeCount}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const HOUSE_LABELS: Record<VaultType, string> = {
  loupe: "Loupe",
  raw: "Raw",
  psa: "PSA",
  bgs: "BGS",
  cgc: "CGC",
  sgc: "SGC",
};

/**
 * Removable chips summarizing the currently-applied filters, so the active
 * state is visible without opening the sheet. Tapping a chip clears that facet;
 * "Clear all" resets everything. Renders nothing when no filter is active.
 */
function VaultActiveChips() {
  const p = useThemedPalette();
  const s = useVaultFilters();
  if (activeFilterCount(s) === 0) return null;

  const chips: { key: string; label: string; tint?: string; onRemove: () => void }[] = [];
  for (const h of s.houses)
    chips.push({ key: `h:${h}`, label: HOUSE_LABELS[h], onRemove: () => s.toggleHouse(h) });
  for (const t of s.tags)
    chips.push({ key: `t:${t}`, label: t, tint: p.accent.mint, onRemove: () => s.toggleTag(t) });
  for (const name of s.sets)
    chips.push({
      key: `s:${name}`,
      label: name.length > 18 ? `${name.slice(0, 17)}…` : name,
      onRemove: () => s.toggleSet(name),
    });
  if (s.gradeRange[0] > GRADE_MIN || s.gradeRange[1] < GRADE_MAX)
    chips.push({
      key: "grade",
      label: `Grade ${s.gradeRange[0]}–${s.gradeRange[1]}`,
      onRemove: () => s.setGradeRange([GRADE_MIN, GRADE_MAX]),
    });
  if (s.minValue != null || s.maxValue != null) {
    const lo = s.minValue != null ? `$${s.minValue}` : "$0";
    const hi = s.maxValue != null ? `$${s.maxValue}` : "∞";
    chips.push({ key: "price", label: `${lo}–${hi}`, onRemove: () => s.setValueRange(null, null) });
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 8 }}>
        {chips.map((c) => {
          const tint = p.accent.mint;
          return (
            <Pressable
              key={c.key}
              onPress={c.onRemove}
              accessibilityRole="button"
              accessibilityLabel={`Remove filter ${c.label}`}
              style={({ pressed }) => ({
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingLeft: 12,
                  paddingRight: 8,
                  paddingVertical: 6,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: withAlpha(tint, 0.35),
                  backgroundColor: withAlpha(tint, 0.12),
                }}
              >
                <Text style={{ color: tint, fontSize: 12, fontWeight: "700", letterSpacing: 0.2 }}>{c.label}</Text>
                <X size={12} color={tint} strokeWidth={2.5} />
              </View>
            </Pressable>
          );
        })}
        <Pressable
          onPress={s.clearAll}
          accessibilityRole="button"
          accessibilityLabel="Clear all filters"
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <View style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
            <Text style={{ color: p.ink.muted, fontSize: 12, fontWeight: "700" }}>Clear all</Text>
          </View>
        </Pressable>
      </View>
    </ScrollView>
  );
}

/**
 * Selection header — count + live selected value. Organize / cancel /
 * remove live on the floating island navbar so the top stays calm.
 */
function VaultSelectionHeader({
  count,
  valueUsd,
}: {
  count: number;
  valueUsd: number;
}) {
  const p = useThemedPalette();
  const { format } = useMoney();
  const countLabel = count === 1 ? "1 card" : `${count} cards`;
  return (
    <View style={{ minHeight: 56, justifyContent: "flex-end" }}>
      <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
        Selecting
      </Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
        <Text
          className="mt-1 text-3xl font-semibold tracking-tight text-ink"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {countLabel}
        </Text>
        {count > 0 && valueUsd > 0 ? (
          <Text
            style={{
              color: p.accent.mint,
              fontSize: 15,
              fontWeight: "800",
              fontVariant: ["tabular-nums"],
            }}
          >
            {format(valueUsd)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Soft coach mark shown only while selecting — replaces portfolio clutter. */
function VaultSelectionHint({ collectionName }: { collectionName: string | null }) {
  const p = useThemedPalette();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: withAlpha(p.accent.mint, 0.28),
        backgroundColor: withAlpha(p.accent.mint, 0.08),
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: withAlpha(p.accent.mint, 0.18),
        }}
      >
        <FolderKanban size={14} color={p.accent.mint} strokeWidth={2.5} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: p.ink.default, fontSize: 13, fontWeight: "700" }}>
          Tap to select · double-check icon selects everything in view
        </Text>
        <Text style={{ color: p.ink.muted, fontSize: 12, fontWeight: "500" }}>
          {collectionName
            ? `Remove from ${collectionName} or your whole portfolio.`
            : "Organize into collections — or remove from your vault."}
        </Text>
      </View>
    </View>
  );
}

/**
 * Top-of-page anchor for the Vault tab. Mirrors the Analytics tab's
 * eyebrow + display-title pattern so the four tabs feel like one app:
 * Command has a brand bar, Search has its input, Analytics and Vault
 * share the title bar.
 *
 * The right-hand action cluster (Add · Scan · Sealed) replaces the old
 * end-of-list CTA — Robinhood keeps "Deposit" pinned at the top of
 * the portfolio for the same reason: the action shouldn't be gated
 * behind a scroll.
 */
function VaultPageHeader({
  onAdd,
  onScan,
  onSealed,
}: {
  onAdd: () => void;
  onScan: () => void;
  onSealed: () => void;
}) {
  const p = useThemedPalette();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
      <View style={{ flex: 1 }}>
        <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
          Collection
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 }}>
          <Text className="text-3xl font-semibold tracking-tight text-ink">Vault</Text>
          <CollectionSwitcher />
        </View>
      </View>
      {/* Add a card manually */}
      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel="Add a card manually"
        hitSlop={6}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <View
          style={{
            width: 38,
            height: 38,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 999,
            backgroundColor: withAlpha(p.accent.mint, 0.12),
          }}
        >
          <Plus size={19} color={p.accent.mint} strokeWidth={2.5} />
        </View>
      </Pressable>
      {/* Scan — primary action */}
      <Pressable
        onPress={onScan}
        accessibilityRole="button"
        accessibilityLabel="Scan a new card"
        hitSlop={6}
        style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
      >
        <View
          style={{
            width: 38,
            height: 38,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 999,
            backgroundColor: p.accent.mint,
          }}
        >
          <Camera size={18} color="#06140d" strokeWidth={2.5} />
        </View>
      </Pressable>
      {/* Sealed vault */}
      <Pressable
        onPress={onSealed}
        accessibilityRole="button"
        accessibilityLabel="Open sealed vault"
        hitSlop={6}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <View
          style={{
            width: 38,
            height: 38,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 999,
            backgroundColor: withAlpha(p.ink.muted, 0.08),
          }}
        >
          <Package size={18} color={p.ink.default} strokeWidth={2.25} />
        </View>
      </Pressable>
    </View>
  );
}

function SealedVaultCard({
  stats,
  loading,
  onOpen,
  onAdd,
}: {
  stats: SealedVaultStats;
  loading: boolean;
  onOpen: () => void;
  onAdd: () => void;
}) {
  const p = useThemedPalette();
  const { format } = useMoney();
  if (loading) {
    return <Skeleton width="100%" height={56} radius={8} />;
  }

  const hasHoldings = stats.holdingCount > 0;
  const headline = hasHoldings
    ? `${stats.holdingCount} sealed holding${stats.holdingCount === 1 ? "" : "s"}`
    : "Track sealed product";
  const detail = hasHoldings
    ? `${stats.unitCount} total unit${stats.unitCount === 1 ? "" : "s"}`
    : "Booster boxes, ETBs, tins";
  const valueLabel =
    stats.totalEstimatedValueUsd != null
      ? "Est. value"
      : stats.totalCostUsd > 0
        ? "Cost basis"
        : "Sealed vault";
  const value =
    stats.totalEstimatedValueUsd != null
      ? stats.totalEstimatedValueUsd
      : stats.totalCostUsd > 0
        ? stats.totalCostUsd
        : null;
  const primaryAction = hasHoldings ? onOpen : onAdd;
  const metric = hasHoldings && value != null ? format(value, { compact: false }) : null;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 4,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderColor: p.line.default,
      }}
    >
      <Pressable
        onPress={primaryAction}
        accessibilityRole="button"
        accessibilityLabel={hasHoldings ? "Open sealed vault" : "Add sealed product"}
        style={({ pressed }) => ({
          flex: 1,
          opacity: pressed ? 0.76 : 1,
        })}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: withAlpha(p.accent.mint, 0.12),
            }}
          >
            <Package size={18} color={p.accent.mint} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: p.ink.default, fontSize: 14.5, fontWeight: "700" }}>
              {headline}
            </Text>
            <Text numberOfLines={1} style={{ color: p.ink.muted, fontSize: 11.5, fontWeight: "500", marginTop: 2 }}>
              {detail}
            </Text>
          </View>
        </View>
      </Pressable>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {metric ? (
          <View style={{ alignItems: "flex-end" }}>
            <Text
              style={{
                color: p.ink.default,
                fontSize: 14,
                fontWeight: "700",
                fontVariant: ["tabular-nums"],
              }}
            >
              {metric}
            </Text>
            <Text
              style={{
                color: p.ink.dim,
                fontSize: 9,
                fontWeight: "800",
                letterSpacing: 0.5,
                textTransform: "uppercase",
                marginTop: 2,
              }}
            >
              {valueLabel}
            </Text>
          </View>
        ) : null}

        {hasHoldings ? (
          <Pressable
            onPress={onOpen}
            accessibilityRole="button"
            accessibilityLabel="Open sealed vault"
            hitSlop={6}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: withAlpha(p.accent.mint, 0.12),
              }}
            >
              <ChevronRight size={16} color={p.accent.mint} strokeWidth={2.5} />
            </View>
          </Pressable>
        ) : (
          <Pressable
            onPress={onAdd}
            accessibilityRole="button"
            accessibilityLabel="Add sealed product"
            hitSlop={6}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: withAlpha(p.accent.mint, 0.12),
              }}
            >
              <Plus size={16} color={p.accent.mint} strokeWidth={2.5} />
            </View>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/**
 * Robinhood-style portfolio hero. Big tabular total at the top with a
 * colored ± delta chip directly below — green when up, rose when down,
 * dim/grey when we don't know cost basis yet. Total value comes from
 * the unfiltered summary endpoint so the headline stays stable even
 * while the user is filtering the list below.
 */
function PortfolioHero({
  totalValueUsd,
  pnlUsd,
  pnlPct,
}: {
  totalValueUsd: number;
  pnlUsd: number | null;
  pnlPct: number | null;
}) {
  const p = useThemedPalette();
  const { format } = useMoney();
  const hasPnl = pnlUsd != null && pnlPct != null;
  const up = hasPnl && (pnlUsd as number) >= 0;
  const tint = !hasPnl ? p.ink.dim : up ? p.accent.mint : p.accent.rose;
  const DeltaIcon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <View>
      <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
        Portfolio Value
      </Text>
      <Text
        className="mt-1 text-4xl font-bold tracking-tight text-ink"
        style={{ fontVariant: ["tabular-nums"], letterSpacing: -0.8 }}
      >
        {format(totalValueUsd, { compact: false })}
      </Text>
      {hasPnl ? (
        <View
          style={{
            marginTop: 8,
            alignSelf: "flex-start",
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingVertical: 4,
            paddingLeft: 6,
            paddingRight: 10,
            borderRadius: 999,
            backgroundColor: withAlpha(tint, 0.14),
          }}
        >
          <DeltaIcon size={14} color={tint} strokeWidth={2.75} />
          <Text
            style={{
              color: tint,
              fontWeight: "700",
              fontSize: 12,
              fontVariant: ["tabular-nums"],
            }}
          >
            {up ? "+" : ""}
            {format(pnlUsd as number, { compact: false })} ({up ? "+" : ""}
            {(pnlPct as number).toFixed(2)}%)
          </Text>
        </View>
      ) : (
        <Text className="mt-2 text-[11px] font-semibold uppercase tracking-[2px] text-ink-dim">
          Set a cost basis to track P/L
        </Text>
      )}
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
      {/* Hero — big value placeholder + delta chip. */}
      <View style={{ gap: 8 }}>
        <Skeleton width={120} height={9} />
        <Skeleton width="65%" height={34} />
        <Skeleton width={160} height={20} radius={999} />
      </View>
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
