import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
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
import Animated, { FadeInDown } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowUpRight,
  Camera,
  Grid2x2,
  Layers,
  List as ListIcon,
  Package,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react-native";
import { routes } from "@/shared/routes";
import { CardThumbnail } from "@/presentation/features/collection/CardThumbnail";
import { FilterBar } from "@/presentation/features/collection/FilterBar";
import { PositionRow } from "@/presentation/features/collection/PositionRow";
import { SetProgressCarousel } from "@/presentation/features/collection/SetProgressCarousel";
import { useFilteredCollection } from "@/presentation/features/collection/useFilteredCollection";
import { useMySealedHoldings } from "@/application/queries/collection/useSealed";
import { useVaultFilters, useVaultSelection } from "@/application/stores";
import {
  deleteGradedCard,
  fetchCardSparklines,
  type CardSparkline,
} from "@/infrastructure/repositories/forensicRepository";
import { Skeleton } from "@/presentation/components/Skeleton";
import { EmptyState } from "@/presentation/components/EmptyState";
import { useMoney } from "@/presentation/components/Price";
import { COPY } from "@/shared/copy";
import { queryKeys } from "@/application/queries/queryKeys";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

type ViewMode = "list" | "grid";

export default function VaultScreen() {
  const p = useThemedPalette();
  const router = useRouter();
  const qc = useQueryClient();
  const {
    cards,
    isLoading,
    isFetching,
    copiesByCardId,
    uniqueCount,
    loupeGradedCount,
    availableSets,
    summary,
  } = useFilteredCollection();
  const sealedHoldings = useMySealedHoldings({ includeOpened: false });
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Multi-select state lives in its own store so filter / search
  // re-renders don't disturb it (and vice versa). The vault page is
  // the only screen that drives it.
  const selectionMode = useVaultSelection((s) => s.mode === "select");
  const selectedIds = useVaultSelection((s) => s.selected);
  const beginSelectionWith = useVaultSelection((s) => s.beginWith);
  const toggleSelection = useVaultSelection((s) => s.toggle);
  const clearSelection = useVaultSelection((s) => s.clear);

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
      // Refresh both the list and any cached summary / sparkline data
      // so the hero, pills, and tiles all reflect the smaller vault.
      qc.invalidateQueries({ queryKey: queryKeys.me.grades() });
      qc.invalidateQueries({ queryKey: queryKeys.collection.all });
      qc.invalidateQueries({ queryKey: queryKeys.cards.sparklines() });
      qc.invalidateQueries({ queryKey: queryKeys.portfolio.all });
      qc.invalidateQueries({ queryKey: queryKeys.sets.progress() });
    },
  });

  const confirmAndDelete = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const noun = ids.length === 1 ? "card" : "cards";
      Alert.alert(
        `Remove ${ids.length} ${noun}?`,
        "They'll be removed from your vault. This can't be undone from the app.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: () => {
              deleteMutation.mutate(ids, {
                onSuccess: () => clearSelection(),
                onError: (err) =>
                  Alert.alert("Couldn't remove cards", String((err as Error).message ?? err)),
              });
            },
          },
        ],
      );
    },
    [deleteMutation, clearSelection],
  );

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

  // Adaptive column count for grid mode. On phones we always want 2
  // columns — relying on `screenWidth / 180` was flaky during the first
  // measurement pass (it could resolve to < 360 px before the safe-area
  // settled, falling back to a 1-column grid that ballooned each 5:7
  // tile to fill the entire screen). Tablets keep the proportional
  // formula but clamp to 4.
  const { width: screenWidth } = useWindowDimensions();
  const isTablet = screenWidth >= 768;
  const numColumns =
    viewMode === "list"
      ? 1
      : isTablet
        ? Math.max(2, Math.min(4, Math.floor(screenWidth / 220)))
        : 2;

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
    qc.invalidateQueries({ queryKey: queryKeys.collection.all });
    qc.invalidateQueries({ queryKey: queryKeys.cards.sparklines() });
    qc.invalidateQueries({ queryKey: queryKeys.portfolio.all });
    qc.invalidateQueries({ queryKey: queryKeys.sets.progress() });
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
            // Disable pull-to-refresh while selecting so a stray drag
            // doesn't kick off a network round-trip mid-selection.
            onRefresh={selectionMode ? () => {} : onRefresh}
            enabled={!selectionMode}
            tintColor={p.accent.mint}
          />
        }
        ListHeaderComponent={
          <View className="gap-5 pb-4" style={{ paddingHorizontal: headerPadX }}>
            {/* Page anchor — swaps to a selection toolbar when the
                user is staging cards for bulk delete so the header
                action cluster doesn't compete for tap targets. */}
            {selectionMode ? (
              <VaultSelectionBar
                count={selectedIds.size}
                onCancel={clearSelection}
                onDelete={() => confirmAndDelete(Array.from(selectedIds))}
                busy={deleteMutation.isPending}
              />
            ) : (
              <VaultPageHeader
                onAdd={() => router.push(routes.gradeNew())}
                onScan={() => router.push(routes.scanPhone())}
                onSealed={() => router.push(routes.sealed())}
              />
            )}
            {isLoading ? (
              <VaultHeaderSkeleton />
            ) : (
              <>
                {/* Order rationale, top to bottom:
                      1. Hero   — Robinhood-style portfolio value + P/L
                      2. Pills  — Holdings / Avg grade / Loupe-graded
                      3. Sets   — discovery rail (what's missing from binders)
                      4. Search / Filter / View toggle — control cluster
                         grouped directly above the list they act on. */}
                <PortfolioHero
                  totalValueUsd={summary?.totalValueUsd ?? stats.value}
                  pnlUsd={summary?.unrealizedPnlUsd ?? null}
                  pnlPct={summary?.unrealizedPnlPct ?? null}
                />
                <PortfolioPills stats={stats} />
                <SealedVaultCard
                  stats={sealedStats}
                  loading={sealedHoldings.isLoading}
                  onOpen={() => router.push(routes.sealed())}
                  onAdd={() => router.push(routes.sealedAdd())}
                />
                <SetProgressCarousel />
                <VaultSearchBar />
                <FilterBar availableSets={availableSets} />
                <VaultListChrome
                  count={cards.length}
                  viewMode={viewMode}
                  onChange={setViewMode}
                />
              </>
            )}
          </View>
        }
        renderItem={({ item, index }) => {
          const copies = copiesByCardId.get(item.cardId) ?? 1;
          const isSelected = selectedIds.has(item.id);
          // When in selection mode a tap toggles membership; otherwise
          // we fall back to the row/tile's built-in navigate behaviour
          // by leaving `onPress` undefined.
          const onPress = selectionMode
            ? () => toggleSelection(item.id)
            : undefined;
          const onLongPress = selectionMode
            ? () => toggleSelection(item.id)
            : () => beginSelectionWith(item.id);
          // `selected` is only forwarded while in selection mode so the
          // checkbox / overlay are hidden during normal browsing.
          const selectedProp = selectionMode ? isSelected : undefined;
          // Staggered fade-in — each row enters ~40ms after the one
          // above it for a Robinhood-style cascade. Only the first
          // dozen are staggered so a long list doesn't queue a 2-second
          // animation chain when the user scrolls back into view.
          const delay = Math.min(index, 12) * 40;
          return (
            <Animated.View
              entering={FadeInDown.delay(delay).duration(260)}
              // In grid mode each item gets `flex: 1` of the row's
              // remaining space. We also cap the tile width so an
              // unexpected single-column layout can't balloon a 5:7
              // card to fill the whole screen.
              style={
                viewMode === "grid"
                  ? { flex: 1, maxWidth: 240 }
                  : undefined
              }
            >
              {viewMode === "list" ? (
                <PositionRow
                  card={item}
                  spark={sparkMap.get(item.cardId)}
                  copies={copies}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  selected={selectedProp}
                />
              ) : (
                <CardThumbnail
                  card={item}
                  spark={sparkMap.get(item.cardId)}
                  copies={copies}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  selected={selectedProp}
                />
              )}
            </Animated.View>
          );
        }}
        ListFooterComponent={
          // Footer CTAs used to live here, but the primary actions (Scan
          // / Add manually) are now lifted into VaultPageHeader so they
          // — like Robinhood's deposit shortcut — stay reachable without
          // scrolling. We leave a small spacer so the last row doesn't
          // hug the tab bar.
          !isLoading && cards.length > 0 ? <View style={{ height: 24 }} /> : null
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

function ViewModeToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  const p = useThemedPalette();
  const options: { key: ViewMode; Icon: typeof ListIcon; label: string }[] = [
    { key: "list", Icon: ListIcon, label: "List view" },
    { key: "grid", Icon: Grid2x2, label: "Grid view" },
  ];
  // Segmented control. We tried text+icon (overflowed) and tinted
  // icon-only (active state was invisible against the track). This
  // version uses the classic iOS treatment: an inset track with a
  // raised "thumb" pill that contrasts hard against it via the
  // surface color + a shadow. There's no ambiguity about which side
  // is selected.
  const CELL = 34;
  return (
    <View
      style={{
        flexDirection: "row",
        padding: 3,
        borderRadius: 999,
        backgroundColor: withAlpha(p.ink.muted, 0.14),
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
            style={({ pressed }) => ({
              width: CELL,
              height: CELL,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
              backgroundColor: active ? p.bg.elevated : "transparent",
              shadowColor: active ? "#000" : "transparent",
              shadowOpacity: active ? 0.18 : 0,
              shadowRadius: active ? 4 : 0,
              shadowOffset: { width: 0, height: 1 },
              elevation: active ? 2 : 0,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <opt.Icon
              size={16}
              color={active ? p.ink.default : withAlpha(p.ink.muted, 0.85)}
              strokeWidth={active ? 2.6 : 2.1}
            />
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
      <Text
        className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim"
      >
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
 * Replaces `VaultPageHeader` while the user is staging cards for bulk
 * delete. Reads as a "selection mode" affordance the way iOS Mail's
 * trash bar does — Cancel exits without action, the destructive button
 * is colour-coded rose and shows a live count so the user can't
 * accidentally fire off a delete on the wrong number of cards.
 */
function VaultSelectionBar({
  count,
  onCancel,
  onDelete,
  busy,
}: {
  count: number;
  onCancel: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const p = useThemedPalette();
  const canDelete = count > 0 && !busy;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        minHeight: 56,
      }}
    >
      <Pressable
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Cancel selection"
        hitSlop={6}
        style={({ pressed }) => ({
          width: 36,
          height: 36,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 999,
          borderWidth: 1,
          borderColor: p.line.default,
          backgroundColor: p.bg.elevated,
          opacity: pressed ? 0.75 : 1,
        })}
      >
        <X size={18} color={p.ink.default} strokeWidth={2.5} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
          Selecting
        </Text>
        <Text
          className="mt-1 text-2xl font-semibold tracking-tight text-ink"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {count === 1 ? "1 card" : `${count} cards`}
        </Text>
      </View>
      <Pressable
        onPress={canDelete ? onDelete : undefined}
        disabled={!canDelete}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canDelete }}
        accessibilityLabel={`Remove ${count} card${count === 1 ? "" : "s"} from vault`}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 14,
          height: 36,
          borderRadius: 999,
          backgroundColor: canDelete ? p.accent.rose : withAlpha(p.accent.rose, 0.35),
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Trash2 size={15} color="#fff" strokeWidth={2.5} />
        <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>
          {busy ? "Removing…" : "Remove"}
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
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
      <View style={{ flex: 1 }}>
        <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
          Collection
        </Text>
        <Text className="mt-1 text-3xl font-semibold tracking-tight text-ink">
          Vault
        </Text>
      </View>
      {/* Add a card manually — small mint-tinted icon pill. Same target
          size as Sealed so the row reads as a balanced action cluster. */}
      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel="Add a card manually"
        hitSlop={6}
        style={({ pressed }) => ({
          width: 36,
          height: 36,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 999,
          borderWidth: 1,
          borderColor: withAlpha(p.accent.mint, 0.45),
          backgroundColor: withAlpha(p.accent.mint, 0.14),
          opacity: pressed ? 0.75 : 1,
        })}
      >
        <Plus size={18} color={p.accent.mint} strokeWidth={2.5} />
      </Pressable>
      {/* Scan — the high-value primary path. Same icon pill shape. */}
      <Pressable
        onPress={onScan}
        accessibilityRole="button"
        accessibilityLabel="Scan a new card"
        hitSlop={6}
        style={({ pressed }) => ({
          width: 36,
          height: 36,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 999,
          backgroundColor: p.accent.mint,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Camera size={17} color="#fff" strokeWidth={2.5} />
      </Pressable>
      <Pressable
        onPress={onSealed}
        accessibilityRole="button"
        accessibilityLabel="Open sealed vault"
        hitSlop={6}
        style={({ pressed }) => ({
          width: 36,
          height: 36,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 999,
          borderWidth: 1,
          borderColor: withAlpha(p.ink.muted, 0.2),
          backgroundColor: withAlpha(p.ink.muted, 0.1),
          opacity: pressed ? 0.75 : 1,
        })}
      >
        <Package size={17} color={p.ink.default} strokeWidth={2.35} />
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
  stats: {
    holdingCount: number;
    unitCount: number;
    totalCostUsd: number;
    totalEstimatedValueUsd: number | null;
  };
  loading: boolean;
  onOpen: () => void;
  onAdd: () => void;
}) {
  const p = useThemedPalette();
  const { format } = useMoney();
  if (loading) {
    return <Skeleton width="100%" height={78} radius={18} />;
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

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 12,
        borderRadius: 18,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: withAlpha(p.accent.mint, 0.2),
        backgroundColor: p.bg.elevated,
      }}
    >
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel="Open sealed vault"
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          opacity: pressed ? 0.76 : 1,
        })}
      >
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: withAlpha(p.accent.mint, 0.14),
          }}
        >
          <Package size={22} color={p.accent.mint} strokeWidth={2.35} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: p.ink.default, fontSize: 15, fontWeight: "800" }}>
            {headline}
          </Text>
          <Text style={{ color: p.ink.muted, fontSize: 12, fontWeight: "600" }}>
            {detail}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 3 }}>
          <Text
            style={{
              color: p.ink.dim,
              fontSize: 9,
              fontWeight: "800",
              letterSpacing: 1.3,
              textTransform: "uppercase",
            }}
          >
            {valueLabel}
          </Text>
          <Text
            style={{
              color: value != null ? p.ink.default : p.accent.mint,
              fontSize: 14,
              fontWeight: "800",
              fontVariant: ["tabular-nums"],
            }}
          >
            {value != null ? format(value, { compact: false }) : "Open"}
          </Text>
        </View>
      </Pressable>
      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel="Add sealed product"
        hitSlop={6}
        style={({ pressed }) => ({
          width: 38,
          height: 38,
          borderRadius: 19,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: withAlpha(p.accent.mint, 0.16),
          opacity: pressed ? 0.72 : 1,
        })}
      >
        <Plus size={18} color={p.accent.mint} strokeWidth={2.6} />
      </Pressable>
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
