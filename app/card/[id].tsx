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
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Expand,
  Heart,
  Pencil,
  Plus,
} from "lucide-react-native";
import { useCard } from "@/application/queries/catalog/useCard";
import { useCanonicalCard } from "@/application/queries/catalog/useCanonicalCard";
import { useCardMarket } from "@/application/queries/catalog/useCardMarket";
import { useMyGrades } from "@/application/queries/collection/useMyGrades";
import {
  useAddToWatchlist,
  useIsWatching,
  useRemoveFromWatchlist,
} from "@/application/queries/collection/useWatchlist";
import { useAuth } from "@/presentation/providers/AuthProvider";
import type { GradedCard } from "@/infrastructure/http";
import { routes } from "@/shared/routes";
import { PrimaryButton } from "@/presentation/components/PrimaryButton";
import { CardImage } from "@/presentation/components/CardImage";
import { Card3DModal } from "@/presentation/components/Card3DModal";
import { QueryState } from "@/presentation/components/QueryState";
import { PriceAlertSheet } from "@/presentation/features/alerts/PriceAlertSheet";
import { EbaySoldListingsPanel } from "@/presentation/features/market/EbaySoldListingsPanel";
import { CardAttributesPanel } from "@/presentation/features/cardAttributes/CardAttributesPanel";
import {
  GradeSummaryPills,
  MarketplaceChipsRow,
} from "@/presentation/features/cardDetail/CardDetailSections";
import {
  CardDetailsBlock,
  GradeRow,
  HOUSE_LABEL,
  HOUSE_ORDER,
  HouseChip,
  IconBtn,
  LiveListingsSection,
  RecentCompsSection,
  StatTile,
  flattenHouses,
  houseColor,
} from "@/presentation/features/cardDetail/CardDetailParts";
import {
  InteractiveCardChart,
  type CardRangeKey,
} from "@/presentation/features/cardDetail/InteractiveCardChart";
import {
  CardCostBasisStrip,
  CardMarketSignals,
  CardQuickStats,
} from "@/presentation/features/cardDetail/CardInsights";
import {
  CardActiveAlerts,
  RelatedCardsRail,
  SetProgressForCard,
} from "@/presentation/features/cardDetail/CardRelatedSections";
import { SkeletonCardDetailPage } from "@/presentation/components/Skeletons";
import { DataSourcesFooter } from "@/presentation/components/DataSourcesFooter";
import { pickCardBlurhash, pickCardImageUrl } from "@/shared/cardImage";
import { inferBackVariant } from "@/shared/cardBacks";
import { palette, useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import type { HouseId } from "@/infrastructure/http";

// ── Range type lives in InteractiveCardChart now ────────────────────

// ─────────────────────────────────────────────────────────────────────

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cardId = id ?? "";
  const cardQ = useCard(cardId);
  const marketQ = useCardMarket(cardId);
  const canonicalQ = useCanonicalCard(cardId);
  const p = useThemedPalette();
  const { isAuthenticated } = useAuth();
  const myGradesQ = useMyGrades<GradedCard[]>();
  const isWatching = useIsWatching(cardId);
  const addWatch = useAddToWatchlist();
  const removeWatch = useRemoveFromWatchlist();
  const toggleWatch = () => {
    if (!cardId) return;
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

  const [range, setRange] = useState<CardRangeKey>("1Y");
  const [house, setHouse] = useState<HouseId | "all">("all");
  const [selectedGradeLabel, setSelectedGradeLabel] = useState<string | null>(
    null,
  );
  /**
   * When a `GradeRow` is tapped the chart scales to that (house, grade)
   * tier via the backend's drift × multiplier math. `null` = raw market.
   */
  const [chartFilter, setChartFilter] = useState<{
    house: string;
    grade: string;
    label: string;
  } | null>(null);
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

  const rows = useMemo(
    () => flattenHouses(snapshot?.houses ?? [], house),
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
          <ChevronLeft size={18} color={palette.ink.default} />
        </Pressable>
        <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
          Market
        </Text>
        <View className="flex-row gap-2">
          <IconBtn
            label={isWatching ? "Remove from watchlist" : "Save to watchlist"}
            onPress={toggleWatch}
          >
            <Heart
              size={16}
              color={isWatching ? p.accent.rose : p.ink.muted}
              fill={isWatching ? p.accent.rose : "transparent"}
            />
          </IconBtn>
          <IconBtn label="Set price alert" onPress={() => setAlertOpen(true)}>
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
                      backgroundColor: "rgba(0,0,0,0.55)",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.22)",
                    }}
                  >
                    <Expand size={13} color="#fff" strokeWidth={2.5} />
                  </View>
                </Pressable>
                <View style={{ flex: 1, justifyContent: "center", gap: 6 }}>
                  <Text
                    className="text-xl font-semibold text-ink"
                    numberOfLines={2}
                  >
                    {card.name}
                  </Text>
                  <Text className="text-[12px] text-ink-muted" numberOfLines={1}>
                    {card.set_name ?? "—"}
                  </Text>
                  <Text className="text-[11px] text-ink-dim">
                    {[card.year, card.number ? `#${card.number}` : null]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </Text>
                  <Text
                    style={{
                      color: p.ink.dim,
                      fontSize: 10,
                      fontWeight: "800",
                      letterSpacing: 2,
                      marginTop: 6,
                    }}
                  >
                    {(card.tcg ?? "—").toString().toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Add to collection CTA — always the primary green action
                  so users can add another copy (different grade / house).
                  When the card is already owned we surface a tappable
                  subtitle pointing at "Manage" to edit the existing
                  holding(s). */}
              {isAuthenticated ? (
                <View style={{ gap: 8 }}>
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
                  />
                  {ownedCount > 0 ? (
                    <Pressable
                      onPress={() => {
                        if (ownedGrade) {
                          router.push(routes.gradeEdit(ownedGrade.id));
                        }
                      }}
                      hitSlop={8}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                      }}
                    >
                      <Pencil size={11} color={p.ink.muted} />
                      <Text
                        style={{
                          color: p.ink.muted,
                          fontSize: 12,
                          fontWeight: "600",
                        }}
                      >
                        You have {ownedCount} already in the vault
                      </Text>
                      <Text
                        style={{
                          color: p.accent.mint,
                          fontSize: 12,
                          fontWeight: "700",
                        }}
                      >
                        Manage
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

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
                  <Pressable
                    onPress={() => setChartFilter(null)}
                    hitSlop={8}
                  >
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
              <InteractiveCardChart
                history={snapshot?.history}
                range={range}
                onRangeChange={setRange}
                fallbackAmount={snapshot?.summary.pop_top?.amount ?? null}
                cardId={cardId}
                houseFilter={chartFilter?.house}
                gradeFilter={chartFilter?.grade}
                bleedX={20}
              />

              {/* 4b. Market signals row (52w hi/lo, trend, arbitrage,
                  auctions) — renders nothing when no signals fire. */}
              <CardMarketSignals snapshot={snapshot} cardId={cardId} />

              {/* 4c. Owned-card P/L vs purchase price. */}
              <CardCostBasisStrip
                ownedGrade={ownedGrade}
                marketAmount={snapshot?.summary.pop_top?.amount ?? null}
              />

              {/* 5. Quick-stats row (spread, volatility, liquidity,
                  last-sale freshness). */}
              <CardQuickStats snapshot={snapshot} cardId={cardId} />

              {/* Active alerts the user has on this card. */}
              <CardActiveAlerts cardId={cardId} />

              {/* 6. Three-up flat strip (Robinhood Open·High·Low style) */}
              <View style={{ flexDirection: "row", marginHorizontal: -12 }}>
                <StatTile
                  label="Raw"
                  amount={snapshot?.summary.raw?.amount ?? null}
                />
                <StatTile
                  label="Graded Avg"
                  amount={snapshot?.summary.graded_avg?.amount ?? null}
                  showDivider
                />
                <StatTile
                  label="Population"
                  amount={null}
                  text={
                    snapshot?.summary.pop_total
                      ? snapshot.summary.pop_total.toLocaleString()
                      : "—"
                  }
                  showDivider
                />
              </View>

              {/* Marketplace chips — cheapest live price per provider */}
              <MarketplaceChipsRow cardId={cardId} />

              {/* 7. Section header */}
              <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
                Graded Prices
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
                      No graded comps yet
                    </Text>
                  </View>
                ) : (
                  rows.map((r, i) => {
                    const isActive =
                      chartFilter?.house === r.house &&
                      chartFilter?.grade === r.grade_label;
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
                            const houseLabel =
                              HOUSE_LABEL[r.house] ?? r.house.toUpperCase();
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

              {/* Live listings + recent comps (real data, gracefully empty) */}
              <LiveListingsSection cardId={cardId} />
              <RecentCompsSection cardId={cardId} />
              <EbaySoldListingsPanel cardId={cardId} cardName={card?.name ?? null} />

              {/* Set-completion progress for this card's set. */}
              <SetProgressForCard setId={card.set?.id ?? null} />

              {/* Other prints of this card (same name, other sets). */}
              <RelatedCardsRail
                cardId={cardId}
                cardName={card.name}
                tcg={card.tcg}
              />

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
    </SafeAreaView>
  );
}

