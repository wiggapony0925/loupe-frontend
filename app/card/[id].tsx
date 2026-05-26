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
import {
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import Svg, { Polyline } from "react-native-svg";
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Heart,
} from "lucide-react-native";
import { useCard } from "@/application/queries/catalog/useCard";
import { useCardMarket } from "@/application/queries/catalog/useCardMarket";
import { useCardListings } from "@/application/queries/catalog/useCardListings";
import { useCardComps } from "@/application/queries/catalog/useCardComps";
import { useMyGrades } from "@/application/queries/collection/useMyGrades";
import { useAuth } from "@/presentation/providers/AuthProvider";
import type { GradedCard } from "@/infrastructure/http";
import { routes } from "@/shared/routes";
import { PrimaryButton } from "@/presentation/components/PrimaryButton";
import { Plus, Pencil } from "lucide-react-native";
import { CardImage } from "@/presentation/components/CardImage";
import { Price } from "@/presentation/components/Price";
import { QueryState } from "@/presentation/components/QueryState";
import { PriceAlertSheet } from "@/presentation/features/alerts/PriceAlertSheet";
import { EbaySoldListingsPanel } from "@/presentation/features/market/EbaySoldListingsPanel";
import {
  GradeSummaryPills,
  MarketplaceChipsRow,
} from "@/presentation/features/cardDetail/CardDetailSections";
import {
  SkeletonCardDetailPage,
  SkeletonCompsList,
  SkeletonListingsRail,
} from "@/presentation/components/Skeletons";
import { DataSourcesFooter } from "@/presentation/components/DataSourcesFooter";
import { pickCardBlurhash, pickCardImageUrl } from "@/shared/cardImage";
import { palette, useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import type {
  HouseBlockWire,
  HouseGradeRowWire,
  HouseId,
  ListingWire,
  MarketSnapshotWire,
  PriceHistoryWire,
  SoldCompWire,
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

// ── House palette (one source of truth) ───────────────────────────────
const HOUSE_LABEL: Record<string, string> = {
  psa: "PSA",
  cgc: "CGC",
  bgs: "BGS",
  sgc: "SGC",
  tag: "TAG",
};
const HOUSE_ORDER: HouseId[] = ["psa", "cgc", "bgs", "sgc", "tag"];

function houseColor(house: string, p: ReturnType<typeof useThemedPalette>) {
  switch (house) {
    case "psa":
      return p.accent.mint;
    case "cgc":
      return p.accent.blue;
    case "bgs":
      return p.accent.amber;
    case "sgc":
      return p.accent.purple;
    case "tag":
      return p.ink.default;
    default:
      return p.ink.muted;
  }
}

// ─────────────────────────────────────────────────────────────────────

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cardId = id ?? "";
  const cardQ = useCard(cardId);
  const marketQ = useCardMarket(cardId);
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

// ─── Sub-components ────────────────────────────────────────────────────

function IconBtn({
  children,
  label,
  onPress,
}: {
  children: React.ReactNode;
  label?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      className="h-9 w-9 items-center justify-center rounded-full border border-line bg-bg-elevated"
    >
      {children}
    </Pressable>
  );
}

function BigPrice({
  amount,
  changePct,
  subLabel,
}: {
  amount: number | null;
  changePct: number | null;
  subLabel: string;
}) {
  const p = useThemedPalette();
  const positive = (changePct ?? 0) >= 0;
  const color = positive ? p.accent.mint : p.accent.rose;
  return (
    <View>
      {amount !== null ? (
        <Price usd={amount} className="text-5xl font-bold text-ink" />
      ) : (
        <Text className="text-5xl font-bold text-ink-muted">—</Text>
      )}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
        {changePct !== null ? (
          <Text style={{ color, fontSize: 13, fontWeight: "700" }}>
            {positive ? "+" : ""}
            {changePct.toFixed(2)}%
          </Text>
        ) : null}
        <Text className="text-[11px] text-ink-dim">{subLabel}</Text>
      </View>
    </View>
  );
}

function Sparkline({
  points,
  changePct,
  disabled,
}: {
  points: number[];
  changePct: number | null;
  disabled: boolean;
}) {
  const p = useThemedPalette();
  const W = 320;
  const H = 140;
  const PAD = 8;

  if (disabled) {
    return (
      <View
        style={{
          height: H,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: p.line.default,
          backgroundColor: p.bg.elevated,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text className="text-[11px] text-ink-dim">
          Intraday history coming soon
        </Text>
      </View>
    );
  }

  if (points.length < 2) {
    return (
      <View
        style={{
          height: H,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: p.line.default,
          backgroundColor: p.bg.elevated,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text className="text-[11px] text-ink-muted">No history available</Text>
      </View>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stride = (W - PAD * 2) / (points.length - 1);
  const coords = points
    .map(
      (v, i) =>
        `${PAD + i * stride},${H - PAD - ((v - min) / range) * (H - PAD * 2)}`,
    )
    .join(" ");

  const positive = (changePct ?? 0) >= 0;
  const color = positive ? p.accent.mint : p.accent.rose;

  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: p.line.default,
        backgroundColor: p.bg.elevated,
        padding: 12,
      }}
    >
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Polyline
          points={coords}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: 6,
        }}
      >
        <Text className="text-[10px] text-ink-dim">
          ${min.toFixed(2)} – ${max.toFixed(2)}
        </Text>
        {changePct !== null ? (
          <Text style={{ color, fontSize: 11, fontWeight: "700" }}>
            {positive ? "+" : ""}
            {changePct.toFixed(2)}%
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function StatTile({
  label,
  amount,
  text,
}: {
  label: string;
  amount: number | null;
  text?: string;
}) {
  const p = useThemedPalette();
  return (
    <View
      style={{
        flex: 1,
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: p.line.default,
        backgroundColor: p.bg.elevated,
        gap: 4,
      }}
    >
      <Text className="text-[10px] uppercase tracking-wider text-ink-dim">
        {label}
      </Text>
      {amount !== null ? (
        <Price usd={amount} className="text-base font-semibold text-ink" />
      ) : (
        <Text className="text-base font-semibold text-ink">{text ?? "—"}</Text>
      )}
    </View>
  );
}

function HouseChip({
  id,
  label,
  color,
  active,
  onPress,
}: {
  id: string;
  label: string;
  color?: string;
  active: boolean;
  onPress: () => void;
}) {
  const p = useThemedPalette();
  const accent = color ?? p.ink.default;
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? accent : p.line.default,
        backgroundColor: active ? withAlpha(accent, 0.16) : "transparent",
      }}
      accessibilityLabel={`Filter by ${id}`}
    >
      <Text
        style={{
          color: active ? accent : p.ink.muted,
          fontSize: 10,
          fontWeight: "800",
          letterSpacing: 0.6,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function GradeRow({
  row,
  isLast,
}: {
  row: HouseGradeRowWire;
  isLast: boolean;
}) {
  const p = useThemedPalette();
  const accent = houseColor(row.house, p);
  const positive = row.change_pct >= 0;
  const changeColor = positive ? p.accent.mint : p.accent.rose;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 10,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: p.line.default,
      }}
    >
      <View
        style={{
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: withAlpha(accent, 0.18),
          minWidth: 56,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            color: accent,
            fontSize: 10,
            fontWeight: "800",
            letterSpacing: 0.6,
          }}
        >
          {HOUSE_LABEL[row.house] ?? row.house.toUpperCase()} {row.grade_label}
        </Text>
      </View>
      <Text className="text-[11px] text-ink-muted">
        {row.population.toLocaleString()} pop
      </Text>
      <View style={{ flex: 1 }} />
      {row.source === "synthesized" ? (
        <View
          style={{
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 999,
            backgroundColor: p.bg.base,
            borderWidth: 1,
            borderColor: p.line.default,
          }}
        >
          <Text style={{ color: p.ink.dim, fontSize: 9, fontWeight: "700" }}>
            est
          </Text>
        </View>
      ) : null}
      <Text style={{ color: changeColor, fontSize: 11, fontWeight: "700" }}>
        {positive ? "+" : ""}
        {row.change_pct.toFixed(1)}%
      </Text>
      <Price usd={row.market.amount} className="text-sm font-semibold text-ink" />
    </View>
  );
}

function CardDetailsBlock({
  card,
}: {
  card: import("@/infrastructure/http").CardSearchResult;
}) {
  const p = useThemedPalette();
  const rows: { label: string; value: string }[] = [];
  const push = (label: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === "") return;
    rows.push({ label, value: String(value) });
  };
  push("Number", card.number);
  push("Rarity", card.rarity);
  push("Year", card.year);
  push("Set", card.set_name);
  push("TCG", card.tcg);
  push("Source", card.source);

  return (
    <View style={{ gap: 14 }}>
      <View
        style={{
          borderRadius: 14,
          borderWidth: 1,
          borderColor: p.line.default,
          backgroundColor: p.bg.elevated,
          overflow: "hidden",
        }}
      >
        {rows.map((r, i) => (
          <View
            key={r.label}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderBottomWidth: i < rows.length - 1 ? 1 : 0,
              borderBottomColor: p.line.default,
            }}
          >
            <Text className="text-[11px] uppercase tracking-wider text-ink-dim">
              {r.label}
            </Text>
            <Text className="ml-3 flex-1 text-right text-[12px] text-ink" numberOfLines={3}>
              {r.value}
            </Text>
          </View>
        ))}
      </View>
      {card.tags && card.tags.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {card.tags.map((t) => (
            <View
              key={t}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: p.line.default,
              }}
            >
              <Text
                style={{
                  color: p.ink.muted,
                  fontSize: 10,
                  fontWeight: "700",
                  letterSpacing: 0.5,
                }}
              >
                {t.toUpperCase()}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ─── helpers ───────────────────────────────────────────────────────────

function flattenHouses(
  houses: HouseBlockWire[],
  filter: HouseId | "all",
): HouseGradeRowWire[] {
  const out: HouseGradeRowWire[] = [];
  for (const h of houses) {
    if (filter !== "all" && h.house !== filter) continue;
    for (const g of h.grades) out.push(g);
  }
  // High → low by market, capped to keep the list readable.
  out.sort((a, b) => b.market.amount - a.market.amount);
  return out.slice(0, filter === "all" ? 24 : 16);
}


// ─── Live listings & sold comps ────────────────────────────────────────

function SectionHeader({ label, badge }: { label: string; badge?: string | null }) {
  const p = useThemedPalette();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 8,
      }}
    >
      <Text
        style={{
          color: p.ink.dim,
          fontSize: 10,
          fontWeight: "700",
          letterSpacing: 3,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      {badge ? (
        <Text style={{ color: p.ink.muted, fontSize: 11 }}>· {badge}</Text>
      ) : null}
    </View>
  );
}

function LiveListingsSection({ cardId }: { cardId: string }) {
  const p = useThemedPalette();
  const q = useCardListings(cardId, { limit: 12 });
  const listings = q.data?.listings ?? [];

  return (
    <View style={{ gap: 4 }}>
      <SectionHeader label="Live Listings" badge={`${listings.length}`} />
      {q.isLoading ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <SkeletonListingsRail rows={4} />
        </ScrollView>
      ) : listings.length === 0 ? (
        <View
          style={{
            padding: 16,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: p.line.default,
            backgroundColor: p.bg.elevated,
            alignItems: "center",
          }}
        >
          <Text className="text-[12px] text-ink-muted">
            No live listings right now
          </Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: 10, paddingRight: 12 }}>
            {listings.map((l, i) => (
              <ListingCard key={`${l.source}:${l.url || i}`} listing={l} />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function ListingCard({ listing }: { listing: ListingWire }) {
  const p = useThemedPalette();
  const onPress = () => {
    if (listing.url) Linking.openURL(listing.url).catch(() => undefined);
  };
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 168,
        padding: 10,
        borderRadius: 14,
        backgroundColor: p.bg.elevated,
        borderWidth: 1,
        borderColor: p.line.default,
        gap: 8,
      }}
    >
      {listing.image_url ? (
        <CardImage
          uri={listing.image_url}
          width={148}
          height={120}
          rounded={10}
          contentFit="cover"
          priority="low"
          recyclingKey={listing.image_url ?? listing.url}
          alt={listing.title ?? "listing"}
          aspectRatio={undefined as unknown as number}
        />
      ) : (
        <View
          style={{
            width: "100%",
            height: 120,
            borderRadius: 10,
            backgroundColor: p.bg.sunken,
          }}
        />
      )}
      <Text
        numberOfLines={2}
        style={{ color: p.ink.default, fontSize: 11, fontWeight: "600" }}
      >
        {listing.title}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Price
          usd={listing.price.amount}
          className="text-[13px] font-semibold text-ink"
        />
        {listing.is_auction ? (
          <Text style={{ color: p.accent.amber, fontSize: 10, fontWeight: "700" }}>
            AUCTION
          </Text>
        ) : null}
      </View>
      {listing.condition ? (
        <View
          style={{
            alignSelf: "flex-start",
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 999,
            backgroundColor: withAlpha(p.accent.mint, 0.15),
          }}
        >
          <Text style={{ color: p.accent.mint, fontSize: 10, fontWeight: "700" }}>
            {listing.condition.toUpperCase()}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function RecentCompsSection({ cardId }: { cardId: string }) {
  const p = useThemedPalette();
  const q = useCardComps(cardId, { days: 90, limit: 12 });
  const comps = q.data?.comps ?? [];

  return (
    <View style={{ gap: 4 }}>
      <SectionHeader label="Recent Sold Comps" badge="90d" />
      {q.isLoading ? (
        <SkeletonCompsList rows={4} />
      ) : comps.length === 0 ? (
        <View
          style={{
            padding: 16,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: p.line.default,
            backgroundColor: p.bg.elevated,
            alignItems: "center",
          }}
        >
          <Text className="text-[12px] text-ink-muted">
            No recent comps in window
          </Text>
        </View>
      ) : (
        <View
          style={{
            borderRadius: 14,
            borderWidth: 1,
            borderColor: p.line.default,
            backgroundColor: p.bg.elevated,
            overflow: "hidden",
          }}
        >
          {comps.map((c, i) => (
            <CompRow
              key={`${c.source}:${c.url || c.sold_at}:${i}`}
              comp={c}
              isLast={i === comps.length - 1}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function CompRow({ comp, isLast }: { comp: SoldCompWire; isLast: boolean }) {
  const p = useThemedPalette();
  const onPress = () => {
    if (comp.url) Linking.openURL(comp.url).catch(() => undefined);
  };
  const date = comp.sold_at ? new Date(comp.sold_at) : null;
  const dateLabel =
    date && !Number.isNaN(date.getTime())
      ? date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })
      : "—";
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: p.line.default,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          numberOfLines={1}
          style={{ color: p.ink.default, fontSize: 12, fontWeight: "600" }}
        >
          {comp.title}
        </Text>
        <Text style={{ color: p.ink.muted, fontSize: 10 }}>
          {comp.source.toUpperCase()} · {dateLabel}
        </Text>
      </View>
      {comp.grade ? (
        <View
          style={{
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 999,
            backgroundColor: withAlpha(p.accent.mint, 0.15),
          }}
        >
          <Text style={{ color: p.accent.mint, fontSize: 10, fontWeight: "700" }}>
            {(comp.house ?? "").toUpperCase()} {comp.grade}
          </Text>
        </View>
      ) : null}
      <Price usd={comp.price.amount} className="text-[13px] font-semibold text-ink" />
    </Pressable>
  );
}
