/**
 * Market Detail — Robinhood-style price page for any card.
 *
 * Tapping a search result lands here. Front-only image (no back), big spot
 * price, scrubbable chart, RAW · GRADED · POP toggle, market stats, and a
 * comps rail aggregated from many providers (eBay, PWCC, Goldin, TCGplayer,
 * 130point, PriceCharting, COMC).
 *
 * Primary CTA: **I have this card → Grade it** — hands the catalog id off
 * to the phone-capture flow which will prefill the OCR target so the
 * resulting forensic report links back to this market entry.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  GestureResponderEvent,
  Image,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient as SvgGradient,
  Path,
  Stop,
} from "react-native-svg";
import {
  ArrowLeft,
  Bell,
  Camera,
  Heart,
  Pencil,
  Plus,
  ScanLine,
  ShoppingBag,
} from "lucide-react-native";
import { routes } from "@/shared/routes";
import {
  fetchMarketCard,
  type GradedTier,
  type GradingHouse,
  type MarketCondition,
  type MarketRange,
  type MarketSource,
} from "@/infrastructure/repositories/marketRepository";
import { useMyGrades } from "@/application/queries/collection/useMyGrades";
import {
  useAddToWatchlist,
  useIsWatching,
  useRemoveFromWatchlist,
} from "@/application/queries/collection/useWatchlist";
import { queryKeys } from "@/application/queries/queryKeys";
import { useAuth } from "@/presentation/providers/AuthProvider";
import type { GradedCard } from "@/infrastructure/http";
import { compactUsd } from "@/shared/format";
import { clampLabelX, monotoneCubic, nearestIndex } from "@/shared/chart";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { SkeletonMarketDetailPage } from "@/presentation/components/Skeletons";
import { EmptyState } from "@/presentation/components/EmptyState";
import { ErrorState } from "@/presentation/components/ErrorState";
import { PriceAlertSheet } from "@/presentation/features/alerts/PriceAlertSheet";

const RANGES: MarketRange[] = ["1D", "1W", "1M", "3M", "YTD", "1Y", "ALL"];
const CHART_HEIGHT = 200;

export default function MarketDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id ?? "";
  const p = useThemedPalette();
  const [condition, setCondition] = useState<MarketCondition>("graded");
  const [range, setRange] = useState<MarketRange>("1Y");
  // Watchlist state is owned by the backend (via React Query) so the
  // heart persists across screens and sessions and can drive price
  // alerts — the old local `useState(false)` silently dropped every
  // tap, so a user who "saved" a card found it missing from their
  // watchlist. Mirrors the wiring in `app/card/[id].tsx`.
  const isWatching = useIsWatching(id || undefined);
  const addWatch = useAddToWatchlist();
  const removeWatch = useRemoveFromWatchlist();
  const toggleWatch = () => {
    if (!id) return;
    if (isWatching) {
      removeWatch.mutate(id);
    } else {
      addWatch.mutate(id);
    }
  };
  // Price-alert sheet — the bell button used to be an inert Pressable
  // with no onPress, so tapping it did nothing. It now opens the same
  // `PriceAlertSheet` the card-detail screen uses.
  const [alertOpen, setAlertOpen] = useState(false);

  const market = useQuery({
    queryKey: queryKeys.market.detail(id, condition),
    queryFn: () => fetchMarketCard(id, condition),
    staleTime: 30_000,
    enabled: !!id,
  });

  const data = market.data;
  const owned = !!data?.ownedCard;
  const { isAuthenticated } = useAuth();
  const myGradesQ = useMyGrades<GradedCard[]>();
  const ownedGrade = useMemo(
    () =>
      (myGradesQ.data ?? []).find(
        (g) => g.card_id === id || (data?.ownedCard && g.card_id === data.ownedCard.id),
      ) ?? null,
    [myGradesQ.data, id, data?.ownedCard],
  );

  const handleAddManually = () => {
    if (ownedGrade) {
      router.push(routes.gradeEdit(ownedGrade.id));
      return;
    }
    router.push(
      routes.gradeNew({
        cardId: id,
        cardName: data?.title ?? undefined,
        cardImage: data?.imageUri ?? undefined,
        cardSet: data?.set ?? undefined,
        cardYear: data?.year ?? undefined,
      }),
    );
  };

  const handleGradeIt = () => {
    if (owned && data?.ownedCard) {
      router.push(routes.scan(data.ownedCard.id));
      return;
    }
    router.push({
      pathname: "/scan/phone",
      params: { mode: "studio", marketCardId: id },
    });
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-bg">
      {/* Top bar */}
      <View className="flex-row items-center justify-between px-5 py-2">
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: withAlpha(p.ink.dim, 0.08) }}
        >
          <ArrowLeft size={18} color={p.ink.default} />
        </Pressable>
        <Text className="text-xs font-semibold uppercase tracking-[2px] text-ink-muted">
          Market
        </Text>
        <View className="flex-row gap-2">
          <Pressable
            onPress={toggleWatch}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={isWatching ? "Remove from watchlist" : "Add to watchlist"}
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{
              backgroundColor: isWatching
                ? withAlpha(p.accent.rose, 0.16)
                : withAlpha(p.ink.dim, 0.08),
            }}
          >
            <Heart
              size={16}
              color={isWatching ? p.accent.rose : p.ink.default}
              fill={isWatching ? p.accent.rose : "transparent"}
            />
          </Pressable>
          <Pressable
            onPress={() => setAlertOpen(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Set price alert"
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: withAlpha(p.ink.dim, 0.08) }}
          >
            <Bell size={16} color={p.ink.default} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {market.isLoading && !data ? (
          <SkeletonMarketDetailPage />
        ) : market.isError ? (
          <View style={{ padding: 20 }}>
            <ErrorState
              title="Couldn't load market"
              message="Pull to retry, or check your connection."
              onRetry={() => market.refetch()}
            />
          </View>
        ) : !data ? (
          <View style={{ padding: 20 }}>
            <EmptyState
              title="Card not found"
              message="We couldn't find this card in the catalog."
            />
          </View>
        ) : (
        <>
        {/* Hero — image + headline */}
        <View className="px-5 pt-2">
          <View className="flex-row items-center gap-4">
            <View
              className="overflow-hidden rounded-xl"
              style={{
                width: 96,
                height: 134,
                backgroundColor: p.bg.sunken,
                borderWidth: 1,
                borderColor: p.line.default,
              }}
            >
              {data ? (
                <Image
                  source={{ uri: data.imageUri }}
                  style={{ width: 96, height: 134 }}
                  resizeMode="cover"
                />
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
                {data?.year ?? "—"} · {data?.set ?? "Loading"}
              </Text>
              <Text
                numberOfLines={2}
                className="mt-1 font-semibold tracking-tight text-ink"
                style={{ fontSize: 22, lineHeight: 26 }}
              >
                {data?.title ?? " "}
              </Text>
              {owned ? (
                <View
                  className="mt-2 self-start rounded-md px-2 py-1"
                  style={{ backgroundColor: withAlpha(p.accent.mint, 0.16) }}
                >
                  <Text
                    style={{
                      color: p.accent.mint,
                      fontSize: 10,
                      fontWeight: "800",
                      letterSpacing: 0.6,
                    }}
                  >
                    IN YOUR VAULT
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* Chart hero (price + delta + interactive line) */}
        <View className="mt-6 px-5">
          {data ? (
            <MarketChart data={data} range={range} setRange={setRange} />
          ) : (
            <View
              style={{
                height: CHART_HEIGHT + 80,
                borderRadius: 12,
                backgroundColor: withAlpha(p.ink.dim, 0.06),
              }}
            />
          )}
        </View>

        {/* Condition toggle — RAW · GRADED · POP */}
        {data ? (
          <View className="mt-6 px-5">
            <View
              className="flex-row overflow-hidden rounded-xl border border-line"
              style={{ backgroundColor: p.bg.elevated }}
            >
              {(
                [
                  { key: "raw", label: "RAW", sub: "Ungraded" },
                  { key: "graded", label: "GRADED", sub: "PSA 9 avg" },
                  { key: "pop", label: "POP", sub: "PSA 10" },
                ] as { key: MarketCondition; label: string; sub: string }[]
              ).map((opt, i) => {
                const active = condition === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => setCondition(opt.key)}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      alignItems: "center",
                      backgroundColor: active ? withAlpha(p.accent.mint, 0.12) : "transparent",
                      borderLeftWidth: i === 0 ? 0 : 1,
                      borderLeftColor: p.line.default,
                    }}
                  >
                    <Text
                      style={{
                        color: active ? p.accent.mint : p.ink.muted,
                        fontSize: 11,
                        fontWeight: "800",
                        letterSpacing: 1,
                      }}
                    >
                      {opt.label}
                    </Text>
                    <Text
                      style={{
                        color: active ? p.ink.default : p.ink.dim,
                        fontSize: 14,
                        fontWeight: "700",
                        marginTop: 2,
                      }}
                    >
                      {compactUsd(data.conditionPrices[opt.key])}
                    </Text>
                    <Text className="mt-0.5 text-[10px] text-ink-dim">{opt.sub}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Multi-house grading ladder — full PSA / CGC / BGS / SGC / TAG breakdown */}
        {data ? <GradingLadder tiers={data.gradedTiers} /> : null}

        {/* Market stats grid */}
        {data ? (
          <View className="mt-6 px-5">
            <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
              Market stats
            </Text>
            <View className="mt-3 flex-row flex-wrap" style={{ gap: 10 }}>
              <Stat label="30-day low" value={compactUsd(data.stats.thirtyDay.low)} />
              <Stat label="30-day high" value={compactUsd(data.stats.thirtyDay.high)} />
              <Stat label="30-day avg" value={compactUsd(data.stats.thirtyDay.avg)} />
              <Stat
                label="Sales (30d)"
                value={data.stats.thirtyDay.sales.toString()}
              />
              <Stat label="90-day avg" value={compactUsd(data.stats.ninetyDay.avg)} />
              <Stat
                label="PSA 10 pop"
                value={data.stats.pop.psa10.toLocaleString()}
              />
              <Stat label="PSA 9 pop" value={data.stats.pop.psa9.toLocaleString()} />
              <Stat label="Total pop" value={data.stats.pop.total.toLocaleString()} />
            </View>
          </View>
        ) : null}

        {/* Comps */}
        {data ? (
          <View className="mt-6 px-5">
            <View className="flex-row items-center justify-between">
              <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
                Recent comps
              </Text>
              <Pressable hitSlop={6}>
                <Text className="text-[11px] font-semibold" style={{ color: p.accent.mint }}>
                  View all
                </Text>
              </Pressable>
            </View>
            <View className="mt-3 overflow-hidden rounded-2xl border border-line bg-bg-elevated">
              {data.comps.map((c, i) => (
                <View
                  key={c.id}
                  className={`flex-row items-center gap-3 px-4 py-3 ${
                    i > 0 ? "border-t border-line/60" : ""
                  }`}
                >
                  <View
                    className="h-9 w-9 items-center justify-center rounded-full"
                    style={{ backgroundColor: withAlpha(sourceColor(c.source, p), 0.15) }}
                  >
                    <ShoppingBag size={14} color={sourceColor(c.source, p)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text className="text-sm font-semibold text-ink">{c.source}</Text>
                    <Text className="text-[11px] text-ink-muted">
                      {c.kind === "sold" ? "Sold" : "Listed"} · {c.detail ?? "—"} ·{" "}
                      {formatRelative(c.date)}
                    </Text>
                  </View>
                  <Text className="text-sm font-bold text-ink">{compactUsd(c.priceUsd)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
        </>
        )}
      </ScrollView>

      {/* Sticky CTA stack — Add to collection (primary) + scan secondary */}
      {data ? (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 28,
            backgroundColor: p.bg.base,
            borderTopWidth: 1,
            borderTopColor: p.line.default,
            gap: 10,
          }}
        >
          {isAuthenticated ? (
            <Pressable
              onPress={handleAddManually}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                height: 56,
                borderRadius: 16,
                backgroundColor: p.accent.mint,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              {ownedGrade ? (
                <Pencil size={18} color={p.bg.base} />
              ) : (
                <Plus size={18} color={p.bg.base} />
              )}
              <Text style={{ color: p.bg.base, fontSize: 15, fontWeight: "800" }}>
                {ownedGrade ? "Edit holding" : "Add to collection"}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={handleGradeIt}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              height: 48,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: p.line.default,
              backgroundColor: p.bg.elevated,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            {owned ? (
              <ScanLine size={16} color={p.ink.default} />
            ) : (
              <Camera size={16} color={p.ink.default} />
            )}
            <Text style={{ color: p.ink.default, fontSize: 13, fontWeight: "700" }}>
              {owned ? "Open scan report" : "Scan it instead"}
            </Text>
          </Pressable>
        </View>
      ) : null}
      <PriceAlertSheet
        cardId={id}
        cardName={data?.title ?? null}
        currentPriceUsd={data?.conditionPrices?.[condition] ?? null}
        visible={alertOpen}
        onClose={() => setAlertOpen(false)}
      />
    </SafeAreaView>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────── */

function Stat({ label, value }: { label: string; value: string }) {
  const p = useThemedPalette();
  return (
    <View
      style={{
        flexBasis: "47%",
        flexGrow: 1,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: p.line.default,
        backgroundColor: p.bg.elevated,
      }}
    >
      <Text className="text-[10px] font-semibold uppercase tracking-[2px] text-ink-dim">
        {label}
      </Text>
      <Text className="mt-1 text-base font-bold text-ink">{value}</Text>
    </View>
  );
}

/**
 * Multi-house graded-price ladder.
 *
 * Mirrors how Collectr / PriceCharting break out every recognized grading
 * house × grade tier (BGS 10 · PSA 10 · CGC 10 · CGC 9.5 · PSA 9 · …) so
 * the user can see at a glance what their card is worth across each
 * house's standards. Tap a row to filter the chart to that tier (future).
 */
function GradingLadder({ tiers }: { tiers: GradedTier[] }) {
  const p = useThemedPalette();
  const [house, setHouse] = useState<GradingHouse | "ALL">("ALL");
  const houses: (GradingHouse | "ALL")[] = ["ALL", "PSA", "CGC", "BGS", "SGC", "TAG"];
  const filtered = house === "ALL" ? tiers : tiers.filter((t) => t.house === house);

  return (
    <View className="mt-6 px-5">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
            Graded prices
          </Text>
          <Text className="mt-1 text-base font-semibold text-ink">
            By grading house
          </Text>
        </View>
        <Text className="text-[10px] font-semibold uppercase tracking-[2px] text-ink-dim">
          {filtered.length} tiers
        </Text>
      </View>

      {/* House filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingTop: 12, paddingRight: 8 }}
      >
        {houses.map((h) => {
          const active = house === h;
          const tint = h === "ALL" ? p.accent.mint : houseColor(h, p);
          return (
            <Pressable
              key={h}
              onPress={() => setHouse(h)}
              hitSlop={6}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: active ? withAlpha(tint, 0.16) : "transparent",
                borderWidth: 1,
                borderColor: active ? tint : p.line.default,
              }}
            >
              <Text
                style={{
                  color: active ? tint : p.ink.muted,
                  fontSize: 11,
                  fontWeight: "800",
                  letterSpacing: 0.6,
                }}
              >
                {h}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Tier table */}
      <View className="mt-3 overflow-hidden rounded-2xl border border-line bg-bg-elevated">
        {filtered.map((t, i) => {
          const tint = houseColor(t.house, p);
          const up = t.deltaPct >= 0;
          const deltaTint = up ? p.accent.mint : p.accent.rose;
          return (
            <View
              key={`${t.house}-${t.grade}`}
              className={`flex-row items-center gap-3 px-4 py-3 ${
                i > 0 ? "border-t border-line/60" : ""
              }`}
            >
              {/* House chip */}
              <View
                style={{
                  width: 56,
                  paddingVertical: 4,
                  borderRadius: 6,
                  alignItems: "center",
                  backgroundColor: withAlpha(tint, 0.18),
                }}
              >
                <Text
                  style={{
                    color: tint,
                    fontSize: 10,
                    fontWeight: "800",
                    letterSpacing: 0.6,
                  }}
                >
                  {t.house}
                </Text>
              </View>
              {/* Grade */}
              <View style={{ minWidth: 36 }}>
                <Text
                  style={{
                    color: p.ink.default,
                    fontSize: 18,
                    fontWeight: "800",
                    letterSpacing: -0.2,
                  }}
                >
                  {t.grade % 1 === 0 ? t.grade.toFixed(0) : t.grade.toFixed(1)}
                </Text>
              </View>
              {/* Pop */}
              <View style={{ flex: 1 }}>
                <Text className="text-[10px] uppercase tracking-[2px] text-ink-dim">
                  Population
                </Text>
                <Text className="text-sm font-semibold text-ink">
                  {t.pop.toLocaleString()}
                </Text>
              </View>
              {/* Price + delta */}
              <View style={{ alignItems: "flex-end" }}>
                <Text className="text-sm font-bold text-ink">
                  {compactUsd(t.priceUsd)}
                </Text>
                <Text
                  style={{
                    color: deltaTint,
                    fontSize: 10,
                    fontWeight: "700",
                  }}
                >
                  {up ? "▲" : "▼"} {Math.abs(t.deltaPct).toFixed(2)}%
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function houseColor(house: GradingHouse, p: ReturnType<typeof useThemedPalette>): string {
  switch (house) {
    case "PSA":
      return "#A347D6";
    case "CGC":
      return "#4FB3D9";
    case "BGS":
      return "#C8A24A";
    case "SGC":
      return "#34C759";
    case "TAG":
      return p.accent.mint;
  }
}

interface MarketChartProps {
  data: NonNullable<ReturnType<typeof useQuery<Awaited<ReturnType<typeof fetchMarketCard>>>>["data"]>;
  range: MarketRange;
  setRange: (r: MarketRange) => void;
}

function MarketChart({ data, range, setRange }: MarketChartProps) {
  const p = useThemedPalette();
  const [width, setWidth] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);

  const points = data.history[range];
  const { pathLine, pathArea, baselineY, coords } = useMemo(() => {
    if (!points || points.length < 2 || width === 0) {
      return { pathLine: "", pathArea: "", baselineY: 0, coords: [] };
    }
    const ys = points.map((pt) => pt.priceUsd);
    const lo = Math.min(...ys);
    const hi = Math.max(...ys);
    const PAD_Y = 18;
    const xScale = (i: number) => (i / (points.length - 1)) * width;
    const yScale = (v: number) => {
      if (hi === lo) return CHART_HEIGHT / 2;
      return PAD_Y + (1 - (v - lo) / (hi - lo)) * (CHART_HEIGHT - PAD_Y * 2);
    };
    const coords = points.map((pt, i) => [xScale(i), yScale(pt.priceUsd)] as const);
    const pathLine = monotoneCubic(coords);
    const pathArea =
      pathLine +
      ` L ${coords[coords.length - 1]![0].toFixed(2)} ${CHART_HEIGHT}` +
      ` L ${coords[0]![0].toFixed(2)} ${CHART_HEIGHT} Z`;
    return { pathLine, pathArea, baselineY: yScale(points[0]!.priceUsd), coords };
  }, [points, width]);

  const latest = points[points.length - 1]!.priceUsd;
  const first = points[0]!.priceUsd;
  const scrubIdx = scrub !== null && coords.length > 0 ? nearestIndex(scrub, coords) : null;
  const displayVal = scrubIdx !== null ? points[scrubIdx]!.priceUsd : latest;
  const displayDeltaUsd = displayVal - first;
  const displayDeltaPct = first > 0 ? (displayDeltaUsd / first) * 100 : 0;
  const up = displayDeltaUsd >= 0;
  const tint = up ? p.accent.mint : p.accent.rose;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => setScrub(getX(e)),
      onPanResponderMove: (e) => setScrub(getX(e)),
      onPanResponderRelease: () => setScrub(null),
      onPanResponderTerminate: () => setScrub(null),
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const scrubX = scrubIdx !== null ? coords[scrubIdx]![0] : null;
  const scrubY = scrubIdx !== null ? coords[scrubIdx]![1] : null;
  const scrubLabel = scrubIdx !== null ? points[scrubIdx]!.date : null;

  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (range !== "1D") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [range, pulse]);

  return (
    <View>
      <Text
        className="font-semibold text-ink"
        style={{ fontSize: 36, lineHeight: 40, letterSpacing: -0.6 }}
      >
        {compactUsd(displayVal)}
      </Text>
      <View className="mt-1 flex-row items-center gap-2">
        <Text style={{ color: tint, fontSize: 12 }}>{up ? "▲" : "▼"}</Text>
        <Text style={{ color: tint, fontSize: 14, fontWeight: "600" }}>
          {up ? "+" : ""}
          {compactUsd(displayDeltaUsd)} ({up ? "+" : ""}
          {displayDeltaPct.toFixed(2)}%)
        </Text>
        <Text className="text-sm text-ink-muted">
          {scrubLabel ? formatScrubDate(scrubLabel, range) : labelForRange(range)}
        </Text>
      </View>

      <View
        onLayout={onLayout}
        style={{ height: CHART_HEIGHT, marginTop: 14 }}
        {...panResponder.panHandlers}
      >
        {width > 0 && pathLine ? (
          <Svg width={width} height={CHART_HEIGHT}>
            <Defs>
              <SvgGradient id="marketFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={tint} stopOpacity="0.25" />
                <Stop offset="100%" stopColor={tint} stopOpacity="0" />
              </SvgGradient>
            </Defs>
            <Path d={pathArea} fill="url(#marketFill)" />
            <Line
              x1={0}
              x2={width}
              y1={baselineY}
              y2={baselineY}
              stroke={p.ink.dim}
              strokeWidth={0.75}
              strokeDasharray="2,4"
              opacity={0.55}
            />
            <Path
              d={pathLine}
              stroke={tint}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              fill="none"
            />
            {scrubX !== null && scrubY !== null ? (
              <>
                <Line
                  x1={scrubX}
                  x2={scrubX}
                  y1={0}
                  y2={CHART_HEIGHT}
                  stroke={p.ink.muted}
                  strokeWidth={0.5}
                  strokeDasharray="2,3"
                  opacity={0.7}
                />
                <Circle cx={scrubX} cy={scrubY} r={9} fill={withAlpha(tint, 0.18)} />
                <Circle cx={scrubX} cy={scrubY} r={5} fill={p.bg.elevated} />
                <Circle cx={scrubX} cy={scrubY} r={3.5} fill={tint} />
              </>
            ) : (
              <>
                <Circle
                  cx={coords[coords.length - 1]![0]}
                  cy={coords[coords.length - 1]![1]}
                  r={6}
                  fill={withAlpha(tint, 0.22)}
                />
                <Circle
                  cx={coords[coords.length - 1]![0]}
                  cy={coords[coords.length - 1]![1]}
                  r={3}
                  fill={tint}
                />
              </>
            )}
          </Svg>
        ) : null}
        {scrubX !== null ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: clampLabelX(scrubX, width, 96),
              width: 96,
              alignItems: "center",
            }}
          >
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 6,
                backgroundColor: p.ink.default,
              }}
            >
              <Text
                style={{
                  color: p.bg.base,
                  fontSize: 10,
                  fontWeight: "700",
                  letterSpacing: 0.3,
                }}
              >
                {compactUsd(displayVal)}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      <View className="mt-4 flex-row items-center justify-between border-b border-line/60 pb-3">
        {range === "1D" ? (
          <View className="flex-row items-center gap-1.5">
            <Animated.View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: tint,
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
              }}
            />
            <Text
              style={{ color: tint, fontSize: 11, fontWeight: "700", letterSpacing: 0.6 }}
            >
              LIVE
            </Text>
          </View>
        ) : null}
        {RANGES.map((r) => (
          <Pressable
            key={r}
            onPress={() => setRange(r)}
            hitSlop={8}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: r === range ? withAlpha(tint, 0.15) : "transparent",
            }}
          >
            <Text
              style={{
                color: r === range ? tint : p.ink.muted,
                fontSize: 11,
                fontWeight: "700",
                letterSpacing: 0.6,
              }}
            >
              {r}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function getX(e: GestureResponderEvent): number {
  return e.nativeEvent.locationX;
}

function labelForRange(r: MarketRange): string {
  switch (r) {
    case "1D":
      return "Today";
    case "1W":
      return "Past Week";
    case "1M":
      return "Past Month";
    case "3M":
      return "Past 3 Months";
    case "YTD":
      return "Year to Date";
    case "1Y":
      return "Past Year";
    case "ALL":
      return "All Time";
  }
}

function formatScrubDate(iso: string, range: MarketRange): string {
  const d = new Date(iso);
  if (range === "1D") {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  if (range === "1W" || range === "1M") {
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString([], { month: "short", year: "numeric" });
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const days = Math.round((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

function sourceColor(source: MarketSource, p: ReturnType<typeof useThemedPalette>): string {
  switch (source) {
    case "eBay":
      return "#E53238";
    case "PWCC":
      return "#0A84FF";
    case "Goldin":
      return "#C8A24A";
    case "TCGplayer":
      return "#FF6B35";
    case "130point":
      return p.accent.mint;
    case "PSA":
      return "#A347D6";
    case "CGC":
      return "#4FB3D9";
    case "PriceCharting":
      return "#5AC8FA";
    case "COMC":
      return "#34C759";
    case "Card Ladder":
      return "#FF9500";
  }
}
