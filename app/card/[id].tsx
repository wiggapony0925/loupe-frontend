/**
 * Card detail — `/card/[id]`
 *
 * Unified market screen. Replaces the legacy "hero + pricing card +
 * chart + attributes" stack with the scan/[id] aesthetic merged on top
 * of live `/v1/cards/{id}/market` data:
 *
 *   1. Header bar (back · name · heart/bell)
 *   2. Hero — Robinhood security-detail: overline (set · # · year),
 *      huge name, small art thumb (→ 3D preview)
 *   3. Chart hero (big $ + Δ) + full-bleed line + range pills +
 *      "Advanced" (compare-grades overlay toggle)
 *   4. Trade position (Add to collection · Grade)
 *   6. Three-up RAW / GRADED / POP tiles
 *   7. GRADED PRICES section header
 *   8. House filter chips (ALL · PSA · CGC · BGS · SGC · TAG)
 *   9. House × grade rows (population + market + Δ)
 *  10. Collapsible CARD DETAILS (attributes / set / tags from useCard)
 *
 * Loading state: `<SkeletonCardDetailPage />`. Error: error card with retry.
 */
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { Bell, ChevronDown, ChevronLeft, ChevronUp, Gauge, Heart, Plus } from "lucide-react-native";
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
import { CardValuationPanel } from "@/presentation/features/cardDetail/CardValuationPanel";
import { CardNoteCard } from "@/presentation/features/cardDetail/CardNoteCard";
import { CardAnalyticsSection } from "@/presentation/features/cardDetail/CardAnalyticsSection";
import { PopulationSection } from "@/presentation/features/cardDetail/PopulationSection";
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
  const ownedCount = ownedGrades.length;

  // ── Hold-to-quick-add ────────────────────────────────────────────
  // Press-and-hold on the "Add to collection" CTA drops the card into
  // the vault as a raw NM copy with no form round-trip, then confirms
  // via an auto-dismissing banner. Tapping (not holding) still opens
  // the full form for grade / house / cost-basis entry.
  // Pull-to-refresh. Both queries are refetched together and the spinner is
  // held until BOTH settle — releasing on the first would snap the control
  // away while half the page was still stale.
  const [refreshing, setRefreshing] = useState(false);
  // "More stats · pro view" — market cap, momentum, ATH/ATL, population.
  const [proStatsOpen, setProStatsOpen] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([cardQ.refetch(), marketQ.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [cardQ, marketQ]);

  const createGrade = useCreateGrade();
  const [banner, setBanner] = useState<{
    title: string;
    subtitle?: string;
    tone: "success" | "error";
    /** Holding id from quick-add — opens GradeForm with Apply. */
    gradeId?: string | null;
  } | null>(null);

  const handleQuickAdd = useCallback(() => {
    if (!cardId || createGrade.isPending) return;
    // Quick-add = RAW NM into the vault (All). Backend forces grade=0.
    // Long-press never picks a custom collection — open the form for that.
    createGrade.mutate(
      { cardId, grade: 0, house: "loupe", condition: "nm" },
      {
        onSuccess: (created) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          setBanner({
            title: "Added to vault",
            subtitle: `${cardQ.data?.name ?? "Card"} · Raw · NM`,
            tone: "success",
            gradeId: created?.id ?? null,
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
            gradeId: null,
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
        chartFilter ? { house: chartFilter.house, grade: chartFilter.grade } : { house: "raw" },
      ),
    [chartFilter],
  );
  const compareTiers = comparePresets.filter((c) => compareKeys.includes(c.key));
  const toggleCompare = (key: string) =>
    setCompareKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  // Open by default. The description, artist, set and rarity are the card's
  // identity — collapsing them put the most human content on the page behind
  // a tap most people never made, at the very bottom, under six stat strips.
  // A brokerage shows "About" expanded; the toggle stays for anyone who wants
  // the page shorter.
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [alertOpen, setAlertOpen] = useState(false);
  // Tapping the hero art opens a full-screen 3D-tilt preview (Card3DModal).
  // Lives on the detail screen so re-renders elsewhere don't reset it.
  const [previewOpen, setPreviewOpen] = useState(false);
  // Compare-grades chips are ALWAYS visible — they used to hide behind an
  // "Advanced" pill, which meant the single most useful thing on the chart
  // (PSA vs BGS vs CGC vs raw, overlaid) was invisible unless you went looking
  // for it. The website shows them outright; the app now matches.

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
      Object.values(snapshot?.history ?? {}).some((history) => (history.points ?? []).length >= 2),
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
        // A page whose whole purpose is a live price had no way to ask for a
        // fresh one — the only route was backing out and re-entering. Pull
        // refetches the card and the market snapshot together, so the header
        // price and the chart can't end up from different moments.
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={p.ink.dim}
          />
        }
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
                  style={({ pressed }) => [{
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                    position: "relative",
                    // Soft lift so the art reads as the hero object.
                    shadowColor: "#000",
                    shadowOpacity: 0.18,
                    shadowRadius: 14,
                    shadowOffset: { width: 0, height: 7 },
                  }]}
                >
                  <CardImage
                    uri={imageUrl}
                    blurhash={blurhash}
                    width={128}
                    height={179}
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
                <View style={{ flex: 1, justifyContent: "center", gap: 7 }}>
                  <Text
                    numberOfLines={2}
                    style={{
                      color: p.ink.default,
                      fontSize: 21,
                      lineHeight: 25,
                      fontWeight: "800",
                      letterSpacing: -0.4,
                    }}
                  >
                    {card.name}
                  </Text>

                  {/* Set line — official set symbol when the catalog has one. */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {card.set?.symbol?.url ? (
                      <CardImage
                        uri={card.set.symbol.url}
                        width={13}
                        height={13}
                        rounded={0}
                        contentFit="contain"
                        priority="low"
                        alt=""
                      />
                    ) : null}
                    {/* No placeholder when the catalog has no set: printing "Unknown set" under the title reads as data, when it's actually the absence of it. */}
                    {card.set_name ? (
                      <Text
                      className="text-[12.5px] leading-4 text-ink-muted"
                      numberOfLines={2}
                      ellipsizeMode="tail"
                      style={{ flexShrink: 1 }}
                    >
                      {card.set_name}
                    </Text>
                    ) : null}
                  </View>

                  {/* One quiet metadata line, the way the webapp's hero does
                      it. Four pills of mixed weight (tinted game, rarity,
                      number, year) competed with the title and wrapped to two
                      ragged rows on long rarities — but none of them is an
                      action, so none of them earned a pill. The game keeps its
                      tint as the leading word; the rest reads as one breath. */}
                  <Text style={{ marginTop: 5, fontSize: 12.5, lineHeight: 17 }}>
                    <Text
                      style={{
                        color: heroTcgTint(card.tcg, p),
                        fontWeight: "700",
                      }}
                    >
                      {formatTcgName(card.tcg) ?? "TCG"}
                    </Text>
                    <Text style={{ color: p.ink.muted }}>
                      {[
                        card.rarity,
                        card.number
                          ? card.set?.printed_total
                            ? `#${card.number}/${card.set.printed_total}`
                            : `#${card.number}`
                          : null,
                        card.year ? String(card.year) : null,
                      ]
                        .filter(Boolean)
                        .map((part) => ` · ${part}`)
                        .join("")}
                    </Text>
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
                    {/* Sits beside the mint CTA, so it has to match its
                        height and be a row. Both were being lost: the layout
                        came from a `style={({pressed}) => ({...})}` callback,
                        and a plain object returned from that callback drops
                        its layout props under this project's NativeWind
                        transform — so the icon stacked over the label and the
                        chip shrank away from the green button beside it. */}
                    <Pressable
                      onPress={() => router.push(routes.scanPhone("studio"))}
                      accessibilityRole="button"
                      accessibilityLabel="Grade this card"
                      style={[
                        cardStyles.gradeCta,
                        {
                          borderColor: p.line.default,
                          backgroundColor: p.bg.elevated,
                        },
                      ]}
                    >
                      <Gauge size={16} color={p.ink.default} strokeWidth={2.25} />
                      <Text style={[cardStyles.gradeCtaLabel, { color: p.ink.default }]}>
                        Grade
                      </Text>
                    </Pressable>
                  </View>
                  <Text
                    numberOfLines={2}
                    style={{
                      color: p.ink.default,
                      fontSize: 34,
                      lineHeight: 38,
                      fontWeight: "800",
                      letterSpacing: -0.8,
                    }}
                  >
                    {card.name}
                  </Text>

                  {/* Your own note about this card, right where you land. It
                      used to surface only deep in the ownership section, so
                      the thing you wrote to remember why you bought a card
                      was the last thing you'd see. Renders nothing when
                      there's no note. */}
                  <CardNoteCard cardId={cardId} />
                </View>
                <Pressable
                  onPress={() => setPreviewOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open 3D preview of ${card.name}`}
                  hitSlop={8}
                  style={({ pressed }) => ({
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                    shadowColor: "#000",
                    shadowOpacity: 0.16,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 4 },
                  })}
                >
                  <CardImage
                    uri={imageUrl}
                    blurhash={blurhash}
                    width={52}
                    height={73}
                    rounded={8}
                    contentFit="contain"
                    priority="high"
                    recyclingKey={card.id}
                    alt={card.name}
                  />
                </Pressable>
              </View>

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
                      // Bleed past the screen's 20dp padding so the chips
                      // swipe out under the screen edge (matches the chart).
                      style={{ marginHorizontal: -20 }}
                      contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
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
                              backgroundColor: on ? withAlpha(c.color, 0.16) : "transparent",
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
                    height={280}
                    bleedX={20}
                    onScrubbingChange={handleChartScrubbing}
                  />
                </View>
              ) : (
                <ChartEmptyState
                  title="Price history unavailable"
                  subtitle="Loupe will chart this card once a provider returns real historical points."
                />
              )}

              {/* Trade position — Robinhood puts the CTA under the
                  ranges; Add-to-collection + Grade live here now. */}
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
                      <Text style={{ color: p.ink.default, fontWeight: "700", fontSize: 14 }}>
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

              {/* 4b. Market signals row (52w hi/lo, trend, arbitrage,
                  auctions) — renders nothing when no signals fire. */}
              {hasRealHistory ? <CardMarketSignals snapshot={snapshot} cardId={cardId} /> : null}


              {/* 5. Quick-stats row (spread, volatility, liquidity,
                  last-sale freshness). */}
              {hasRealHistory ? <CardQuickStats snapshot={snapshot} cardId={cardId} /> : null}

              {/* The professional layer, closed by default. Market cap, momentum,
                  all-time range and the population report are for someone
                  doing homework, and stacked open they buried the page — the
                  casual read is the quick-stats row above, and everything
                  else is one tap away. */}
              <Pressable
                onPress={() => setProStatsOpen((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ expanded: proStatsOpen }}
                accessibilityLabel="Toggle advanced market stats"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 4,
                }}
              >
                <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
                  More stats · pro view
                </Text>
                {proStatsOpen ? (
                  <ChevronUp size={16} color={p.ink.muted} />
                ) : (
                  <ChevronDown size={16} color={p.ink.muted} />
                )}
              </Pressable>
              {proStatsOpen ? (
                <>
                  {/* 5b. Derived market analytics — market cap, momentum, volatility,
                  grade premium, ATH/ATL (server-composed; hidden until priced). */}
              <CardAnalyticsSection cardId={cardId} />

              {/* 5c. Population report — graded copies by house/grade from
                  the canonical document; hidden when no pop source. */}
              <PopulationSection
                population={canonicalQ.data?.population}
                certs={canonicalQ.data?.certs}
              />
                </>
              ) : null}

              {/* Active alerts the user has on this card. */}
              <CardActiveAlerts cardId={cardId} />

              {/* 6. Three-up flat strip (Robinhood Open·High·Low style) */}
              {/* Only when it adds something: with no graded avg and no population
                  this was one real number and two em-dashes — a whole row of
                  chrome repeating the price already shown twice above. */}
              {verifiedGradedAvg != null || verifiedPopTotal ? (
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
              ) : null}

              {/* ── YOUR POSITION ──────────────────────────────────────
                  Sits after the market read and before the marketplaces, which
                  is the order the questions actually get asked: what is this
                  card doing → what do I hold → where can I act on it.

                  Position value and the copies behind it are ONE section. They
                  were two, each with its own eyebrow, so the panel stating a
                  number and the list explaining that number read as unrelated
                  parts of the page.

                  Everything here renders nothing without data, so for someone
                  who doesn't own the card this whole region collapses and the
                  page reads market → marketplaces exactly as before. */}
              <CardCostBasisStrip cardId={cardId} />
              <CardValuationPanel cardId={cardId} />
              <CardOwnershipSection
                cardId={cardId}
                cardName={card.name}
                cardImage={imageUrl ?? undefined}
                cardSet={card.set_name ?? undefined}
                cardYear={card.year ?? undefined}
              />


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
                    No graded sales yet
                  </Text>
                  <Text style={{ color: p.ink.muted, fontSize: 12, lineHeight: 18 }}>
                    Grade-by-grade prices appear here as soon as real sales
                    exist — Loupe never shows estimates as if they were sales.
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

              {/* The user's own copies — per-holding grade/acquisition/P-L
                  + rolled-up totals (server-composed; renders nothing for
                  guests/non-owners). Anchored at the bottom of the screen so
                  the market story reads first and the personal ledger closes
                  it out. */}

              {/* 10. About this card — open by default (see `detailsOpen`). */}
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
                  About this card
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
        actionLabel={
          banner?.tone === "success" && banner.gradeId
            ? "Edit"
            : banner?.tone === "error"
              ? "Open form"
              : undefined
        }
        onAction={
          banner?.tone === "success" && banner.gradeId
            ? () => router.push(routes.gradeEdit(banner.gradeId!))
            : banner?.tone === "error" && card
              ? () =>
                  router.push(
                    routes.gradeNew({
                      cardId,
                      cardName: card.name ?? undefined,
                      cardImage: imageUrl ?? undefined,
                      cardSet: card.set_name ?? undefined,
                      cardYear: card.year ?? undefined,
                    }),
                  )
              : undefined
        }
        onHide={() => setBanner(null)}
      />
    </SafeAreaView>
  );
}

/** Brand tint per game — matches the search-row badge colors. */
function heroTcgTint(tcg: string, p: ReturnType<typeof useThemedPalette>): string {
  switch (tcg) {
    case "pokemon":
      return p.accent.amber;
    case "magic":
      return p.accent.blue;
    case "yugioh":
      return p.accent.purple;
    default:
      return p.accent.mint;
  }
}


/**
 * Layout for the card-detail action row.
 *
 * Deliberately a StyleSheet: see the comment at the Grade button. Height is
 * pinned to the mint PrimaryButton beside it (16pt vertical padding + 16pt
 * label) so the pair reads as one control, not a button and an afterthought.
 */
const cardStyles = StyleSheet.create({
  gradeCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 18,
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
  },
  gradeCtaLabel: { fontWeight: "700", fontSize: 14 },
});
