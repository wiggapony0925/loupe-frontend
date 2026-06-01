/**
 * Interactive price chart for the card-detail screen.
 *
 * Robinhood-style scrubber: tap-and-drag anywhere on the line to reveal
 * a vertical crosshair, a moving dot, and a floating tooltip showing
 * the price + date at that point. Lifting the finger restores the
 * latest (rightmost) value. A pill row beneath the chart switches
 * timeframe (1D · 1W · 1M · 3M · YTD · 1Y · ALL).
 *
 * Data comes from `MarketSnapshotWire.history` (see
 * `/v1/cards/{id}/market`). Backend exposes `7d / 30d / 90d / 1y / all`
 * series; `1W` maps to `7d`, `1D` is intentionally disabled because the
 * synthetic source has no intraday resolution.
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCardPriceHistory } from "@/application/queries/catalog/useCardPriceHistory";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import {
  clampLabelX,
  monotoneCubic,
  nearestIndex,
  type Coord,
} from "@/domain/charts";
import type {
  MarketSnapshotWire,
  PriceHistoryWire,
} from "@/infrastructure/http";

export type CardRangeKey = "1D" | "1W" | "1M" | "3M" | "YTD" | "1Y" | "ALL";

const RANGE_KEYS: CardRangeKey[] = ["1D", "1W", "1M", "3M", "YTD", "1Y", "ALL"];

/** Map a UI range to the backend history bucket. `null` = unavailable. */
const RANGE_TO_HISTORY: Record<
  CardRangeKey,
  keyof MarketSnapshotWire["history"] | null
> = {
  "1D": null, // intraday not generated
  "1W": "7d",
  "1M": "30d",
  "3M": "90d",
  YTD: "1y",
  "1Y": "1y",
  ALL: "all",
};

const CHART_HEIGHT = 220;
const PAD_Y = 18;

function formatUsd(v: number): string {
  if (!isFinite(v)) return "—";
  return v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function formatDate(iso: string, range: CardRangeKey): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (range === "1D" || range === "1W") {
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface InteractiveCardChartProps {
  history: MarketSnapshotWire["history"] | undefined;
  range: CardRangeKey;
  onRangeChange: (r: CardRangeKey) => void;
  /** Fallback shown when the active series is unavailable or empty. */
  fallbackAmount?: number | null;
  /**
   * When provided, the chart fetches a per-(house, grade) series
   * scaled by the same drift × multiplier math that produces the
   * graded-row table — so tapping a grade row visibly filters the
   * chart to that specific tier instead of the raw market line.
   */
  cardId?: string;
  houseFilter?: string;
  gradeFilter?: string;
  /**
   * Horizontal bleed in points applied to **only** the chart plot
   * (SVG + scrub overlay). Hero value row and timeframe pills stay
   * within the parent's padding. Pass the consumer's horizontal
   * padding to make the plot run full-bleed to the screen edges —
   * matches `PortfolioChart`'s `bleedX` semantics. Defaults to 0.
   */
  bleedX?: number;
  /**
   * Fired when the user starts (`true`) and stops (`false`) dragging on
   * the chart. The host screen uses this to suspend the navigator's
   * swipe-back gesture while scrubbing, so a left→right drag scrubs the
   * price instead of popping the page.
   */
  onScrubbingChange?: (active: boolean) => void;
}

export function InteractiveCardChart({
  history,
  range,
  onRangeChange,
  fallbackAmount = null,
  cardId,
  houseFilter,
  gradeFilter,
  bleedX = 0,
  onScrubbingChange,
}: InteractiveCardChartProps) {
  const p = useThemedPalette();
  const insets = useSafeAreaInsets();
  // Per-side bleed clamped to the safe area — matches PortfolioChart.
  const bleedLeft = Math.max(0, bleedX - insets.left);
  const bleedRight = Math.max(0, bleedX - insets.right);
  const [width, setWidth] = useState(0);
  // Store the raw touch X — NOT the resolved index. The PanResponder is
  // created once (ref) so any closure it captures is frozen to the
  // first render, when `coords` is empty and `width` is 0. Capturing the
  // index there would permanently disable scrubbing. Instead we stash the
  // raw X and resolve the index from the *live* coords during render —
  // exactly how PortfolioChart's working scrubber does it.
  const [scrubX, setScrubX] = useState<number | null>(null);

  const historyKey = RANGE_TO_HISTORY[range];
  const filterActive =
    !!cardId && !!houseFilter && houseFilter !== "raw" && historyKey !== null;
  const filteredQuery = useCardPriceHistory({
    id: filterActive ? cardId : null,
    range: (historyKey ?? "30d") as "7d" | "30d" | "90d" | "1y" | "all",
    house: houseFilter,
    grade: gradeFilter,
    enabled: filterActive,
  });
  const series: PriceHistoryWire | undefined = filterActive
    ? filteredQuery.data
    : historyKey
      ? history?.[historyKey]
      : undefined;

  const points = useMemo(() => series?.points ?? [], [series]);

  const coords: Coord[] = useMemo(() => {
    if (points.length < 2 || width <= 0) return [];
    const values = points.map((pt) => pt.price);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const stride = width / (points.length - 1);
    const plotH = CHART_HEIGHT - PAD_Y * 2;
    return points.map((pt, i) => {
      const y = PAD_Y + plotH - ((pt.price - min) / range) * plotH;
      return [i * stride, y] as Coord;
    });
  }, [points, width]);

  const linePath = useMemo(() => monotoneCubic(coords), [coords]);
  const areaPath = useMemo(() => {
    if (coords.length < 2) return "";
    const last = coords[coords.length - 1]!;
    const first = coords[0]!;
    return `${linePath} L ${last[0]} ${CHART_HEIGHT} L ${first[0]} ${CHART_HEIGHT} Z`;
  }, [coords, linePath]);

  // Resolve the scrub index from the current coords every render so the
  // crosshair tracks the finger even as the series/width change.
  const scrubIdx =
    scrubX !== null && coords.length > 1 ? nearestIndex(scrubX, coords) : null;
  const firstPrice = points[0]?.price ?? null;
  const lastPrice = points[points.length - 1]?.price ?? null;
  const activeIdx =
    scrubIdx ?? (points.length ? points.length - 1 : 0);
  const activePoint = points[activeIdx];
  const activePrice = activePoint?.price ?? lastPrice ?? fallbackAmount ?? null;

  const baseForDelta = firstPrice ?? 0;
  const deltaUsd =
    activePrice !== null && firstPrice !== null
      ? activePrice - firstPrice
      : null;
  const deltaPct =
    deltaUsd !== null && baseForDelta > 0
      ? (deltaUsd / baseForDelta) * 100
      : null;
  const positive = (deltaPct ?? 0) >= 0;
  const lineColor = positive ? p.accent.mint : p.accent.rose;

  // Baseline (period start) y — for the dashed reference line.
  const baselineY = coords[0]?.[1] ?? null;

  // Keep the latest scrub callback in a ref so the ref-held responder
  // (created once) always calls the current prop without going stale.
  const onScrubbingChangeRef = useRef(onScrubbingChange);
  onScrubbingChangeRef.current = onScrubbingChange;

  // Touch handlers — store only the raw X. Inline arrows keep the
  // ref-held responder free of stale `coords`/`width` closures; the
  // index is computed in render (see `scrubIdx`).
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Claim the gesture on touch start so the navigator's edge
      // swipe-back never gets a chance to capture a left→right drag
      // that begins on the chart.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        onScrubbingChangeRef.current?.(true);
        setScrubX(e.nativeEvent.locationX);
      },
      onPanResponderMove: (e: GestureResponderEvent) =>
        setScrubX(e.nativeEvent.locationX),
      onPanResponderRelease: () => {
        onScrubbingChangeRef.current?.(false);
        setScrubX(null);
      },
      onPanResponderTerminate: () => {
        onScrubbingChangeRef.current?.(false);
        setScrubX(null);
      },
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  };

  const disabled = historyKey === null;
  const empty = !disabled && (!series || points.length < 2);

  return (
    <View>
      {/* Hero value + delta (responds live to scrubber) */}
      <View>
        {activePrice !== null ? (
          <Text
            style={{
              color: p.ink.default,
              fontSize: 36,
              lineHeight: 40,
              letterSpacing: -1.2,
              fontWeight: "700",
              // Tabular numerals keep digits fixed-width so the
              // headline doesn't jitter as the scrubber moves.
              fontVariant: ["tabular-nums"],
            }}
          >
            {formatUsd(activePrice)}
          </Text>
        ) : (
          <Text
            style={{
              color: p.ink.muted,
              fontSize: 36,
              lineHeight: 40,
              fontWeight: "700",
            }}
          >
            —
          </Text>
        )}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginTop: 4,
          }}
        >
          {deltaPct !== null ? (
            <>
              <Text style={{ color: lineColor, fontSize: 12 }}>
                {positive ? "▲" : "▼"}
              </Text>
              <Text
                style={{
                  color: lineColor,
                  fontSize: 14,
                  fontWeight: "600",
                  fontVariant: ["tabular-nums"],
                }}
              >
                {positive ? "+" : ""}
                {formatUsd(deltaUsd ?? 0).replace("-", "")} (
                {positive ? "+" : ""}
                {deltaPct.toFixed(2)}%)
              </Text>
            </>
          ) : null}
          <Text style={{ color: p.ink.muted, fontSize: 13 }}>
            {scrubIdx !== null && activePoint
              ? formatDate(activePoint.ts, range)
              : disabled
                ? "Intraday history unavailable"
                : empty
                  ? "No history"
                  : range === "ALL"
                    ? "All-time"
                    : `Past ${range}`}
          </Text>
        </View>
      </View>

      {/* Chart plot — edge-to-edge, no container chrome */}
      <View
        onLayout={onLayout}
        {...panResponder.panHandlers}
        style={{
          height: CHART_HEIGHT,
          marginTop: 14,
          marginLeft: -bleedLeft,
          marginRight: -bleedRight,
        }}
      >
        {disabled || empty || width <= 0 ? (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: p.ink.dim, fontSize: 11 }}>
              {disabled
                ? "Intraday history coming soon"
                : "No history available"}
            </Text>
          </View>
        ) : (
          <>
            <Svg width={width} height={CHART_HEIGHT}>
              <Defs>
                <SvgGradient
                  id="cardChartFill"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <Stop
                    offset="0%"
                    stopColor={lineColor}
                    stopOpacity={0.25}
                  />
                  <Stop
                    offset="100%"
                    stopColor={lineColor}
                    stopOpacity={0}
                  />
                </SvgGradient>
              </Defs>
              {/* Gradient fill (drawn first so it sits behind everything) */}
              <Path d={areaPath} fill="url(#cardChartFill)" />
              {/* Period-start baseline */}
              {baselineY !== null ? (
                <Line
                  x1={0}
                  y1={baselineY}
                  x2={width}
                  y2={baselineY}
                  stroke={p.ink.dim}
                  strokeWidth={0.75}
                  strokeDasharray="2,4"
                  opacity={0.55}
                />
              ) : null}
              {/* Main line */}
              <Path
                d={linePath}
                stroke={lineColor}
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Scrubber */}
              {scrubIdx !== null && coords[activeIdx] ? (
                <>
                  <Line
                    x1={coords[activeIdx]![0]}
                    y1={0}
                    x2={coords[activeIdx]![0]}
                    y2={CHART_HEIGHT}
                    stroke={p.ink.muted}
                    strokeWidth={0.5}
                    strokeDasharray="2,3"
                    opacity={0.7}
                  />
                  <Circle
                    cx={coords[activeIdx]![0]}
                    cy={coords[activeIdx]![1]}
                    r={9}
                    fill={withAlpha(lineColor, 0.18)}
                  />
                  <Circle
                    cx={coords[activeIdx]![0]}
                    cy={coords[activeIdx]![1]}
                    r={5}
                    fill={p.bg.elevated}
                  />
                  <Circle
                    cx={coords[activeIdx]![0]}
                    cy={coords[activeIdx]![1]}
                    r={3.5}
                    fill={lineColor}
                  />
                </>
              ) : (
                coords[coords.length - 1] && (
                  <>
                    <Circle
                      cx={coords[coords.length - 1]![0]}
                      cy={coords[coords.length - 1]![1]}
                      r={6}
                      fill={withAlpha(lineColor, 0.22)}
                    />
                    <Circle
                      cx={coords[coords.length - 1]![0]}
                      cy={coords[coords.length - 1]![1]}
                      r={3}
                      fill={lineColor}
                    />
                  </>
                )
              )}
            </Svg>

            {/* Floating tooltip pinned above the scrubber */}
            {scrubIdx !== null && coords[activeIdx] ? (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: 0,
                  left: clampLabelX(coords[activeIdx]![0], width, 96),
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
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {formatUsd(activePrice ?? 0)}
                  </Text>
                </View>
              </View>
            ) : null}
          </>
        )}
      </View>

      {/* Range pill row — bare label row with one chip-highlighted
          active range, hairline below (matches PortfolioChart). */}
      <View
        style={{
          marginTop: 16,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: withAlpha(p.line.default, 0.6),
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {RANGE_KEYS.map((k) => {
          const active = range === k;
          const pillDisabled = RANGE_TO_HISTORY[k] === null;
          return (
            <Pressable
              key={k}
              disabled={pillDisabled}
              onPress={() => onRangeChange(k)}
              hitSlop={6}
              style={({ pressed }) => ({
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 999,
                backgroundColor: active
                  ? withAlpha(lineColor, 0.14)
                  : "transparent",
                opacity: pillDisabled ? 0.3 : pressed ? 0.65 : 1,
              })}
            >
              <Text
                style={{
                  color: active ? lineColor : p.ink.muted,
                  fontSize: 11,
                  fontWeight: active ? "800" : "700",
                  letterSpacing: 0.6,
                }}
              >
                {k}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
