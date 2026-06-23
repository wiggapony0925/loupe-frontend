/**
 * Pure chart geometry — the math behind every Loupe price/market chart.
 *
 * This module has **zero** rendering dependencies (no React, no DOM, no
 * react-native). It turns `{ series, range, width, height }` into SVG path
 * strings + pixel scales. Both renderers — web `<svg>` and mobile
 * `react-native-svg` — feed it the same inputs and draw the same `d`
 * strings, so the charts are pixel-identical by construction.
 *
 * Extracted verbatim from the web `MarketChart` so behavior is unchanged.
 */
import type { ChartSeries, RangeKey } from "./types";

export const DAY = 86_400_000;

export const RANGE_DAYS: Record<RangeKey, number> = {
  "1D": 1,
  "1W": 7,
  "1M": 30,
  "3M": 90,
  "6M": 182,
  "1Y": 365,
  ALL: Infinity,
};

/** Friendly resting subtitle per range (e.g. "Past week", "All time"). */
export const RANGE_LABEL: Record<RangeKey, string> = {
  "1D": "Today",
  "1W": "Past week",
  "1M": "Past month",
  "3M": "Past 3 months",
  "6M": "Past 6 months",
  "1Y": "Past year",
  ALL: "All time",
};

export interface Padding {
  top: number;
  right: number;
  bottom: number;
}

/**
 * Default plot padding. `right` reserves a gutter for the right-aligned
 * value-axis labels so a full currency label never clips the plot edge.
 */
export const DEFAULT_PADDING: Padding = { top: 12, right: 58, bottom: 22 };

/** Catmull-Rom → cubic-bezier path for smooth, non-overshooting lines. */
export function buildLine(
  pts: ReadonlyArray<readonly [number, number]>,
  smooth: boolean,
): string {
  if (pts.length === 0) return "";
  if (pts.length < 3 || !smooth)
    return pts.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(" ");
  const at = (i: number) => pts[Math.min(Math.max(i, 0), pts.length - 1)]!;
  let d = `M${at(0)[0]} ${at(0)[1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d;
}

/** Index of the point whose timestamp is closest to `t` (crosshair scrub). */
export function nearestIndexByT(
  pts: ReadonlyArray<{ t: number }>,
  t: number,
): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const pt = pts[i];
    if (!pt) continue;
    const d = Math.abs(pt.t - t);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Ensure finite, ascending timestamps (fall back to index spacing). */
export function normalizeSeries(series: ChartSeries[]): ChartSeries[] {
  return series.map((s) => {
    const ok =
      s.points.length > 1 && s.points.every((p) => Number.isFinite(p.t));
    const pts = ok
      ? [...s.points].sort((a, b) => a.t - b.t)
      : s.points.map((p, i) => ({ t: i * DAY, v: p.v }));
    return { ...s, points: pts };
  });
}

/** Total time span (in days) covered by the (normalized) series. */
export function fullSpanDays(normalized: ChartSeries[]): number {
  let lo = Infinity;
  let hi = -Infinity;
  for (const s of normalized)
    for (const p of s.points) {
      if (p.t < lo) lo = p.t;
      if (p.t > hi) hi = p.t;
    }
  return hi > lo ? (hi - lo) / DAY : 0;
}

/**
 * Which range pills to show. In `controlled` mode the host owns the data +
 * range set, so the pills render verbatim; otherwise we hide ranges wider
 * than the data and always keep ALL.
 */
export function computeAvailableRanges(opts: {
  normalized: ChartSeries[];
  ranges: RangeKey[];
  controlled: boolean;
}): RangeKey[] {
  const { normalized, ranges, controlled } = opts;
  if (controlled) return ranges.length ? ranges : (["ALL"] as RangeKey[]);
  const span = fullSpanDays(normalized);
  const list = ranges.filter(
    (r) => r === "ALL" || RANGE_DAYS[r] < span * 0.98,
  );
  if (!list.includes("ALL")) list.push("ALL");
  return list.length ? list : (["ALL"] as RangeKey[]);
}

export interface BuiltSeries {
  series: ChartSeries;
  /** Position in the input order — renderers map this to a palette slot. */
  index: number;
  coords: ReadonlyArray<readonly [number, number]>;
  /** SVG path `d` for the line. */
  line: string;
  /** SVG path `d` for the filled area under the line. */
  area: string;
  /** Resolved color when a palette was supplied, else undefined. */
  color?: string;
}

export interface ChartGeometry {
  built: BuiltSeries[];
  innerW: number;
  innerH: number;
  vMin: number;
  vMax: number;
  tMin: number;
  tHi: number;
  padding: Padding;
  /** time(ms) → x pixel. */
  xOf: (t: number) => number;
  /** value → y pixel. */
  yOf: (v: number) => number;
}

/**
 * Slice the (normalized) series to the effective range, then compute the
 * value/time domain and the pixel geometry (line + area paths, scales).
 *
 * `width`/`height` are the only platform-measured inputs — web reads them
 * via ResizeObserver, mobile via `onLayout`. Everything else is pure.
 */
export function computeChartGeometry(opts: {
  normalized: ChartSeries[];
  effectiveRange: RangeKey;
  controlled: boolean;
  width: number;
  height: number;
  smoothing?: boolean;
  padding?: Padding;
  /** Optional fallback colors, used when a series has no explicit color. */
  palette?: string[];
}): ChartGeometry {
  const {
    normalized: norm,
    effectiveRange,
    controlled,
    width,
    height,
    smoothing = true,
    padding = DEFAULT_PADDING,
    palette = [],
  } = opts;
  const PAD = padding;
  const innerW = Math.max(1, width - PAD.right);
  const innerH = Math.max(1, height - PAD.top - PAD.bottom);

  let tMax = -Infinity;
  for (const s of norm) for (const p of s.points) if (p.t > tMax) tMax = p.t;
  // Controlled mode: data is already the right window — never slice.
  const cutoff =
    controlled || effectiveRange === "ALL"
      ? -Infinity
      : tMax - RANGE_DAYS[effectiveRange] * DAY;

  const sliced = norm.map((s) => {
    let pts = s.points.filter((p) => p.t >= cutoff);
    if (pts.length < 2) pts = s.points.slice(-2);
    return { ...s, points: pts };
  });

  let tMin = Infinity;
  let tHi = -Infinity;
  let vMin = Infinity;
  let vMax = -Infinity;
  for (const s of sliced)
    for (const p of s.points) {
      if (p.t < tMin) tMin = p.t;
      if (p.t > tHi) tHi = p.t;
      if (p.v < vMin) vMin = p.v;
      if (p.v > vMax) vMax = p.v;
    }
  const vPad = (vMax - vMin || Math.abs(vMax) || 1) * 0.08;
  vMin -= vPad;
  vMax += vPad;
  const tSpan = tHi - tMin || 1;
  const vSpan = vMax - vMin || 1;

  const xOf = (t: number) => ((t - tMin) / tSpan) * innerW;
  const yOf = (v: number) => PAD.top + innerH * (1 - (v - vMin) / vSpan);

  const built: BuiltSeries[] = sliced.map((s, i) => {
    const coords = s.points.map((p) => [xOf(p.t), yOf(p.v)] as const);
    const line = buildLine(coords, smoothing);
    const last = coords[coords.length - 1] ?? [0, 0];
    const area = line
      ? `${line} L${last[0]} ${PAD.top + innerH} L${coords[0]?.[0] ?? 0} ${PAD.top + innerH} Z`
      : "";
    const color =
      s.color ?? (palette.length ? palette[i % palette.length] : undefined);
    return { series: s, index: i, coords, line, area, color };
  });

  return { built, innerW, innerH, vMin, vMax, tMin, tHi, padding: PAD, xOf, yOf };
}

export interface SparklineGeometry {
  /** SVG `d` for the line (straight M/L segments). */
  line: string;
  /** SVG `d` for the closed area under the line. */
  area: string;
  /** y of the first value — for the period-start dashed baseline. */
  baselineY: number;
  points: ReadonlyArray<readonly [number, number]>;
  /** first→last direction; renderers map this to up/down colors. */
  direction: "up" | "down" | "flat";
}

/**
 * Tiny list-row sparkline geometry — the math behind the web + mobile
 * `Sparkline`. Maps `values` to a vertically-padded line path (so peaks/troughs
 * aren't clipped), plus a closed area path, the period-start baseline y, and the
 * overall direction. Pure — renderers draw `line`/`area` with their own SVG.
 */
export function buildSparkline(opts: {
  values: readonly number[];
  width: number;
  height: number;
  /** Vertical inset so the stroke/peaks aren't clipped. Default 2. */
  pad?: number;
}): SparklineGeometry {
  const { values, width, height, pad = 2 } = opts;
  if (values.length < 2) {
    return {
      line: "",
      area: "",
      baselineY: height / 2,
      points: [],
      direction: "flat",
    };
  }
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const stepX = width / (values.length - 1);
  const plotH = height - pad * 2;
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = hi === lo ? height / 2 : pad + plotH * (1 - (v - lo) / span);
    return [x, y] as const;
  });
  const line = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");
  const last = points[points.length - 1] ?? ([width, height] as const);
  const area = line
    ? `${line} L${last[0].toFixed(2)} ${height} L0 ${height} Z`
    : "";
  const first = values[0]!;
  const lastV = values[values.length - 1]!;
  const direction = lastV > first ? "up" : lastV < first ? "down" : "flat";
  return { line, area, baselineY: points[0]?.[1] ?? height / 2, points, direction };
}
