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
} from "react-native-svg";
import { ChevronDown } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { fetchPortfolioHistory, type PortfolioRange } from "@/api/forensicApi";
import { useThemedPalette, withAlpha } from "@/theme/tokens";
import { compactUsd } from "@/lib/format";
import { getCurrency } from "@/lib/currency";
import { useSettings } from "@/store/settingsStore";
import { CurrencyPickerSheet } from "@/components/ui/CurrencyPickerSheet";
import { clampLabelX, monotoneCubic, nearestIndex } from "@/lib/chart";

const RANGES: PortfolioRange[] = ["1D", "1W", "1M", "3M", "YTD", "1Y", "ALL"];
const CHART_HEIGHT = 200;

interface PortfolioChartProps {
  /** Live total to anchor the right-edge value when the API is loading. */
  fallbackTotal?: number;
}

export function PortfolioChart({ fallbackTotal = 0 }: PortfolioChartProps) {
  const p = useThemedPalette();
  const [range, setRange] = useState<PortfolioRange>("1Y");
  const [width, setWidth] = useState(0);
  const currency = useSettings((s) => s.currency);
  const setCurrency = useSettings((s) => s.setCurrency);
  const [pickerOpen, setPickerOpen] = useState(false);
  const ccyMeta = getCurrency(currency);
  const ccyTint = ccyMeta.kind === "crypto" ? p.accent.amber : p.accent.mint;
  const [scrub, setScrub] = useState<number | null>(null);

  const history = useQuery({
    queryKey: ["portfolio-history", range],
    queryFn: () => fetchPortfolioHistory(range),
    staleTime: 60_000,
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

  const latestVal = points?.[points.length - 1]?.priceUsd ?? fallbackTotal;
  const firstVal = points?.[0]?.priceUsd ?? latestVal;

  const scrubIdx = scrub !== null && coords.length > 0 ? nearestIndex(scrub, coords) : null;
  const displayVal = scrubIdx !== null ? points![scrubIdx]!.priceUsd : latestVal;
  const displayDeltaUsd = displayVal - firstVal;
  const displayDeltaPct = firstVal > 0 ? (displayDeltaUsd / firstVal) * 100 : 0;
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
  const scrubLabel = scrubIdx !== null ? points![scrubIdx]!.date : null;

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
            style={{ fontSize: 36, lineHeight: 40, letterSpacing: -0.6 }}
          >
            {compactUsd(displayVal)}
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
      </View>

      {/* Chart */}
      <View
        onLayout={onLayout}
        style={{ height: CHART_HEIGHT, marginTop: 14 }}
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

            {/* Floating crosshair tooltip — positioned absolutely above the scrubber */}
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
          </>
        ) : (
          <View
            style={{
              height: CHART_HEIGHT,
              borderRadius: 12,
              backgroundColor: withAlpha(p.ink.dim, 0.06),
            }}
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
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: active ? withAlpha(tint, 0.15) : "transparent",
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
    </Pressable>
  );
}

function getX(e: GestureResponderEvent): number {
  return e.nativeEvent.locationX;
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
