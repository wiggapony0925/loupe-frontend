/**
 * Robinhood-style portfolio chart.
 *
 * Hero value + delta (arrow + $ + %), interactive SVG line with a
 * gradient fill and a touch-driven crosshair scrubber. A horizontal
 * dashed reference line marks the period start price (Robinhood's
 * signature flat baseline). Time-range pill row at the bottom.
 *
 * The hero value and delta update live as the user drags across the
 * chart. Lifting the finger restores the latest values.
 */
import React, { useMemo, useRef, useState } from "react";
import {
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
import { useQuery } from "@tanstack/react-query";
import { fetchPortfolioHistory, type PortfolioRange } from "@/api/forensicApi";
import { useThemedPalette, withAlpha } from "@/theme/tokens";
import { compactUsd } from "@/lib/format";

const RANGES: PortfolioRange[] = ["1D", "1W", "1M", "3M", "1Y", "ALL"];
const CHART_HEIGHT = 180;

interface PortfolioChartProps {
  /** Live total to anchor the right-edge value when the API is loading. */
  fallbackTotal?: number;
}

export function PortfolioChart({ fallbackTotal = 0 }: PortfolioChartProps) {
  const p = useThemedPalette();
  const [range, setRange] = useState<PortfolioRange>("1M");
  const [width, setWidth] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);

  const history = useQuery({
    queryKey: ["portfolio-history", range],
    queryFn: () => fetchPortfolioHistory(range),
    staleTime: 60_000,
  });

  const data = history.data;
  const points = data?.points;

  const { pathLine, pathArea, baselineY, coords, lo, hi } = useMemo(() => {
    if (!points || points.length < 2 || width === 0) {
      return { pathLine: "", pathArea: "", baselineY: 0, coords: [], lo: 0, hi: 0 };
    }
    const ys = points.map((pt) => pt.priceUsd);
    const lo = Math.min(...ys);
    const hi = Math.max(...ys);
    const PAD_Y = 14;
    const xScale = (i: number) => (i / (points.length - 1)) * width;
    const yScale = (v: number) => {
      if (hi === lo) return CHART_HEIGHT / 2;
      return PAD_Y + (1 - (v - lo) / (hi - lo)) * (CHART_HEIGHT - PAD_Y * 2);
    };
    const coords = points.map((pt, i) => [xScale(i), yScale(pt.priceUsd)] as const);
    const pathLine = coords
      .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`)
      .join(" ");
    const pathArea =
      pathLine +
      ` L ${coords[coords.length - 1]![0].toFixed(2)} ${CHART_HEIGHT} L ${coords[0]![0].toFixed(2)} ${CHART_HEIGHT} Z`;
    return { pathLine, pathArea, baselineY: yScale(points[0]!.priceUsd), coords, lo, hi };
  }, [points, width]);

  const latestVal = points?.[points.length - 1]?.priceUsd ?? fallbackTotal;
  const firstVal = points?.[0]?.priceUsd ?? latestVal;

  const scrubIdx = scrub !== null && coords.length > 0 ? clampIndex(scrub, coords) : null;
  const displayVal =
    scrubIdx !== null ? points![scrubIdx]!.priceUsd : latestVal;
  const displayDeltaUsd = displayVal - firstVal;
  const displayDeltaPct = firstVal > 0 ? (displayDeltaUsd / firstVal) * 100 : 0;
  const up = displayDeltaUsd >= 0;
  const tint = up ? p.accent.mint : p.accent.rose;

  // Hide-on-release pan responder. Tracks finger X across the SVG surface.
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

  return (
    <View>
      {/* Hero value */}
      <View>
        <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
          Portfolio Value
        </Text>
        <Text
          className="mt-1 font-semibold text-ink"
          style={{ fontSize: 38, lineHeight: 42, letterSpacing: -0.5 }}
        >
          {compactUsd(displayVal)}
        </Text>
        <View className="mt-1 flex-row items-center gap-2">
          <Text style={{ color: tint, fontSize: 14, fontWeight: "600" }}>
            {up ? "+" : ""}
            {compactUsd(displayDeltaUsd)} ({up ? "+" : ""}
            {displayDeltaPct.toFixed(2)}%)
          </Text>
          <Text className="text-xs text-ink-dim">
            {scrubLabel ? formatScrubDate(scrubLabel, range) : labelForRange(range)}
          </Text>
        </View>
      </View>

      {/* Chart */}
      <View
        onLayout={onLayout}
        style={{ height: CHART_HEIGHT, marginTop: 12 }}
        {...panResponder.panHandlers}
      >
        {width > 0 && pathLine ? (
          <Svg width={width} height={CHART_HEIGHT}>
            <Defs>
              <SvgGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={tint} stopOpacity="0.22" />
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
              strokeWidth={0.5}
              strokeDasharray="3,3"
              opacity={0.6}
            />
            <Path d={pathLine} stroke={tint} strokeWidth={2} fill="none" />
            {scrubX !== null && scrubY !== null ? (
              <>
                <Line
                  x1={scrubX}
                  x2={scrubX}
                  y1={0}
                  y2={CHART_HEIGHT}
                  stroke={p.ink.muted}
                  strokeWidth={0.5}
                  opacity={0.7}
                />
                <Circle cx={scrubX} cy={scrubY} r={6} fill={p.bg.elevated} />
                <Circle cx={scrubX} cy={scrubY} r={4} fill={tint} />
              </>
            ) : (
              <Circle
                cx={coords[coords.length - 1]![0]}
                cy={coords[coords.length - 1]![1]}
                r={3.5}
                fill={tint}
              />
            )}
          </Svg>
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

      {/* Range pill row */}
      <View
        className="mt-3 flex-row items-center justify-between rounded-full p-1"
        style={{ backgroundColor: withAlpha(p.ink.dim, 0.08) }}
      >
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

      {points && points.length >= 2 ? (
        <View className="mt-2 flex-row justify-between">
          <Text className="text-[10px] uppercase tracking-[2px] text-ink-dim">
            Low {compactUsd(lo)}
          </Text>
          <Text className="text-[10px] uppercase tracking-[2px] text-ink-dim">
            High {compactUsd(hi)}
          </Text>
        </View>
      ) : null}
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
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className="flex-1 items-center rounded-full py-1.5"
      style={{ backgroundColor: active ? withAlpha(tint, 0.18) : "transparent" }}
    >
      <Text
        className="text-[11px] font-bold tracking-wider"
        style={{ color: active ? tint : p.ink.muted }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function getX(e: GestureResponderEvent): number {
  return e.nativeEvent.locationX;
}

function clampIndex(x: number, coords: readonly (readonly [number, number])[]): number {
  if (coords.length === 0) return 0;
  // Find nearest index by x coordinate. Linear scan is fine for ≤ 200 pts.
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const d = Math.abs(coords[i]![0] - x);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

function labelForRange(r: PortfolioRange): string {
  switch (r) {
    case "1D": return "Today";
    case "1W": return "Past Week";
    case "1M": return "Past Month";
    case "3M": return "Past 3 Months";
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
