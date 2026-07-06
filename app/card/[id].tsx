/**
 * Card detail — `/card/[id]`
 *
 * Unified market screen. Replaces the legacy "hero + pricing card +
 * chart + attributes" stack with the scan/[id] aesthetic merged on top
 * of live `/v1/cards/{id}/market` data:
 *
 *   1. Header bar (back · MARKET label · heart/bell)
 *   2. Hero strip (small art left · name/set/year right)
 *   3. Big price block (pop_top + change_pct_1y)
 *   4. Sparkline chart (range-driven)
 *   5. Range chips (1D · 1W · 1M · 3M · YTD · 1Y · ALL)
 *   6. Three-up RAW / GRADED / POP tiles
 *   7. GRADED PRICES section header
 *   8. House filter chips (ALL · PSA · CGC · BGS · SGC · TAG)
 *   9. House × grade rows (population + market + Δ)
 *  10. Collapsible CARD DETAILS (attributes / set / tags from useCard)
 *
 * Loading state: `<SkeletonCardDetailPage />`. Error: error card with retry.
 */
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Expand,
  Gauge,
  Heart,
  Plus,
} from "lucide-react-native";
import { useCard } from "@/application/queries/catalog/useCard";
import { useCanonicalCard } from "@/application/queries/catalog/useCanonicalCard";
import { useCardMarket } from "@/application/queries/catalog/useCardMarket";
import { useMyGrades } from "@/application/queries/collection/useMyGrades";
import { useCreateGrade } from "@/application/queries/collection/useGradeMutations";
import {
  useAddToWatchlist,
  useIsWatching,
  useRemoveFromWatchlist,
} from "@/application/queries/collection/useWatchlist";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { usePro } from "@/presentation/features/pro";
import { ApiError } from "@/infrastructure/http/client";
import type { GradedCard } from "@/infrastructure/http";
import { routes } from "@/shared/routes";
import { PrimaryButton } from "@/presentation/components/PrimaryButton";
import { CardImage } from "@/presentation/components/CardImage";
import { Card3DModal } from "@/presentation/components/Card3DModal";
import { QueryState } from "@/presentation/components/QueryState";
import { QuickAddBanner } from "@/presentation/components/QuickAddBanner";
import { PriceAlertSheet } from "@/presentation/features/alerts/PriceAlertSheet";
import { RecentSoldPanel } from "@/presentation/features/market/RecentSoldPanel";
import { CardAttributesPanel } from "@/presentation/features/cardAttributes/CardAttributesPanel";
import { GradeSummaryPills } from "@/presentation/features/cardDetail/CardDetailSections";
import {
  CardDetailsBlock,
  GradeRow,
  HOUSE_LABEL,
  HOUSE_ORDER,
  HouseChip,
  IconBtn,
  LiveListingsSection,
  StatTile,
  flattenHouses,
  formatTcgName,
  houseColor,
} from "@/presentation/features/cardDetail/CardDetailParts";
import { NearbyListingsSection } from "@/presentation/features/cardDetail/NearbyListingsSection";
import { CardPriceChart } from "@/presentation/features/cardDetail/CardPriceChart";
import { ChartEmptyState } from "@/presentation/components/ChartEmptyState";
import { buildComparePresets } from "@/presentation/features/cardDetail/compareTiers";
import {
  CardCostBasisStrip,
  CardMarketSignals,
  CardQuickStats,
} from "@/presentation/features/cardDetail/CardInsights";
import { CardOwnershipSection } from "@/presentation/features/cardDetail/CardOwnershipSection";
import { CardAnalyticsSection } from "@/presentation/features/cardDetail/CardAnalyticsSection";
import {
  CardActiveAlerts,
  RelatedCardsRail,
  SetProgressForCard,
} from "@/presentation/features/cardDetail/CardRelatedSections";
import { SkeletonCardDetailPage } from "@/presentation/components/Skeletons";
import { DataSourcesFooter } from "@/presentation/components/DataSourcesFooter";
import { pickCardBlurhash, pickCardImageUrl } from "@/shared/cardImage";
import { inferBackVariant } from "@/shared/cardBacks";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import type { HouseId } from "@/infrastructure/http";

// ─────────────────────────────────────────────────────────────────────

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cardId = id ?? "";
  const cardQ = useCard(cardId);
  const marketQ = useCardMarket(cardId);
  const canonicalQ = useCanonicalCard(cardId);
  const p = useThemedPalette();
  const { isAuthenticated } = useAuth();
  const { openPaywall } = usePro();
  const navigation = useNavigation();
  // While the user is dragging on the price chart, suspend the
  // navigator's swipe-back gesture so a left→right scrub reveals the
  // price instead of popping back to the previous screen. Re-enabled
  // the instant the finger lifts.
  const handleChartScrubbing = useCallback(
    (active: boolean) => {
      navigation.setOptions({ gestureEnabled: !active });
    },
    [navigation],
  );
  const myGradesQ = useMyGrades<GradedCard[]>();
  const isWatching = useIsWatching(cardId, isAuthenticated);
  const addWatch = useAddToWatchlist();
  const removeWatch = useRemoveFromWatchlist();
  const toggleWatch = () => {
    if (!cardId) return;
    if (!isAuthenticated) {
      router.push("/(auth)/sign-in");
      return;
    }
    if (isWatching) {
      removeWatch.mutate(cardId);
    } else {
      addWatch.mutate(cardId);
    }
  };
  const ownedGrades = useMemo(
    () => (myGradesQ.data ?? []).filter((g) => g.card_id === cardId),
    [myGradesQ.data, cardId],
  );
  const ownedGrade = ownedGrades[0] ?? null;
  const ownedCount = ownedGrades.length;

  // ── Hold-to-quick-add ────────────────────────────────────────────
  // Press-and-hold on the "Add to collection" CTA drops the card into
  // the vault as a raw NM copy with no form round-trip, then confirms
  // via an auto-dismissing banner. Tapping (not holding) still opens
  // the full form for grade / house / cost-basis entry.
  const createGrade = useCreateGrade();
  const [banner, setBanner] = useState<{
    title: string;
    subtitle?: string;
    tone: "success" | "error";
  } | null>(null);

  const handleQuickAdd = useCallback(() => {
    if (!cardId || createGrade.isPending) return;
    createGrade.mutate(
      { cardId, grade: 9, house: "loupe", condition: "nm" },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          setBanner({
            title: "Added to vault",
            subtitle: `${cardQ.data?.name ?? "Card"} · Raw · NM`,
            tone: "success",
          });
        },
        onError: (err) => {
          // Free-tier cap reached → open the Loupe Pro paywall instead of a
          // dead-end error banner. The backend 402 is the source of truth.
          if (err instanceof ApiError && err.status === 402) {
            openPaywall("card_limit");
            return;
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          setBanner({
            title: "Couldn't add to vault",
            subtitle: "Tap to open the full form instead.",
            tone: "error",
          });
        },
      },
    );
  }, [cardId, createGrade, cardQ.data?.name, openPaywall]);

  const [house, setHouse] = useState<HouseId | "all">("all");
  const [selectedGradeLabel, setSelectedGradeLabel] = useState<string | null>(null);
  /**
   * When a `GradeRow` is tapped the chart scales to that (house, grade)
   * tier via the backend's drift × multiplier math. `null` = raw market.
   */
  const [chartFilter, setChartFilter] = useState<{
    house: string;
    grade: string;
    label: string;
  } | null>(null);
  // "Compare grades" — overlay other grading-house lines on the chart. Keys are
  // house ids (so a toggled house stays on as the primary grade changes).
  const [compareKeys, setCompareKeys] = useState<string[]>([]);
  const comparePresets = useMemo(
    () =>
      buildComparePresets(
        chartFilter
          ? { house: chartFilter.house, grade: chartFilter.grade }
          : { house: "raw" },
      ),
    [chartFilter],
  );
  const compareTiers = comparePresets.filter((c) => compareKeys.includes(c.key));
  const toggleCompare = (key: string) =>
    setCompareKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  // Tapping the hero art opens a full-screen 3D-tilt preview (Card3DModal).
  // Lives on the detail screen so re-renders elsewhere don't reset it.
  const [previewOpen, setPreviewOpen] = useState(false);

  const card = cardQ.data;
  const snapshot = marketQ.data?.snapshot;
  const isLoading = cardQ.isLoading || marketQ.isLoading;
  const isError = cardQ.isError || marketQ.isError;

  const imageUrl = pickCardImageUrl(card, "large");
  const blurhash = pickCardBlurhash(card);

  const verifiedGradeRowsAll = useMemo(
    () => flattenHouses(snapshot?.houses ?? [], "all").filter((row) => row.source === "real"),
    [snapshot?.houses],
  );
  const hasVerifiedGradeRows = verifiedGradeRowsAll.length > 0;
  const verifiedGradedAvg = useMemo(() => {
    if (verifiedGradeRowsAll.length === 0) return null;
    const total = verifiedGradeRowsAll.reduce((sum, row) => sum + row.market.amount, 0);
    return total / verifiedGradeRowsAll.length;
  }, [verifiedGradeRowsAll]);
  const verifiedPopTotal = useMemo(() => {
    const total = verifiedGradeRowsAll.reduce(
      (sum, row) => sum + (Number.isFinite(row.population) ? row.population : 0),
      0,
    );
    return total > 0 ? total : null;
  }, [verifiedGradeRowsAll]);
  const verifiedTopAmount = verifiedGradeRowsAll[0]?.market.amount ?? null;
  // Real (non-synthetic) history gates the market signals + quick stats —
  // those are meaningless on a modeled walk.
  const hasRealHistory = useMemo(
    () =>
      Object.values(snapshot?.history ?? {}).some((history) =>
        (history.points ?? []).some((point) => point.source !== "synthetic"),
      ),
    [snapshot?.history],
  );
  // The CHART, though, renders on ANY history (incl. the modeled walk) — same
  // as the web, which always charts the series. Only truly-empty history shows
  // the "unavailable" note.
  const hasAnyHistory = useMemo(
    () =>
      Object.values(snapshot?.history ?? {}).some(
        (history) => (history.points ?? []).length >= 2,
      ),
    [snapshot?.history],
  );
  const rows = useMemo(
    () => flattenHouses(snapshot?.houses ?? [], house).filter((row) => row.source === "real"),
    [snapshot?.houses, house],
  );

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-bg">
      {/* 1. Header */}
      <View className="flex-row items-center justify-between px-4 pb-2 pt-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="h-9 w-9 items-center justify-center rounded-full border border-line bg-bg-elevated"
        >
          <ChevronLeft size={18} color={p.ink.default} />
        </Pressable>
        {/* Contextual title — reflects the card you're viewing once it
            loads (falls back to a neutral label while the catalog row is
            still in flight) instead of a generic "MARKET" eyebrow. */}
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            marginHorizontal: 12,
            textAlign: "center",
            color: card ? p.ink.default : p.ink.dim,
            fontSize: card ? 14 : 10,
            fontWeight: card ? "700" : "600",
            letterSpacing: card ? 0 : 3,
            textTransform: card ? "none" : "uppercase",
          }}
        >
          {card?.name ?? "Market"}
        </Text>
        <View className="flex-row gap-2">
          <IconBtn label={isWatching ? "Remove favorite" : "Save favorite"} onPress={toggleWatch}>
            <Heart
              size={16}
              color={isWatching ? p.accent.rose : p.ink.muted}
              fill={isWatching ? p.accent.rose : "transparent"}
            />
          </IconBtn>
          <IconBtn
            label={isAuthenticated ? "Set price alert" : "Sign in to set price alert"}
            onPress={() => {
              if (!isAuthenticated) {
                router.push("/(auth)/sign-in");
                return;
              }
              setAlertOpen(true);
            }}
          >
            <Bell size={16} color={p.ink.muted} />
          </IconBtn>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 64,
          gap: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <QueryState
          isLoading={isLoading}
          isError={isError}
          isEmpty={!isLoading && !isError && !card}
          loadingFallback={<SkeletonCardDetailPage />}
          errorMessage="Couldn't load market"
          emptyTitle="Card not found"
          emptyMessage="The catalog returned no match for this id."
          onRetry={() => {
            void cardQ.refetch();
            void marketQ.refetch();
          }}
        >
          {card ? (
            <>
              {/* 2. Hero strip */}
              <View style={{ flexDirection: "row", gap: 16 }}>
                <Pressable
                  onPress={() => setPreviewOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open 3D preview of ${card.name}`}
                  hitSlop={6}
                  style={({ pressed }) => ({
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                    position: "relative",
                  })}
                >
                  <CardImage
                    uri={imageUrl}
                    blurhash={blurhash}
                    width={120}
                    height={168}
                    rounded={14}
                    contentFit="contain"
                    priority="high"
                    recyclingKey={card.id}
                    alt={card.name}
                  />
                  {/* Expand affordance — small icon pill in the top-right
                      so the user knows tapping the art opens a bigger,
                      tilt-enabled preview rather than navigating away. */}
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      width: 26,
                      height: 26,
                      borderRadius: 999,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: withAlpha(p.bg.base, 0.78),
                      borderWidth: 1,
                      borderColor: withAlpha(p.ink.default, 0.18),
                    }}
                  >
                    <Expand size={13} color={p.ink.default} strokeWidth={2.5} />
                  </View>
                </Pressable>
                <View style={{ flex: 1, justifyContent: "center", gap: 6 }}>
                  <Text className="text-xl font-semibold text-ink" numberOfLines={2}>
                    {card.name}
                  </Text>
                  <Text
                    className="text-[12px] leading-4 text-ink-muted"
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    {card.set_name ?? "Unknown set"}
                  </Text>
                  <Text className="text-[11px] text-ink-dim" numberOfLines={1}>
                    {[card.year, card.number ? `#${card.number}` : null]
                      .filter(Boolean)
                      .join(" · ") || "Card details pending"}
                  </Text>
                  <Text
                    style={{
                      color: p.ink.dim,
                      fontSize: 10,
                      fontWeight: "800",
                      letterSpacing: 1,
                      marginTop: 6,
                    }}
                    numberOfLines={1}
                  >
                    {formatTcgName(card.tcg) ?? "Trading card"}
                  </Text>
                </View>
              </View>

              {/* Action row — Robinhood-style side-by-side pair: the primary
                  "Add" CTA plus a compact "Grade" companion (pre-screen the
                  grade before slabbing). Replaces the old stacked purple
                  banner that dominated the fold. */}
              {isAuthenticated ? (
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <PrimaryButton
                        label="Add to collection"
                        icon={Plus}
                        variant="mint"
                        onPress={() => {
                          router.push(
                            routes.gradeNew({
                              cardId,
                              cardName: card.name,
                              cardImage: imageUrl ?? undefined,
                              cardSet: card.set_name ?? undefined,
                              cardYear: card.year ?? undefined,
                            }),
                          );
                        }}
                        onLongPress={handleQuickAdd}
                        accessibilityLabel="Add to collection. Press and hold to quick-add as a raw card."
                      />
                    </View>
                    <Pressable
                      onPress={() => router.push(routes.scanPhone("studio"))}
                      accessibilityRole="button"
                      accessibilityLabel="Grade this card"
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        paddingHorizontal: 18,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: p.line.default,
                        backgroundColor: p.bg.elevated,
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <Gauge size={16} color={p.ink.default} strokeWidth={2.25} />
                      <Text
                        style={{ color: p.ink.default, fontWeight: "700", fontSize: 14 }}
                      >
                        Grade
                      </Text>
                    </Pressable>
                  </View>
                  <Text
                    style={{
                      color: p.ink.dim,
                      fontSize: 11,
                      fontWeight: "600",
                      textAlign: "center",
                    }}
                  >
                    Hold to quick-add as Raw · NM
                    {ownedCount > 0
                      ? ` · ${ownedCount} ${ownedCount === 1 ? "copy" : "copies"} in your vault`
                      : ""}
                  </Text>
                </View>
              ) : (
                /* Guests previously saw no add/track affordance in the body
                   (the whole action block was auth-gated), leaving the card
                   a dead end. Surface a clear sign-in CTA instead. */
                <View style={{ gap: 8 }}>
                  <PrimaryButton
                    label="Sign in to add & track"
                    icon={Plus}
                    variant="mint"
                    onPress={() => router.push("/(auth)/sign-in")}
                    accessibilityLabel="Sign in to add this card to your collection"
                  />
                  <Text
                    style={{
                      color: p.ink.dim,
                      fontSize: 11,
                      fontWeight: "600",
                      textAlign: "center",
                    }}
                  >
                    Track its price, set alerts, and build your vault.
                  </Text>
                </View>
              )}

              {/* 3. (BigPrice removed — chart hero already shows live
                  $/Δ, Robinhood-style.) */}

              {/* 4. Interactive chart + range pills */}
              {chartFilter ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    alignSelf: "flex-start",
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: p.line.default,
                    backgroundColor: withAlpha(p.accent.mint, 0.12),
                  }}
                >
                  <Text
                    style={{
                      color: p.ink.default,
                      fontSize: 11,
                      fontWeight: "700",
                      letterSpacing: 0.6,
                    }}
                  >
                    Showing {chartFilter.label}
                  </Text>
                  <Pressable onPress={() => setChartFilter(null)} hitSlop={8}>
                    <Text
                      style={{
                        color: p.ink.muted,
                        fontSize: 11,
                        fontWeight: "700",
                      }}
                    >
                      Clear ×
                    </Text>
                  </Pressable>
                </View>
              ) : null}
              {hasAnyHistory ? (
                <View style={{ gap: 12 }}>
                  {/* Compare grades — overlay other grading houses' price lines
                      so PSA vs BGS vs CGC vs raw read at a glance (web parity). */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingRight: 8 }}
                  >
                    <Text
                      style={{
                        color: p.ink.dim,
                        fontSize: 11,
                        fontWeight: "700",
                        alignSelf: "center",
                        marginRight: 2,
                      }}
                    >
                      Compare
                    </Text>
                    {comparePresets.map((c) => {
                      const on = compareKeys.includes(c.key);
                      return (
                        <Pressable
                          key={c.key}
                          onPress={() => toggleCompare(c.key)}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: on ? c.color : p.line.default,
                            backgroundColor: on
                              ? withAlpha(c.color, 0.16)
                              : "transparent",
                          }}
                        >
                          <View
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: c.color,
                            }}
                          />
                          <Text
                            style={{
                              color: on ? c.color : p.ink.muted,
                              fontSize: 12,
                              fontWeight: "700",
                            }}
                          >
                            {c.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  <CardPriceChart
                    history={snapshot?.history}
                    cardId={cardId}
                    houseFilter={chartFilter?.house}
                    gradeFilter={chartFilter?.grade}
                    compare={compareTiers}
                    defaultRange="1Y"
                    onScrubbingChange={handleChartScrubbing}
                  />
                </View>
              ) : (
                <ChartEmptyState
                  title="Price history unavailable"
                  subtitle="Loupe will chart this card once a provider returns real historical points."
                />
              )}

              {/* 4b. Market signals row (52w hi/lo, trend, arbitrage,
                  auctions) — renders nothing when no signals fire. */}
              {hasRealHistory ? <CardMarketSignals snapshot={snapshot} cardId={cardId} /> : null}

              {/* 4c. Owned-card P/L vs purchase price. */}
              <CardCostBasisStrip
                ownedGrade={ownedGrade}
                marketAmount={verifiedTopAmount ?? snapshot?.summary.raw?.amount ?? null}
              />

              {/* 4d. The user's own copies — per-holding grade/acquisition/P-L
                  + rolled-up totals (server-composed; renders nothing for
                  guests/non-owners). */}
              <CardOwnershipSection cardId={cardId} />

              {/* 5. Quick-stats row (spread, volatility, liquidity,
                  last-sale freshness). */}
              {hasRealHistory ? <CardQuickStats snapshot={snapshot} cardId={cardId} /> : null}

              {/* 5b. Derived market analytics — market cap, momentum, volatility,
                  grade premium, ATH/ATL (server-composed; hidden until priced). */}
              <CardAnalyticsSection cardId={cardId} />

              {/* Active alerts the user has on this card. */}
              <CardActiveAlerts cardId={cardId} />

              {/* 6. Three-up flat strip (Robinhood Open·High·Low style) */}
              <View style={{ flexDirection: "row", marginHorizontal: -12 }}>
                <StatTile label="Raw" amount={snapshot?.summary.raw?.amount ?? null} />
                <StatTile label="Graded Avg" amount={verifiedGradedAvg} showDivider />
                <StatTile
                  label="Population"
                  amount={null}
                  text={verifiedPopTotal ? verifiedPopTotal.toLocaleString() : "—"}
                  showDivider
                />
              </View>

              {/* Real marketplace data + sold comps. */}
              <LiveListingsSection cardId={cardId} card={card} />
              {/* Facebook Marketplace listings near the user (location-gated). */}
              <NearbyListingsSection cardId={cardId} card={card} />
              <RecentSoldPanel cardId={cardId} cardName={card?.name ?? null} />

              {hasVerifiedGradeRows ? (
                <>
                  {/* 7. Section header */}
                  <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
                    Verified Graded Prices
                  </Text>

                  {/* Price-by-grade pivot pills */}
                  <GradeSummaryPills
                    cardId={cardId}
                    value={selectedGradeLabel}
                    onChange={setSelectedGradeLabel}
                  />

                  {/* 8. House filter tabs (Robinhood-style underline) */}
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 18,
                      flexWrap: "wrap",
                      borderBottomWidth: 1,
                      borderBottomColor: withAlpha(p.line.default, 0.6),
                    }}
                  >
                    <HouseChip
                      id="all"
                      label="ALL"
                      active={house === "all"}
                      onPress={() => setHouse("all")}
                    />
                    {HOUSE_ORDER.map((h) => (
                      <HouseChip
                        key={h}
                        id={h}
                        label={HOUSE_LABEL[h] ?? h.toUpperCase()}
                        color={houseColor(h, p)}
                        active={house === h}
                        onPress={() => setHouse(h)}
                      />
                    ))}
                  </View>

                  {/* 9. House × grade rows — flat, hairlines only */}
                  <View>
                    {rows.length === 0 ? (
                      <View style={{ paddingVertical: 16, alignItems: "center" }}>
                        <Text className="text-[12px] text-ink-muted">
                          No verified comps for this house
                        </Text>
                      </View>
                    ) : (
                      rows.map((r, i) => {
                        const isActive =
                          chartFilter?.house === r.house && chartFilter?.grade === r.grade_label;
                        return (
                          <GradeRow
                            key={`${r.house}-${r.grade_label}-${i}`}
                            row={r}
                            isLast={i === rows.length - 1}
                            active={isActive}
                            onPress={() => {
                              if (isActive) {
                                setChartFilter(null);
                              } else {
                                const houseLabel = HOUSE_LABEL[r.house] ?? r.house.toUpperCase();
                                setChartFilter({
                                  house: r.house,
                                  grade: r.grade_label,
                                  label: `${houseLabel} ${r.grade_label}`,
                                });
                              }
                            }}
                          />
                        );
                      })
                    )}
                  </View>
                </>
              ) : (
                <View
                  style={{
                    borderTopWidth: 1,
                    borderBottomWidth: 1,
                    borderColor: withAlpha(p.line.default, 0.72),
                    paddingVertical: 16,
                    gap: 4,
                  }}
                >
                  <Text style={{ color: p.ink.default, fontSize: 14, fontWeight: "800" }}>
                    No verified graded comps yet
                  </Text>
                  <Text style={{ color: p.ink.muted, fontSize: 12, lineHeight: 18 }}>
                    Loupe is hiding estimated grade rows until a sold-comp provider returns real
                    data.
                  </Text>
                </View>
              )}

              {/* Set-completion progress for this card's set. */}
              <SetProgressForCard setId={card.set?.id ?? null} />

              {/* Other prints of this card (same name, other sets). */}
              <RelatedCardsRail cardId={cardId} cardName={card.name} tcg={card.tcg} />

              {/* Per-game attribute panel — Pokédex / MTG oracle / YGO stats.
                  Driven by the canonical card document; renders nothing for
                  TCGs without a registered panel or when attributes are
                  missing. See `CardAttributesPanel` for the registry. */}
              <CardAttributesPanel canonical={canonicalQ.data} />

              {/* 10. Collapsible card details — flat header */}
              <Pressable
                onPress={() => setDetailsOpen((v) => !v)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 14,
                  borderTopWidth: 1,
                  borderTopColor: withAlpha(p.line.default, 0.6),
                }}
              >
                <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
                  Card Details
                </Text>
                {detailsOpen ? (
                  <ChevronUp size={16} color={p.ink.muted} />
                ) : (
                  <ChevronDown size={16} color={p.ink.muted} />
                )}
              </Pressable>
              {detailsOpen ? <CardDetailsBlock card={card} /> : null}
              <DataSourcesFooter />
            </>
          ) : null}
        </QueryState>
      </ScrollView>
      <PriceAlertSheet
        cardId={cardId}
        cardName={card?.name ?? null}
        currentPriceUsd={snapshot?.summary.pop_top?.amount ?? null}
        visible={alertOpen}
        onClose={() => setAlertOpen(false)}
      />
      <Card3DModal
        visible={previewOpen}
        onClose={() => setPreviewOpen(false)}
        imageUri={imageUrl}
        blurhash={blurhash}
        title={card?.name}
        subtitle={card?.set_name ?? undefined}
        recyclingKey={card?.id}
        backVariant={inferBackVariant(card ?? null)}
      />
      <QuickAddBanner
        visible={banner != null}
        title={banner?.title ?? ""}
        subtitle={banner?.subtitle}
        tone={banner?.tone ?? "success"}
        actionLabel={banner?.tone === "success" && ownedGrade ? "View" : undefined}
        onAction={
          banner?.tone === "success" && ownedGrade
            ? () => router.push(routes.gradeEdit(ownedGrade.id))
            : undefined
        }
        onHide={() => setBanner(null)}
      />
    </SafeAreaView>
  );
}
