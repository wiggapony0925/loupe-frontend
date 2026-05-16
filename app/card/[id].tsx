/**
 * Card detail — `/card/[id]`
 *
 * Sections:
 *   - Hero (large image, title, set + year, TCG badge, market price)
 *   - Pricing card (market/low/mid/high, as_of, sources)
 *   - Price history chart (30d/90d/1y toggle, react-native-svg polyline)
 *   - Attributes grid (filtered by TCG type)
 *   - Set info (logo, name, code, release date, total)
 *   - Tags chip row
 *   - Actions ("Add to Collection", "Grade This Card" — stub toast)
 *
 * Loading skeleton + error empty state with retry are shared via the
 * `<QueryState>` helper.
 */
import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import Svg, { Polyline } from "react-native-svg";
import { ChevronLeft } from "lucide-react-native";
import { useCard } from "@/hooks/api/useCard";
import {
  useCardPriceHistory,
  type PriceHistoryRange,
} from "@/hooks/api/useCardPriceHistory";
import { Price } from "@/components/ui/Price";
import { Skeleton } from "@/components/ui/Skeleton";
import { QueryState } from "@/components/ui/QueryState";
import { palette, useThemedPalette, withAlpha } from "@/theme/tokens";

const BLURHASH = "L6Pj0^jE.AyE_3t7t7R**0o#DgR4";

const RANGE_OPTIONS: { key: PriceHistoryRange; label: string }[] = [
  { key: "30d", label: "30D" },
  { key: "90d", label: "90D" },
  { key: "1y", label: "1Y" },
];

// Which `attributes.*` keys are interesting per-TCG, in render order.
const ATTRIBUTE_KEYS: Record<string, string[]> = {
  pokemon: [
    "hp",
    "supertype",
    "subtypes",
    "types",
    "evolvesFrom",
    "evolvesTo",
    "retreatCost",
    "regulationMark",
    "artist",
    "flavorText",
  ],
  magic: [
    "mana_cost",
    "cmc",
    "type_line",
    "oracle_text",
    "power",
    "toughness",
    "loyalty",
    "colors",
    "color_identity",
    "keywords",
    "artist",
    "flavor_text",
  ],
  yugioh: [
    "type",
    "frameType",
    "race",
    "archetype",
    "atk",
    "def",
    "level",
    "attribute",
    "scale",
    "linkval",
    "desc",
  ],
};

function formatAttr(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (Array.isArray(v))
    return v
      .map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x)))
      .join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cardQ = useCard(id ?? "");
  const card = cardQ.data;
  const tcg = card?.tcg ?? "all";
  const p = useThemedPalette();
  const [range, setRange] = useState<PriceHistoryRange>("30d");
  const historyQ = useCardPriceHistory({ id, range, enabled: !!id });

  const market = card?.pricing_summary?.market?.amount ?? null;
  const imageUrl =
    card?.images?.large?.url ??
    card?.images?.normal?.url ??
    card?.image_url ??
    null;

  const attrKeys = useMemo(() => ATTRIBUTE_KEYS[tcg] ?? [], [tcg]);
  const attributes = (card?.attributes ?? {}) as Record<string, unknown>;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between px-4 pb-2 pt-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          className="h-9 w-9 items-center justify-center rounded-full border border-line bg-bg-elevated"
        >
          <ChevronLeft size={18} color={palette.ink.default} />
        </Pressable>
        <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
          Card Detail
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <QueryState
          isLoading={cardQ.isLoading}
          isError={cardQ.isError}
          isEmpty={!cardQ.isLoading && !cardQ.isError && !card}
          loadingFallback={<CardDetailSkeleton />}
          errorMessage="Couldn't load card"
          emptyTitle="Card not found"
          emptyMessage="The catalog returned no match for this id."
          onRetry={() => void cardQ.refetch()}
        >
          {card ? (
            <>
              {/* Hero */}
              <View className="items-center">
                <View
                  className="overflow-hidden rounded-2xl"
                  style={{
                    width: 220,
                    height: 308,
                    backgroundColor: p.bg.sunken,
                  }}
                >
                  {imageUrl ? (
                    <Image
                      source={{ uri: imageUrl }}
                      placeholder={{ blurhash: BLURHASH }}
                      transition={200}
                      contentFit="cover"
                      style={{ width: "100%", height: "100%" }}
                    />
                  ) : null}
                </View>
                <Text className="mt-4 text-center text-2xl font-semibold tracking-tight text-ink">
                  {card.name}
                </Text>
                <Text className="mt-1 text-[12px] text-ink-muted">
                  {[card.set_name, card.year].filter(Boolean).join(" · ")}
                </Text>
                <View
                  className="mt-2"
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                    borderRadius: 999,
                    backgroundColor: withAlpha(p.accent.mint, 0.14),
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
                    {tcg.toUpperCase()}
                  </Text>
                </View>
                {market !== null ? (
                  <Price
                    usd={market}
                    className="mt-3 text-3xl font-semibold text-ink"
                  />
                ) : (
                  <Text className="mt-3 text-3xl font-semibold text-ink-muted">
                    —
                  </Text>
                )}
              </View>

              {/* Pricing */}
              <PricingCard pricing={card.pricing_summary ?? null} />

              {/* Price history */}
              <View>
                <View className="mb-2 flex-row items-center justify-between">
                  <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
                    Price history
                  </Text>
                  <View className="flex-row gap-1.5">
                    {RANGE_OPTIONS.map((opt) => {
                      const active = range === opt.key;
                      return (
                        <Pressable
                          key={opt.key}
                          onPress={() => setRange(opt.key)}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: active ? p.accent.mint : p.line.default,
                            backgroundColor: active
                              ? withAlpha(p.accent.mint, 0.15)
                              : "transparent",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: "700",
                              letterSpacing: 0.5,
                              color: active ? p.accent.mint : p.ink.muted,
                            }}
                          >
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                <PriceHistoryChart
                  isLoading={historyQ.isLoading}
                  isError={historyQ.isError}
                  points={
                    historyQ.data?.points.map((pt) => pt.price) ?? []
                  }
                  changePct={historyQ.data?.summary?.change_pct ?? null}
                />
              </View>

              {/* Attributes */}
              {attrKeys.length ? (
                <View>
                  <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
                    Attributes
                  </Text>
                  <View className="mt-2 rounded-2xl border border-line bg-bg-elevated">
                    {attrKeys
                      .filter((k) => attributes[k] !== undefined)
                      .map((k, i, arr) => (
                        <View
                          key={k}
                          className={`flex-row items-start justify-between px-4 py-3 ${i < arr.length - 1 ? "border-b border-line/60" : ""}`}
                        >
                          <Text className="text-[11px] uppercase tracking-wider text-ink-dim">
                            {k}
                          </Text>
                          <Text
                            className="ml-4 flex-1 text-right text-[12px] text-ink"
                            numberOfLines={4}
                          >
                            {formatAttr(attributes[k])}
                          </Text>
                        </View>
                      ))}
                  </View>
                </View>
              ) : null}

              {/* Set info */}
              {card.set ? (
                <View>
                  <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
                    Set
                  </Text>
                  <View className="mt-2 flex-row items-center gap-3 rounded-2xl border border-line bg-bg-elevated p-4">
                    {card.set.logo?.url ? (
                      <Image
                        source={{ uri: card.set.logo.url }}
                        contentFit="contain"
                        style={{ width: 48, height: 48 }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 8,
                          backgroundColor: p.bg.sunken,
                        }}
                      />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text className="text-sm font-semibold text-ink">
                        {card.set.name ?? "—"}
                      </Text>
                      <Text className="mt-0.5 text-[11px] text-ink-muted">
                        {[
                          card.set.code,
                          card.set.release_date,
                          card.set.total_cards
                            ? `${card.set.total_cards} cards`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : null}

              {/* Tags */}
              {card.tags && card.tags.length ? (
                <View>
                  <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
                    Tags
                  </Text>
                  <View className="mt-2 flex-row flex-wrap gap-2">
                    {card.tags.map((t) => (
                      <View
                        key={t}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: p.line.default,
                          backgroundColor: withAlpha(p.bg.elevated, 0.6),
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
                </View>
              ) : null}

              {/* Actions */}
              <View className="flex-row gap-3">
                <ActionButton
                  label="Add to Collection"
                  primary
                  onPress={() =>
                    Alert.alert(
                      "Coming soon",
                      "Collection wiring lands in the next pass.",
                    )
                  }
                />
                <ActionButton
                  label="Grade This Card"
                  onPress={() =>
                    Alert.alert(
                      "Coming soon",
                      "Grading flow lands in the next pass.",
                    )
                  }
                />
              </View>
            </>
          ) : null}
        </QueryState>
      </ScrollView>
    </SafeAreaView>
  );
}

function PricingCard({
  pricing,
}: {
  pricing: import("@/api/types").PricingSummaryWire | null;
}) {
  const p = useThemedPalette();
  if (!pricing) {
    return (
      <View className="rounded-2xl border border-line bg-bg-elevated p-4">
        <Text className="text-sm font-semibold text-ink-muted">
          No pricing data
        </Text>
      </View>
    );
  }
  const cells: { label: string; amount: number | null }[] = [
    { label: "Market", amount: pricing.market?.amount ?? null },
    { label: "Low", amount: pricing.low?.amount ?? null },
    { label: "Mid", amount: pricing.mid?.amount ?? null },
    { label: "High", amount: pricing.high?.amount ?? null },
  ];
  return (
    <View className="rounded-2xl border border-line bg-bg-elevated p-4">
      <View className="flex-row justify-between">
        {cells.map((c) => (
          <View key={c.label} className="flex-1 items-center">
            <Text className="text-[10px] uppercase tracking-wider text-ink-dim">
              {c.label}
            </Text>
            {c.amount !== null ? (
              <Price
                usd={c.amount}
                className="mt-1 text-sm font-semibold text-ink"
              />
            ) : (
              <Text className="mt-1 text-sm font-semibold text-ink-muted">—</Text>
            )}
          </View>
        ))}
      </View>
      <View
        className="mt-3 flex-row items-center justify-between border-t pt-2"
        style={{ borderColor: p.line.default }}
      >
        <Text className="text-[10px] text-ink-dim">
          {pricing.sources?.length ? pricing.sources.join(", ") : "—"}
        </Text>
        <Text className="text-[10px] text-ink-dim">
          {pricing.as_of ?? "live"}
        </Text>
      </View>
    </View>
  );
}

function PriceHistoryChart({
  isLoading,
  isError,
  points,
  changePct,
}: {
  isLoading: boolean;
  isError: boolean;
  points: number[];
  changePct: number | null;
}) {
  const p = useThemedPalette();
  const W = 320;
  const H = 110;
  const PAD = 8;

  if (isLoading) {
    return (
      <View
        className="rounded-2xl border border-line bg-bg-elevated"
        style={{ height: H + 16, alignItems: "center", justifyContent: "center" }}
      >
        <Skeleton width={W - 32} height={H} />
      </View>
    );
  }
  if (isError || points.length < 2) {
    return (
      <View
        className="items-center rounded-2xl border border-line bg-bg-elevated"
        style={{ height: H + 16, justifyContent: "center" }}
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
    <View className="rounded-2xl border border-line bg-bg-elevated p-3">
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
      <View className="mt-2 flex-row justify-between">
        <Text className="text-[10px] text-ink-dim">
          ${min.toFixed(2)} – ${max.toFixed(2)}
        </Text>
        {changePct !== null ? (
          <Text
            style={{
              color,
              fontSize: 11,
              fontWeight: "700",
            }}
          >
            {positive ? "+" : ""}
            {changePct.toFixed(2)}%
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function ActionButton({
  label,
  primary,
  onPress,
}: {
  label: string;
  primary?: boolean;
  onPress: () => void;
}) {
  const p = useThemedPalette();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        opacity: pressed ? 0.7 : 1,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: primary ? p.accent.mint : p.line.default,
        backgroundColor: primary
          ? withAlpha(p.accent.mint, 0.18)
          : "transparent",
        alignItems: "center",
      })}
    >
      <Text
        style={{
          color: primary ? p.accent.mint : p.ink.default,
          fontSize: 12,
          fontWeight: "800",
          letterSpacing: 0.6,
        }}
      >
        {label.toUpperCase()}
      </Text>
    </Pressable>
  );
}

function CardDetailSkeleton() {
  return (
    <View style={{ gap: 16 }}>
      <View className="items-center">
        <Skeleton width={220} height={308} radius={16} />
        <View style={{ marginTop: 12 }}>
          <Skeleton width={180} height={20} />
        </View>
        <View style={{ marginTop: 8 }}>
          <Skeleton width={120} height={14} />
        </View>
      </View>
      <Skeleton width="100%" height={80} radius={16} />
      <Skeleton width="100%" height={130} radius={16} />
      <Skeleton width="100%" height={120} radius={16} />
    </View>
  );
}
