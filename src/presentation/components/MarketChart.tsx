/**
 * MarketChart (mobile) — the React Native twin of the web `MarketChart`.
 *
 * It renders the **exact same chart** as the web client because both feed the
 * shared, framework-agnostic `@loupe/chart` geometry the identical inputs and
 * draw the identical SVG path `d` strings — web with `<svg>`, mobile with
 * `react-native-svg`. The only platform-specific pieces are: width measurement
 * (`onLayout` vs ResizeObserver) and scrub input (gesture-handler vs pointer
 * events).
 *
 * Visual parity: gradient area fill, Catmull-Rom smoothed line, horizontal
 * gridlines with right-aligned value labels, anchored time-axis ticks,
 * color-by-change (mint↑ / rose↓) for single series, and a touch crosshair
 * with a price flag.
 */
import React, { useMemo, useRef, useState } from "react";
import { LayoutChangeEvent, Pressable, Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import {
  computeAvailableRanges,
  computeChartGeometry,
  DAY,
  nearestIndexByT,
  normalizeSeries,
  RANGE_LABEL,
  type ChartSeries,
  type RangeKey,
} from "@loupe/chart";
import { useSettings } from "@/application/stores/settingsStore";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

const PAD = { top: 12, right: 58, bottom: 22 };
const Y_TICKS = 4;

export interface MarketChartProps {
  series: ChartSeries[];
  height?: number;
  ranges?: RangeKey[];
  defaultRange?: RangeKey;
  /** Controlled range — host owns the data window (no client slicing). */
  range?: RangeKey;
  format?: (v: number) => string;
  formatTime?: (t: number) => string;
  /** Single series: shift line/area mint↔rose by period change (Robinhood). */
  colorByChange?: boolean;
  /** Show the big value + delta header above the plot. */
  header?: boolean;
  title?: string;
  smoothing?: boolean;
  /** Fill the area under each line. Off for multi-series compare (lines read
   *  cleaner without stacked gradients). Default true. */
  fillArea?: boolean;
  onRangeChange?: (r: RangeKey) => void;
  /**
   * Fired on scrub start (`true`) / end (`false`). The card screen uses this
   * to suspend the navigator's swipe-back gesture while the user drags across
   * the chart, so a left→right scrub never pops the page.
   */
  onScrubbingChange?: (active: boolean) => void;
}

const defaultFormat = (v: number) =>
  v.toLocaleString(undefined, { maximumFractionDigits: 2 });

export function MarketChart({
  series,
  height = 220,
  ranges = ["1W", "1M", "3M", "1Y", "ALL"],
  defaultRange,
  range: controlledRange,
  format = defaultFormat,
  formatTime,
  colorByChange = true,
  header = true,
  title,
  smoothing = true,
  fillArea = true,
  onRangeChange,
  onScrubbingChange,
}: MarketChartProps) {
  const p = useThemedPalette();
  const [width, setWidth] = useState(0);
  const controlled = controlledRange !== undefined;
  const [internalRange, setRange] = useState<RangeKey>(defaultRange ?? "1M");
  const range = controlled ? controlledRange : internalRange;
  const [active, setActive] = useState<number | null>(null);
  const hapticsEnabled = useSettings((s) => s.hapticsEnabled);
  const lastHapticIdx = useRef<number | null>(null);

  // Multi-series fallback palette (mirrors the web PALETTE order).
  const PALETTE = useMemo(
    () => [p.accent.blue, p.accent.purple, p.accent.amber, p.accent.mint],
    [p],
  );

  const norm = useMemo(() => normalizeSeries(series), [series]);

  const availableRanges = useMemo(
    () => computeAvailableRanges({ normalized: norm, ranges, controlled }),
    [norm, ranges, controlled],
  );

  const effectiveRange: RangeKey = controlled
    ? range
    : ((availableRanges.includes(range)
        ? range
        : availableRanges[availableRanges.length - 1]) ?? "ALL");

  const geo = useMemo(
    () =>
      computeChartGeometry({
        normalized: norm,
        effectiveRange,
        controlled,
        width,
        height,
        smoothing,
        padding: PAD,
        palette: PALETTE,
      }),
    [norm, effectiveRange, controlled, width, height, smoothing, PALETTE],
  );

  // Span-aware default time formatter (matches the web).
  const fmtTime = useMemo(() => {
    if (formatTime) return formatTime;
    const spanDays = (geo.tHi - geo.tMin) / DAY;
    if (spanDays > 730)
      return (t: number) =>
        new Date(t).toLocaleDateString(undefined, { year: "numeric" });
    if (spanDays > 75)
      return (t: number) =>
        new Date(t).toLocaleDateString(undefined, {
          month: "short",
          year: "2-digit",
        });
    return (t: number) =>
      new Date(t).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
  }, [formatTime, geo.tHi, geo.tMin]);

  const primary = geo.built[0];
  const primaryPts = primary?.series.points ?? [];
  const isSingle = norm.length === 1;
  const baseV = primaryPts[0]?.v ?? 0;
  const lastV = primaryPts[primaryPts.length - 1]?.v ?? 0;
  const positive = lastV >= baseV;

  const accent =
    isSingle && colorByChange
      ? positive
        ? p.accent.mint
        : p.accent.rose
      : (primary?.color ?? PALETTE[0]!);

  const idx = active ?? primaryPts.length - 1;
  const shownV = primaryPts[idx]?.v ?? lastV;
  const delta = shownV - baseV;
  const deltaPct = baseV ? (delta / baseV) * 100 : 0;
  const deltaUp = delta >= 0;
  const crossPt = primary?.coords[idx];

  // Per-series values under the crosshair — powers the compare tooltip.
  // "Equilibrium": when compared lines have converged to ~the same price,
  // collapse to a single readout instead of N near-identical rows (web parity).
  const scrubT = active !== null ? primaryPts[active]?.t : undefined;
  const tipRows = useMemo(() => {
    if (active === null || scrubT === undefined) return [];
    return geo.built
      .map((b) => {
        const j = nearestIndexByT(b.series.points, scrubT);
        return {
          label: b.series.label ?? b.series.id,
          color: b.color ?? PALETTE[0]!,
          v: b.series.points[j]?.v,
        };
      })
      .filter((r): r is { label: string; color: string; v: number } => r.v != null);
  }, [active, scrubT, geo.built, PALETTE]);
  const tipVals = tipRows.map((r) => r.v);
  const tipMax = tipVals.length ? Math.max(...tipVals) : 0;
  const tipMin = tipVals.length ? Math.min(...tipVals) : 0;
  const equilibrium =
    tipRows.length > 1 && tipMin > 0 && (tipMax - tipMin) / tipMax < 0.015;

  const pickRange = (r: RangeKey) => {
    if (!controlled) setRange(r);
    onRangeChange?.(r);
  };

  // Touch scrub: map x within the plot → nearest point. `runOnJS(true)` keeps
  // the handlers on the JS thread so we can call setState directly.
  // `activeOffsetX` / `failOffsetY` make a *horizontal* drag scrub while a
  // *vertical* drag falls through to the page scroll — and the gesture only
  // activates on horizontal intent, so scrolling never flashes the crosshair.
  const tSpan = geo.tHi - geo.tMin || 1;
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activeOffsetX([-10, 10])
        .failOffsetY([-12, 12])
        .onStart((e) => {
          onScrubbingChange?.(true);
          updateScrub(e.x);
        })
        .onUpdate((e) => updateScrub(e.x))
        .onFinalize(() => {
          onScrubbingChange?.(false);
          setActive(null);
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [geo, primaryPts.length],
  );

  function updateScrub(x: number) {
    if (!primary || primaryPts.length === 0) return;
    const clamped = Math.max(0, Math.min(geo.innerW, x));
    const t = geo.tMin + (clamped / geo.innerW) * tSpan;
    const next = nearestIndexByT(primaryPts, t);
    // Robinhood-style tick: a tiny selection haptic each time the crosshair
    // snaps to a new point (respects the user's haptics preference).
    if (next !== lastHapticIdx.current) {
      lastHapticIdx.current = next;
      if (hapticsEnabled) Haptics.selectionAsync().catch(() => {});
    }
    setActive(next);
  }

  return (
    <View style={{ gap: 12 }}>
      {header ? (
        <View style={{ gap: 2 }}>
          {title ? (
            <Text style={{ color: p.ink.dim, fontSize: 11, fontWeight: "600" }}>
              {title}
            </Text>
          ) : null}
          <Text
            style={{
              color: p.ink.default,
              fontSize: 30,
              fontWeight: "800",
              letterSpacing: -0.6,
            }}
          >
            {primaryPts.length > 0 ? format(shownV) : "—"}
          </Text>
          {primaryPts.length > 0 ? (
            <Text
              style={{
                color: deltaUp ? p.accent.mint : p.accent.rose,
                fontSize: 13,
                fontWeight: "700",
              }}
            >
              {deltaUp ? "▲" : "▼"} {format(Math.abs(delta))} (
              {deltaPct >= 0 ? "+" : ""}
              {deltaPct.toFixed(2)}%) ·{" "}
              {active !== null && scrubT !== undefined
                ? fmtTime(scrubT)
                : RANGE_LABEL[effectiveRange]}
            </Text>
          ) : (
            <Text style={{ color: p.ink.dim, fontSize: 13, fontWeight: "600" }}>
              No history for this range
            </Text>
          )}
        </View>
      ) : null}

      <GestureDetector gesture={pan}>
        <View
          onLayout={(e: LayoutChangeEvent) =>
            setWidth(e.nativeEvent.layout.width)
          }
          style={{ height }}
        >
          {width > 0 ? (
            <Svg width={width} height={height}>
              <Defs>
                {geo.built.map((b, i) => {
                  const c = isSingle ? accent : (b.color ?? PALETTE[0]!);
                  return (
                    <LinearGradient
                      key={`grad-${i}`}
                      id={`grad-${i}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <Stop offset="0" stopColor={c} stopOpacity={0.26} />
                      <Stop offset="1" stopColor={c} stopOpacity={0} />
                    </LinearGradient>
                  );
                })}
              </Defs>

              {/* Horizontal gridlines + right-aligned value labels. */}
              {Array.from({ length: Y_TICKS + 1 }).map((_, i) => {
                const y = PAD.top + (geo.innerH * i) / Y_TICKS;
                const v = geo.vMax - ((geo.vMax - geo.vMin) * i) / Y_TICKS;
                return (
                  <G key={`grid-${i}`}>
                    <Line
                      x1={0}
                      y1={y}
                      x2={geo.innerW}
                      y2={y}
                      stroke={p.line.default}
                      strokeWidth={1}
                      opacity={0.6}
                    />
                    <SvgText
                      x={width - 6}
                      y={y + 3}
                      fontSize={10}
                      fill={p.ink.dim}
                      textAnchor="end"
                    >
                      {format(v)}
                    </SvgText>
                  </G>
                );
              })}

              {/* Time-axis ticks (first/last anchored to the plot edges). */}
              {Array.from({ length: 4 }).map((_, i) => {
                const f = i / 3;
                const t = geo.tMin + (geo.tHi - geo.tMin) * f;
                const anchor = i === 0 ? "start" : i === 3 ? "end" : "middle";
                const x = i === 0 ? 0 : i === 3 ? geo.innerW : geo.innerW * f;
                return (
                  <SvgText
                    key={`t-${i}`}
                    x={x}
                    y={height - 6}
                    fontSize={10}
                    fill={p.ink.dim}
                    textAnchor={anchor as "start" | "middle" | "end"}
                  >
                    {fmtTime(t)}
                  </SvgText>
                );
              })}

              {/* Area fills, then lines on top. */}
              {fillArea
                ? geo.built.map((b, i) => (
                    <Path key={`area-${i}`} d={b.area} fill={`url(#grad-${i})`} />
                  ))
                : null}
              {geo.built.map((b, i) => (
                <Path
                  key={`line-${i}`}
                  d={b.line}
                  fill="none"
                  stroke={isSingle ? accent : (b.color ?? PALETTE[0]!)}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}

              {/* Crosshair + active dots while scrubbing. */}
              {active !== null && crossPt ? (
                <G>
                  <Line
                    x1={crossPt[0]}
                    y1={PAD.top}
                    x2={crossPt[0]}
                    y2={PAD.top + geo.innerH}
                    stroke={withAlpha(p.ink.default, 0.35)}
                    strokeWidth={1}
                  />
                  {geo.built.map((b, i) => {
                    const j = nearestIndexByT(
                      b.series.points,
                      primaryPts[active]?.t ?? 0,
                    );
                    const c = b.coords[j];
                    if (!c) return null;
                    return (
                      <Circle
                        key={`dot-${i}`}
                        cx={c[0]}
                        cy={c[1]}
                        r={4.5}
                        fill={p.bg.base}
                        stroke={isSingle ? accent : (b.color ?? PALETTE[0]!)}
                        strokeWidth={2}
                      />
                    );
                  })}
                </G>
              ) : null}
            </Svg>
          ) : null}

          {/* Scrub readout — single-series price flag, or a multi-row compare
              tooltip (date + per-series values, equilibrium collapse). */}
          {active !== null && crossPt ? (
            isSingle ? (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: 0,
                  left: Math.min(Math.max(crossPt[0] - 44, 0), geo.innerW - 92),
                  minWidth: 88,
                  alignItems: "center",
                  backgroundColor: p.ink.default,
                  borderRadius: 8,
                  paddingHorizontal: 9,
                  paddingVertical: 4,
                }}
              >
                <Text
                  style={{
                    color: p.bg.base,
                    fontSize: 12,
                    fontWeight: "800",
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {format(shownV)}
                </Text>
                {scrubT !== undefined ? (
                  <Text
                    style={{
                      color: withAlpha(p.bg.base, 0.75),
                      fontSize: 9,
                      fontWeight: "700",
                      marginTop: 1,
                    }}
                  >
                    {fmtTime(scrubT)}
                  </Text>
                ) : null}
              </View>
            ) : tipRows.length > 0 ? (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: 2,
                  left:
                    crossPt[0] > geo.innerW * 0.55
                      ? Math.max(2, crossPt[0] - 168)
                      : Math.min(crossPt[0] + 10, geo.innerW - 160),
                  width: 158,
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
                {scrubT !== undefined ? (
                  <Text
                    style={{
                      color: p.ink.dim,
                      fontSize: 9.5,
                      fontWeight: "700",
                      letterSpacing: 0.4,
                    }}
                  >
                    {fmtTime(scrubT)}
                  </Text>
                ) : null}
                {equilibrium ? (
                  <View
                    style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                  >
                    <View
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 4,
                        backgroundColor: p.accent.mint,
                      }}
                    />
                    <Text
                      style={{
                        flex: 1,
                        color: p.ink.muted,
                        fontSize: 11,
                        fontWeight: "600",
                      }}
                    >
                      Equilibrium
                    </Text>
                    <Text
                      style={{
                        color: p.accent.mint,
                        fontSize: 11,
                        fontWeight: "800",
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {format((tipMax + tipMin) / 2)}
                    </Text>
                  </View>
                ) : (
                  tipRows.map((r, i) => (
                    <View
                      key={i}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <View
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: 4,
                          backgroundColor: r.color,
                        }}
                      />
                      <Text
                        numberOfLines={1}
                        style={{
                          flex: 1,
                          color: p.ink.muted,
                          fontSize: 11,
                          fontWeight: "600",
                        }}
                      >
                        {r.label}
                      </Text>
                      <Text
                        style={{
                          color: p.ink.default,
                          fontSize: 11,
                          fontWeight: "800",
                          fontVariant: ["tabular-nums"],
                        }}
                      >
                        {format(r.v)}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            ) : null
          ) : null}
        </View>
      </GestureDetector>

      {/* Range pills. */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {availableRanges.map((r) => {
          const on = r === effectiveRange;
          return (
            <Pressable
              key={r}
              onPress={() => pickRange(r)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: on
                  ? withAlpha(p.accent.mint, 0.16)
                  : "transparent",
                borderWidth: 1,
                borderColor: on ? p.accent.mint : p.line.default,
              }}
            >
              <Text
                style={{
                  color: on ? p.accent.mint : p.ink.muted,
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                {r}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Legend — names each compare line (web parity). Last value per series
          so the ranking reads without scrubbing. */}
      {norm.length > 1 ? (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            columnGap: 14,
            rowGap: 6,
          }}
        >
          {geo.built.map((b, i) => {
            const last = b.series.points[b.series.points.length - 1]?.v;
            return (
              <View
                key={i}
                style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: b.color ?? PALETTE[0]!,
                  }}
                />
                <Text
                  style={{ color: p.ink.muted, fontSize: 11, fontWeight: "600" }}
                >
                  {b.series.label ?? b.series.id}
                </Text>
                {last != null ? (
                  <Text
                    style={{
                      color: p.ink.dim,
                      fontSize: 11,
                      fontWeight: "700",
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {format(last)}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
