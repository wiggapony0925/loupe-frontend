/**
 * Robinhood-style portfolio chart.
 *
 * Hero value + delta (arrow + $ + %), an interactive SVG line with a
 * gradient fill and a touch-driven crosshair scrubber, a floating value
 * tooltip pinned above the scrubber, a horizontal dashed reference line
 * marking the period start (Robinhood's signature flat baseline), and a
 * range pill row at the bottom (1D · 1W · 1M · 3M · YTD · 1Y · ALL).
 *
 * The hero value and delta update live as the user drags across the
 * chart. Lifting the finger restores the latest values. The 1D range
 * gets a pulsing "LIVE" dot next to the headline.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  GestureResponderEvent,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  Text,
  View,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient as SvgGradient,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import * as Haptics from "expo-haptics";
import { ChevronDown } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSettings } from "@/application/stores/settingsStore";
import { usePortfolioHistory, useMarketIndex } from "@/application/queries";
import { useAuth } from "@/presentation/providers/AuthProvider";
import {
  PORTFOLIO_TIMEFRAMES,
  clampLabelX,
  monotoneCubic,
  nearestIndex,
  type PortfolioTimeframe,
} from "@/domain/charts";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { useMoney } from "@/presentation/components/Price";
import { useDisplayCurrency } from "@/application/hooks/useDisplayCurrency";
import { CurrencyPickerSheet } from "@/presentation/components/CurrencyPickerSheet";
import { usePressScale } from "@/presentation/components/usePressScale";

/** @deprecated Use `PortfolioTimeframe` from `@/domain/charts`. */
type PortfolioRange = PortfolioTimeframe;

const RANGES = PORTFOLIO_TIMEFRAMES;
const CHART_HEIGHT = 200;

interface PortfolioChartProps {
  /** Live total to anchor the right-edge value when the API is loading. */
  fallbackTotal?: number;
  /**
   * Total purchase cost across cards with recorded cost basis. When
   * provided (non-null), a "vs Cost" toggle appears next to the delta
   * chip and shows unrealized P/L against cost instead of the period
   * start. Pass `null` (or omit) when the user has not recorded any
   * purchase prices yet — the toggle stays hidden.
   */
  costBasisUsd?: number | null;
  /**
   * When true, overlays the normalized PSA-10 cohort index as a faded
   * dashed line behind the portfolio line. Both series share the same
   * starting baseline so the gap between them at any point is the
   * portfolio's outperformance vs. the broader PSA-10 market.
   */
  showPsa10Overlay?: boolean;
  /**
   * Horizontal bleed in points applied to **only** the chart plot
   * (SVG + scrub overlay). The hero value row and timeframe pills stay
   * within the parent's padding so text/control alignment matches the
   * rest of the screen. Pass the consumer's container horizontal
   * padding to make the plot run full-bleed to the screen edges — e.g.
   * `bleedX={20}` when the screen uses `padding: 20`. Defaults to 0.
   */
  bleedX?: number;
}

export function PortfolioChart({
  fallbackTotal = 0,
  costBasisUsd = null,
  showPsa10Overlay = false,
  bleedX = 0,
}: PortfolioChartProps) {
  const p = useThemedPalette();
  const insets = useSafeAreaInsets();
  // Per-side bleed: extend to the device edge, but never past the safe
  // area. On portrait iPhones insets.left/right are 0, so the chart
  // bleeds the full `bleedX`. In landscape or on iPad-style devices
  // with non-zero side insets, the bleed shrinks so the SVG stays
  // inside the safe area and is never clipped by notches or rounded
  // corners. Clamped at 0 — we never *add* margin, only remove parent
  // padding up to the safe edge.
  const bleedLeft = Math.max(0, bleedX - insets.left);
  const bleedRight = Math.max(0, bleedX - insets.right);
  const [range, setRange] = useState<PortfolioTimeframe>("1Y");
  const [width, setWidth] = useState(0);
  // Reusable currency hook — subscribes to the display currency AND
  // persists changes to the user's profile (so the webapp follows).
  const { currency, setCurrency } = useDisplayCurrency();
  const { format: money, meta: ccyMeta } = useMoney();
  const [pickerOpen, setPickerOpen] = useState(false);
  const ccyTint = ccyMeta.kind === "crypto" ? p.accent.amber : p.accent.mint;
  const [scrub, setScrub] = useState<number | null>(null);
  // Hero delta basis: "period" (vs first point on the chart) or "cost"
  // (vs user's recorded purchase price across all cards). Defaults to
  // period so the chart still behaves like Robinhood when no cost basis
  // is recorded; clicking "vs Cost" gives a true unrealized P/L view
  // that no Robinhood-style competitor ships out of the box.
  const hasCost = costBasisUsd != null && costBasisUsd > 0;
  const [basis, setBasis] = useState<"period" | "cost">("period");
  useEffect(() => {
    // If cost basis disappears (user deleted last cost-recorded card),
    // snap back to "period" so the chip doesn't show stale state.
    if (!hasCost && basis === "cost") setBasis("period");
  }, [hasCost, basis]);

  // Gate on auth so neither query fires before the stored token is attached
  // on cold boot (that race rendered a permanent "No history yet" until a
  // pull-to-refresh). They auto-fetch the moment `isAuthenticated` flips true.
  const { isAuthenticated } = useAuth();
  const history = usePortfolioHistory({ timeframe: range, enabled: isAuthenticated });
  const overlay = useMarketIndex({
    indexId: "psa10",
    range,
    enabled: showPsa10Overlay && isAuthenticated,
  });

  const data = history.data;
  const points = data?.points;

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

  // PSA-10 benchmark overlay. Reuses the portfolio's x-domain (index → x) and
  // y-scale (so the overlay line is visually comparable). Each index
  // value is converted to "portfolio-equivalent dollars" by scaling the
  // normalized series (first point = 100) up to the portfolio's first
  // value. That guarantees both lines start at the same baselineY and
  // the vertical gap at any later x reads as relative outperformance.
  // Returns the path AND the equivalent-USD values so the scrub tooltip
  // can read the benchmark at any x.
  const bench = useMemo(() => {
    if (
      !showPsa10Overlay ||
      !points ||
      points.length < 2 ||
      width === 0 ||
      !overlay.data ||
      overlay.data.points.length < 2
    ) {
      return null;
    }
    const portfolioFirst = points[0]!.priceUsd;
    if (portfolioFirst <= 0) return null;
    const ys = points.map((pt) => pt.priceUsd);
    const lo = Math.min(...ys);
    const hi = Math.max(...ys);
    const PAD_Y = 18;
    const yScale = (v: number) => {
      if (hi === lo) return CHART_HEIGHT / 2;
      return PAD_Y + (1 - (v - lo) / (hi - lo)) * (CHART_HEIGHT - PAD_Y * 2);
    };
    const op = overlay.data.points;
    const xScale = (i: number) => (i / (op.length - 1)) * width;
    const equivUsd = op.map((pt) => (pt.indexValue / 100) * portfolioFirst);
    const coords = equivUsd.map((v, i) => [xScale(i), yScale(v)] as const);
    return {
      path: monotoneCubic(coords),
      equivUsd,
      deltaPct: overlay.data.deltaPct,
      cohortSize: overlay.data.cohortSize,
    };
  }, [showPsa10Overlay, overlay.data, points, width]);
  const overlayPath = bench?.path ?? "";

  const latestVal = points?.[points.length - 1]?.priceUsd ?? fallbackTotal;
  const firstVal = points?.[0]?.priceUsd ?? latestVal;

  const scrubIdx = scrub !== null && coords.length > 0 ? nearestIndex(scrub, coords) : null;
  const displayVal = scrubIdx !== null ? points![scrubIdx]!.priceUsd : latestVal;
  // Delta basis. "period" uses the first point on the visible chart so
  // the % matches the active timeframe (Robinhood behavior). "cost"
  // uses the user's total purchase price so the chip shows true
  // unrealized P/L regardless of timeframe. We swap silently if cost
  // basis is missing to avoid a divide-by-zero "NaN%" flash.
  const basisVal =
    basis === "cost" && hasCost ? (costBasisUsd as number) : firstVal;
  const displayDeltaUsd = displayVal - basisVal;
  const displayDeltaPct = basisVal > 0 ? (displayDeltaUsd / basisVal) * 100 : 0;
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

  // Robinhood-style scrub tick — a tiny selection haptic each time the
  // crosshair snaps to a new point (respects the haptics preference).
  const hapticsEnabled = useSettings((s) => s.hapticsEnabled);
  const lastHapticIdx = useRef<number | null>(null);
  useEffect(() => {
    if (scrubIdx === null) {
      lastHapticIdx.current = null;
      return;
    }
    if (scrubIdx !== lastHapticIdx.current) {
      lastHapticIdx.current = scrubIdx;
      if (hapticsEnabled) Haptics.selectionAsync().catch(() => {});
    }
  }, [scrubIdx, hapticsEnabled]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const scrubX = scrubIdx !== null ? coords[scrubIdx]![0] : null;
  const scrubY = scrubIdx !== null ? coords[scrubIdx]![1] : null;
  const scrubLabel = scrubIdx !== null ? points![scrubIdx]!.date : null;

  // Benchmark value at the scrub position (fraction of plot width → nearest
  // overlay bucket), so the tooltip compares You vs PSA-10 at the same date.
  const benchAtScrub =
    bench && scrubX !== null && width > 0
      ? bench.equivUsd[
          Math.round((scrubX / width) * (bench.equivUsd.length - 1))
        ] ?? null
      : null;

  // Outperformance vs the PSA-10 cohort over the visible period, in points
  // (your period % − cohort period %). Only meaningful on the period basis.
  const portfolioPeriodPct =
    firstVal > 0 ? ((latestVal - firstVal) / firstVal) * 100 : null;
  const outperformPts =
    bench && portfolioPeriodPct !== null
      ? portfolioPeriodPct - bench.deltaPct
      : null;

  // High/low watermarks for the visible window (Robinhood expanded style).
  const hiLo = useMemo(() => {
    if (!points || points.length < 2 || coords.length !== points.length)
      return null;
    let loI = 0;
    let hiI = 0;
    points.forEach((pt, i) => {
      if (pt.priceUsd < points[loI]!.priceUsd) loI = i;
      if (pt.priceUsd > points[hiI]!.priceUsd) hiI = i;
    });
    if (loI === hiI) return null;
    return {
      hi: { c: coords[hiI]!, v: points[hiI]!.priceUsd },
      lo: { c: coords[loI]!, v: points[loI]!.priceUsd },
    };
  }, [points, coords]);

  // Pulsing LIVE indicator for the 1D range.
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
      {/* Hero value */}
      <View>
        <View className="flex-row items-end justify-between">
          <Text
            className="font-semibold text-ink"
            style={{
              fontSize: 36,
              lineHeight: 40,
              letterSpacing: -1.2,
              // Tabular numerals keep digits a fixed width so the
              // headline value doesn't jitter as the scrubber moves
              // across the chart.
              fontVariant: ["tabular-nums"],
            }}
          >
            {money(displayVal)}
          </Text>
          {/* Currency bubble — Robinhood-style: lives next to the headline value
              it denominates, opens a native bottom-sheet picker. */}
          <Pressable
            onPress={() => setPickerOpen(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Currency ${ccyMeta.code}. Tap to change.`}
            className="flex-row items-center gap-1.5 rounded-full border px-2.5 py-1.5"
            style={({ pressed }) => ({
              opacity: pressed ? 0.75 : 1,
              borderColor: withAlpha(ccyTint, 0.45),
              backgroundColor: withAlpha(ccyTint, 0.12),
              marginBottom: 4,
            })}
          >
            <Text style={{ fontSize: 12 }}>{ccyMeta.flag}</Text>
            <Text
              style={{
                color: ccyTint,
                fontSize: 11,
                fontWeight: "800",
                letterSpacing: 0.6,
              }}
            >
              {ccyMeta.code}
            </Text>
            <ChevronDown size={11} color={ccyTint} strokeWidth={2.6} />
          </Pressable>
        </View>

        {/* flex-wrap: the delta + date + basis toggle + benchmark chip can
            exceed one line on small phones — wrap instead of clipping. */}
        <View className="mt-1 flex-row flex-wrap items-center gap-2">
          <Text style={{ color: tint, fontSize: 12 }}>{up ? "▲" : "▼"}</Text>
          <Text style={{ color: tint, fontSize: 14, fontWeight: "600" }}>
            {up ? "+" : ""}
            {money(displayDeltaUsd)} ({up ? "+" : ""}
            {displayDeltaPct.toFixed(2)}%)
          </Text>
          <Text className="text-sm text-ink-muted">
            {scrubLabel
              ? formatScrubDate(scrubLabel, range)
              : basis === "cost"
              ? "vs Cost"
              : labelForRange(range)}
          </Text>
          {hasCost ? (
            <BasisToggle basis={basis} tint={tint} onChange={setBasis} />
          ) : null}
          {bench && outperformPts !== null && !scrubLabel ? (
            /* Benchmark verdict chip — "you vs the PSA-10 market" in points.
               The single most interesting number a collector's chart can show. */
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                marginLeft: 4,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 999,
                backgroundColor: withAlpha(
                  outperformPts >= 0 ? p.accent.mint : p.accent.amber,
                  0.12,
                ),
              }}
              accessibilityLabel={`Your portfolio ${
                outperformPts >= 0 ? "beats" : "trails"
              } the PSA-10 index by ${Math.abs(outperformPts).toFixed(1)} points this period`}
            >
              <View
                style={{
                  width: 12,
                  height: 2,
                  borderRadius: 1,
                  backgroundColor: p.accent.blue,
                }}
              />
              <Text
                style={{
                  color: outperformPts >= 0 ? p.accent.mint : p.accent.amber,
                  fontSize: 10,
                  fontWeight: "800",
                  letterSpacing: 0.3,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {outperformPts >= 0 ? "+" : "−"}
                {Math.abs(outperformPts).toFixed(1)} pts vs PSA-10
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Chart */}
      <View
        onLayout={onLayout}
        style={{
          height: CHART_HEIGHT,
          marginTop: 14,
          // Negative horizontal margin lets the plot run edge-to-edge
          // on screens whose ScrollView already pads at `bleedX`. The
          // header rows above and pills below stay inside the padding
          // so text never touches the device bezel. Bleed is clamped
          // by the safe-area insets so the SVG never hides behind
          // notches, rounded corners, or landscape sensor housings —
          // works the same on every phone and iPad.
          marginLeft: -bleedLeft,
          marginRight: -bleedRight,
        }}
        {...panResponder.panHandlers}
      >
        {width > 0 && pathLine ? (
          <>
            <Svg width={width} height={CHART_HEIGHT}>
              <Defs>
                <SvgGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={tint} stopOpacity="0.25" />
                  <Stop offset="100%" stopColor={tint} stopOpacity="0" />
                </SvgGradient>
              </Defs>
              <Path d={pathArea} fill="url(#portfolioFill)" />
              {/* PSA-10 benchmark — a real compare line (brand blue, dashed)
                  drawn before the baseline + main line so it sits behind. */}
              {overlayPath ? (
                <Path
                  d={overlayPath}
                  stroke={p.accent.blue}
                  strokeWidth={1.5}
                  strokeDasharray="4,4"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  fill="none"
                  opacity={0.75}
                />
              ) : null}
              {/* Period-start baseline (Robinhood's signature dashed flat line) */}
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
              {/* High/low watermarks — tiny labels at the period extremes
                  (hidden while scrubbing so they never fight the crosshair). */}
              {hiLo && scrubX === null ? (
                <>
                  <SvgText
                    x={Math.min(Math.max(hiLo.hi.c[0], 26), width - 26)}
                    y={Math.max(10, hiLo.hi.c[1] - 8)}
                    fontSize={9}
                    fontWeight="700"
                    fill={p.ink.dim}
                    textAnchor="middle"
                  >
                    {`H ${money(hiLo.hi.v)}`}
                  </SvgText>
                  <SvgText
                    x={Math.min(Math.max(hiLo.lo.c[0], 26), width - 26)}
                    y={Math.min(CHART_HEIGHT - 4, hiLo.lo.c[1] + 14)}
                    fontSize={9}
                    fontWeight="700"
                    fill={p.ink.dim}
                    textAnchor="middle"
                  >
                    {`L ${money(hiLo.lo.v)}`}
                  </SvgText>
                </>
              ) : null}
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

            {/* Floating crosshair tooltip. Single value flag normally; a
                You-vs-PSA-10 compare card when the benchmark is overlaid. */}
            {scrubX !== null ? (
              benchAtScrub !== null ? (
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: clampLabelX(scrubX, width, 156),
                    width: 156,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: withAlpha(p.line.default, 0.8),
                    backgroundColor: withAlpha(p.bg.elevated, 0.97),
                    paddingHorizontal: 10,
                    paddingVertical: 7,
                    gap: 4,
                    shadowColor: "#000",
                    shadowOpacity: 0.12,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: 4,
                  }}
                >
                  <TipRow
                    color={tint}
                    label="You"
                    value={money(displayVal)}
                    ink={p.ink}
                  />
                  <TipRow
                    color={p.accent.blue}
                    label="PSA-10"
                    value={money(benchAtScrub)}
                    ink={p.ink}
                  />
                  <Text
                    style={{
                      color:
                        displayVal >= benchAtScrub ? p.accent.mint : p.accent.amber,
                      fontSize: 9.5,
                      fontWeight: "800",
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {displayVal >= benchAtScrub ? "▲ ahead " : "▼ behind "}
                    {money(Math.abs(displayVal - benchAtScrub))}
                  </Text>
                </View>
              ) : (
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
                      {money(displayVal)}
                    </Text>
                  </View>
                </View>
              )
            ) : null}
          </>
        ) : (
          <ChartPlaceholder
            height={CHART_HEIGHT}
            width={width}
            loading={history.isLoading}
            tint={tint}
          />
        )}
      </View>

      {/* Range pill row — Robinhood-style: bare label row with one chip-highlighted active range, hairline below */}
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
              style={{
                color: tint,
                fontSize: 11,
                fontWeight: "700",
                letterSpacing: 0.6,
              }}
            >
              LIVE
            </Text>
          </View>
        ) : null}
        {RANGES.map((r) => (
          <RangePill
            key={r}
            label={r}
            active={r === range}
            tint={tint}
            onPress={() => setRange(r)}
          />
        ))}
      </View>

      <CurrencyPickerSheet
        visible={pickerOpen}
        selected={currency}
        onSelect={setCurrency}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

function RangePill({
  label,
  active,
  tint,
  onPress,
}: {
  label: string;
  active: boolean;
  tint: string;
  onPress: () => void;
}) {
  const p = useThemedPalette();
  // Match the rest of the app's tap feedback — the pill briefly
  // scales down on press to confirm the touch landed.
  const { scale, onPressIn, onPressOut } = usePressScale();
  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Animated.View
        style={{
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: active ? withAlpha(tint, 0.15) : "transparent",
          transform: [{ scale }],
        }}
      >
        <Text
          style={{
            color: active ? tint : p.ink.muted,
            fontSize: 11,
            fontWeight: "700",
            letterSpacing: 0.6,
          }}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function getX(e: GestureResponderEvent): number {
  return e.nativeEvent.locationX;
}

/** One dot·label·value line inside the You-vs-benchmark scrub tooltip. */
function TipRow({
  color,
  label,
  value,
  ink,
}: {
  color: string;
  label: string;
  value: string;
  ink: { muted: string; default: string };
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View
        style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }}
      />
      <Text
        style={{ flex: 1, color: ink.muted, fontSize: 11, fontWeight: "600" }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: ink.default,
          fontSize: 11,
          fontWeight: "800",
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * Small pill that flips the hero delta between "vs period start" (the
 * Robinhood default) and "vs Cost" (true unrealized P/L using the user's
 * recorded purchase prices). Only mounted when cost basis is available.
 */
function BasisToggle({
  basis,
  tint,
  onChange,
}: {
  basis: "period" | "cost";
  tint: string;
  onChange: (next: "period" | "cost") => void;
}) {
  const p = useThemedPalette();
  const isCost = basis === "cost";
  const label = isCost ? "vs Cost" : "vs Start";
  return (
    <Pressable
      onPress={() => onChange(isCost ? "period" : "cost")}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`Toggle delta basis. Currently ${label}.`}
      style={({ pressed }) => ({
        opacity: pressed ? 0.7 : 1,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: isCost ? withAlpha(tint, 0.55) : withAlpha(p.ink.dim, 0.4),
        backgroundColor: isCost ? withAlpha(tint, 0.14) : "transparent",
        marginLeft: 4,
      })}
    >
      <Text
        style={{
          color: isCost ? tint : p.ink.muted,
          fontSize: 10,
          fontWeight: "700",
          letterSpacing: 0.5,
        }}
      >
        {label.toUpperCase()}
      </Text>
    </Pressable>
  );
}

/**
 * Placeholder shown when there is no chart data yet. Two modes:
 *  - `loading=true`  \u2192 shimmering bar that sweeps left-to-right so the
 *                       area doesn't read as a dead gray rectangle.
 *  - `loading=false` \u2192 friendly empty state ("No history yet") layered
 *                       over faint gridlines so users see the chart's
 *                       intended shape instead of a blank slab.
 */
function ChartPlaceholder({
  height,
  width,
  loading,
  tint,
}: {
  height: number;
  width: number;
  loading: boolean;
  tint: string;
}) {
  const p = useThemedPalette();
  const sweep = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!loading) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(sweep, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [loading, sweep]);

  // A faint, neutral "ghost" curve so the empty chart reads as a chart awaiting
  // data — not a dead box. Deliberately gray (not the brand mint) so it never
  // looks like real data, and dashed to signal "placeholder".
  const ghost = useMemo(() => {
    if (width === 0) return { line: "", area: "" };
    const norm = [0.62, 0.54, 0.66, 0.5, 0.58, 0.44, 0.38];
    const PAD_Y = 26;
    const coords = norm.map(
      (y, i) =>
        [
          (i / (norm.length - 1)) * width,
          PAD_Y + y * (height - PAD_Y * 2),
        ] as const,
    );
    const line = monotoneCubic(coords);
    const area = line + ` L ${width} ${height} L 0 ${height} Z`;
    return { line, area };
  }, [width, height]);

  const gridLine = withAlpha(p.ink.dim, 0.18);
  const shimmerOpacity = sweep.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.7] });

  return (
    <View
      style={{
        height,
        borderRadius: 14,
        backgroundColor: withAlpha(p.ink.dim, 0.05),
        borderWidth: 1,
        borderColor: withAlpha(p.ink.dim, 0.12),
        overflow: "hidden",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Faint gridlines hint at the chart's eventual shape */}
      {[0.25, 0.5, 0.75].map((r) => (
        <View
          key={r}
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            top: height * r,
            height: 1,
            backgroundColor: gridLine,
          }}
        />
      ))}

      {/* Ghost curve (only when there's room to draw it) sits behind the copy. */}
      {!loading && width > 0 && ghost.line ? (
        <Svg
          width={width}
          height={height}
          style={{ position: "absolute", left: 0, top: 0 }}
          pointerEvents="none"
        >
          <Defs>
            <SvgGradient id="ghostFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={p.ink.dim} stopOpacity="0.12" />
              <Stop offset="100%" stopColor={p.ink.dim} stopOpacity="0" />
            </SvgGradient>
          </Defs>
          <Path d={ghost.area} fill="url(#ghostFill)" />
          <Path
            d={ghost.line}
            stroke={withAlpha(p.ink.dim, 0.5)}
            strokeWidth={2}
            strokeDasharray="5,6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      ) : null}

      {loading ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            height: 2,
            borderRadius: 1,
            backgroundColor: tint,
            opacity: shimmerOpacity,
          }}
        />
      ) : (
        <View pointerEvents="none" style={{ alignItems: "center", paddingHorizontal: 16 }}>
          <Text
            style={{
              color: p.ink.muted,
              fontSize: 13,
              fontWeight: "700",
              letterSpacing: 0.3,
            }}
          >
            No history yet
          </Text>
          <Text
            style={{
              marginTop: 4,
              color: p.ink.dim,
              fontSize: 11,
              textAlign: "center",
              maxWidth: 240,
            }}
          >
            Scan a card to start charting your portfolio.
          </Text>
        </View>
      )}
    </View>
  );
}

function labelForRange(r: PortfolioRange): string {
  switch (r) {
    case "1D": return "Today";
    case "1W": return "Past Week";
    case "1M": return "Past Month";
    case "3M": return "Past 3 Months";
    case "YTD": return "Year to Date";
    case "1Y": return "Past Year";
    case "ALL": return "All Time";
  }
}

function formatScrubDate(iso: string, range: PortfolioRange): string {
  const d = new Date(iso);
  if (range === "1D") {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  if (range === "1W") {
    return d.toLocaleString([], { weekday: "short", hour: "numeric" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "2-digit" });
}
