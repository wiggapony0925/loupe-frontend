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
  Heart,
  Pencil,
  Plus,
} from "lucide-react-native";
import { useCard } from "@/application/queries/catalog/useCard";
import { useCanonicalCard } from "@/application/queries/catalog/useCanonicalCard";
import { useCardMarket } from "@/application/queries/catalog/useCardMarket";
import { useMyGrades } from "@/application/queries/collection/useMyGrades";
import { useAuth } from "@/presentation/providers/AuthProvider";
import type { GradedCard } from "@/infrastructure/http";
import { routes } from "@/shared/routes";
import { PrimaryButton } from "@/presentation/components/PrimaryButton";
import { CardImage } from "@/presentation/components/CardImage";
import { Price } from "@/presentation/components/Price";
import { QueryState } from "@/presentation/components/QueryState";
import { PriceAlertSheet } from "@/presentation/features/alerts/PriceAlertSheet";
import { EbaySoldListingsPanel } from "@/presentation/features/market/EbaySoldListingsPanel";
import { CardAttributesPanel } from "@/presentation/features/cardAttributes/CardAttributesPanel";
import {
  GradeSummaryPills,
  MarketplaceChipsRow,
} from "@/presentation/features/cardDetail/CardDetailSections";
import {
  BigPrice,
  CardDetailsBlock,
  GradeRow,
  HOUSE_LABEL,
  HOUSE_ORDER,
  HouseChip,
  IconBtn,
  LiveListingsSection,
  RecentCompsSection,
  Sparkline,
  StatTile,
  flattenHouses,
  houseColor,
} from "@/presentation/features/cardDetail/CardDetailParts";
import { SkeletonCardDetailPage } from "@/presentation/components/Skeletons";
import { DataSourcesFooter } from "@/presentation/components/DataSourcesFooter";
import { pickCardBlurhash, pickCardImageUrl } from "@/shared/cardImage";
import { palette, useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import type {
  HouseGradeRowWire,
  HouseId,
  MarketSnapshotWire,
  PriceHistoryWire,
} from "@/infrastructure/http";

// ── Range chips → backend history keys ────────────────────────────────
type RangeKey = "1D" | "1W" | "1M" | "3M" | "YTD" | "1Y" | "ALL";

const RANGE_TO_HISTORY: Record<RangeKey, keyof MarketSnapshotWire["history"] | null> = {
  "1D": null, // not available yet
  "1W": null,
  "1M": "30d",
  "3M": "90d",
  YTD: "1y",
  "1Y": "1y",
  ALL: "all",
};

const RANGE_KEYS: RangeKey[] = ["1D", "1W", "1M", "3M", "YTD", "1Y", "ALL"];

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
  const ownedGrade = useMemo(
    () => (myGradesQ.data ?? []).find((g) => g.card_id === cardId) ?? null,
    [myGradesQ.data, cardId],
  );

  const [range, setRange] = useState<RangeKey>("1Y");
  const [house, setHouse] = useState<HouseId | "all">("all");
  const [selectedGradeLabel, setSelectedGradeLabel] = useState<string | null>(
    null,
  );
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);

  const card = cardQ.data;
  const snapshot = marketQ.data?.snapshot;
  const isLoading = cardQ.isLoading || marketQ.isLoading;
  const isError = cardQ.isError || marketQ.isError;

  const imageUrl = pickCardImageUrl(card, "large");
  const blurhash = pickCardBlurhash(card);

  const historyKey = RANGE_TO_HISTORY[range];
  const historySeries: PriceHistoryWire | undefined = historyKey
    ? snapshot?.history?.[historyKey]
    : undefined;

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
          <IconBtn label="Save to watchlist">
            <Heart size={16} color={p.ink.muted} />
          </IconBtn>
          <IconBtn label="Set price alert" onPress={() => setAlertOpen(true)}>
            <Bell size={16} color={p.ink.muted} />
          </IconBtn>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 64, gap: 24 }}
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
                  <View
                    style={{
                      alignSelf: "flex-start",
                      paddingHorizontal: 10,
                      paddingVertical: 3,
                      borderRadius: 999,
                      backgroundColor: withAlpha(p.accent.mint, 0.14),
                      marginTop: 4,
                    }}
                  >
                    <Text
                      style={{
                        color: p.accent.mint,
                        fontSize: 10,
                        fontWeight: "800",
                        letterSpacing: 1,
                      }}
                    >
                      {(card.tcg ?? "—").toString().toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Add to vault / Edit holding CTA */}
              {isAuthenticated ? (
                <PrimaryButton
                  label={
                    ownedGrade ? "Edit holding" : "Add to collection"
                  }
                  icon={ownedGrade ? Pencil : Plus}
                  variant={ownedGrade ? "ghost" : "mint"}
                  onPress={() => {
                    if (ownedGrade) {
                      router.push(routes.gradeEdit(ownedGrade.id));
                    } else {
                      router.push(
                        routes.gradeNew({
                          cardId,
                          cardName: card.name,
                          cardImage: imageUrl ?? undefined,
                          cardSet: card.set_name ?? undefined,
                          cardYear: card.year ?? undefined,
                        }),
                      );
                    }
                  }}
                />
              ) : null}

              {/* 3. Big price */}
              <BigPrice
                amount={snapshot?.summary.pop_top?.amount ?? null}
                changePct={snapshot?.summary.change_pct_1y ?? null}
                subLabel="PSA 10 · last 12 months"
              />

              {/* 4. Sparkline */}
              <Sparkline
                points={historySeries?.points.map((pt) => pt.price) ?? []}
                changePct={historySeries?.summary?.change_pct ?? null}
                disabled={historyKey === null}
              />

              {/* 5. Range chips */}
              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                {RANGE_KEYS.map((k) => {
                  const active = range === k;
                  const disabled = RANGE_TO_HISTORY[k] === null;
                  return (
                    <Pressable
                      key={k}
                      disabled={disabled}
                      onPress={() => setRange(k)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: active ? p.accent.mint : p.line.default,
                        backgroundColor: active
                          ? withAlpha(p.accent.mint, 0.15)
                          : "transparent",
                        opacity: disabled ? 0.35 : 1,
                      }}
                    >
                      <Text
                        style={{
                          color: active ? p.accent.mint : p.ink.muted,
                          fontSize: 10,
                          fontWeight: "800",
                          letterSpacing: 0.6,
                        }}
                      >
                        {k}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* 6. Three-up tiles */}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <StatTile
                  label="Raw"
                  amount={snapshot?.summary.raw?.amount ?? null}
                />
                <StatTile
                  label="Graded Avg"
                  amount={snapshot?.summary.graded_avg?.amount ?? null}
                />
                <StatTile
                  label="Population"
                  amount={null}
                  text={
                    snapshot?.summary.pop_total
                      ? snapshot.summary.pop_total.toLocaleString()
                      : "—"
                  }
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

              {/* 8. House filter chips */}
              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
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

              {/* 9. House × grade rows */}
              <View
                style={{
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: p.line.default,
                  backgroundColor: p.bg.elevated,
                  overflow: "hidden",
                }}
              >
                {rows.length === 0 ? (
                  <View style={{ padding: 16, alignItems: "center" }}>
                    <Text className="text-[12px] text-ink-muted">
                      No graded comps yet
                    </Text>
                  </View>
                ) : (
                  rows.map((r, i) => (
                    <GradeRow
                      key={`${r.house}-${r.grade_label}-${i}`}
                      row={r}
                      isLast={i === rows.length - 1}
                    />
                  ))
                )}
              </View>

              {/* Live listings + recent comps (real data, gracefully empty) */}
              <LiveListingsSection cardId={cardId} />
              <RecentCompsSection cardId={cardId} />
              <EbaySoldListingsPanel cardId={cardId} cardName={card?.name ?? null} />

              {/* Per-game attribute panel — Pokédex / MTG oracle / YGO stats.
                  Driven by the canonical card document; renders nothing for
                  TCGs without a registered panel or when attributes are
                  missing. See `CardAttributesPanel` for the registry. */}
              <CardAttributesPanel canonical={canonicalQ.data} />

              {/* 10. Collapsible card details */}
              <Pressable
                onPress={() => setDetailsOpen((v) => !v)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: p.line.default,
                  backgroundColor: p.bg.elevated,
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
    </SafeAreaView>
  );
}

