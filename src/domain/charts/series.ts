/**
 * Series math — the pure functions every chart in the app uses to turn
 * raw `PricePoint[]` into something an SVG can draw.
 *
 * Every function here is deterministic, side-effect free, and trivially
 * unit-testable from plain Node (no React Native runtime needed).
 */
import type { PricePoint } from "@/domain/market";

import type {
  DeltaResult,
  SeriesDirection,
} from "./types";

/** A 2-tuple of `[x, y]` pixel coordinates. */
export type Coord = readonly [number, number];

/**
 * Smooth Fritsch–Carlson monotone-cubic interpolation through `coords`.
 * Never overshoots, never wiggles past local extrema — the Robinhood look.
 * Returns an SVG `d` attribute string. Empty when fewer than 2 points.
 */
export function monotoneCubic(coords: readonly Coord[]): string {
  const n = coords.length;
  if (n < 2) return "";
  if (n === 2) {
    return `M ${coords[0]![0]} ${coords[0]![1]} L ${coords[1]![0]} ${coords[1]![1]}`;
  }

  const dx: number[] = new Array(n - 1);
  const dy: number[] = new Array(n - 1);
  const m: number[] = new Array(n - 1);

  for (let i = 0; i < n - 1; i++) {
    dx[i] = coords[i + 1]![0] - coords[i]![0];
    dy[i] = coords[i + 1]![1] - coords[i]![1];
    m[i] = dx[i] === 0 ? 0 : dy[i]! / dx[i]!;
  }

  const t: number[] = new Array(n);
  t[0] = m[0]!;
  t[n - 1] = m[n - 2]!;
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1]! * m[i]! <= 0) {
      t[i] = 0;
    } else {
      t[i] = (m[i - 1]! + m[i]!) / 2;
    }
  }

  let d = `M ${coords[0]![0].toFixed(2)} ${coords[0]![1].toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = coords[i]!;
    const [x1, y1] = coords[i + 1]!;
    const h = dx[i]!;
    const c1x = x0 + h / 3;
    const c1y = y0 + (t[i]! * h) / 3;
    const c2x = x1 - h / 3;
    const c2y = y1 - (t[i + 1]! * h) / 3;
    d +=
      ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)},` +
      ` ${c2x.toFixed(2)} ${c2y.toFixed(2)},` +
      ` ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }
  return d;
}

/** Index of the coord whose x is closest to `x`. Returns 0 on empty input. */
export function nearestIndex(x: number, coords: readonly Coord[]): number {
  if (coords.length === 0) return 0;
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

/** Keep a floating tooltip from running off the chart edges. */
export function clampLabelX(x: number, width: number, labelW: number): number {
  return Math.max(0, Math.min(width - labelW, x - labelW / 2));
}

/**
 * Map a series of values into `[x, y]` SVG coords given the chart's
 * pixel `width`, vertical `height`, and `paddingY` (top/bottom inset
 * so the stroke isn't clipped). When all values are equal the line
 * is drawn flat through the vertical center.
 */
export function valuesToCoords(
  values: readonly number[],
  width: number,
  height: number,
  paddingY = 0,
): Coord[] {
  const n = values.length;
  if (n === 0 || width <= 0 || height <= 0) return [];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const flat = hi === lo;
  const usableH = Math.max(0, height - paddingY * 2);
  const xStep = n === 1 ? 0 : width / (n - 1);
  return values.map((v, i) => {
    const x = n === 1 ? width / 2 : i * xStep;
    const y = flat
      ? height / 2
      : paddingY + (1 - (v - lo) / (hi - lo)) * usableH;
    return [x, y] as const;
  });
}

/** Same as `valuesToCoords` but pulls `priceUsd` out of `PricePoint`. */
export function pointsToCoords(
  points: readonly PricePoint[],
  width: number,
  height: number,
  paddingY = 0,
): Coord[] {
  return valuesToCoords(
    points.map((p) => p.priceUsd),
    width,
    height,
    paddingY,
  );
}

/**
 * First → last delta, broken down into USD, percent, and direction.
 * Returns a zero/flat result for empty or single-point series.
 *
 * `flatThresholdPct` (default 0.05%) suppresses noise: deltas smaller
 * than the threshold report direction "flat" so colors don't flicker.
 */
export function computeDelta(
  values: readonly number[],
  flatThresholdPct = 0.05,
): DeltaResult {
  if (values.length < 2) return { absUsd: 0, pct: 0, direction: "flat" };
  const first = values[0]!;
  const last = values[values.length - 1]!;
  const absUsd = last - first;
  const pct = first === 0 ? 0 : (absUsd / first) * 100;
  const direction: SeriesDirection =
    Math.abs(pct) < flatThresholdPct
      ? "flat"
      : pct > 0
        ? "up"
        : "down";
  return { absUsd, pct, direction };
}

/**
 * Down-sample `values` to exactly `target` evenly-spaced samples. Used
 * when the API hands us 500 points but the sparkline can only draw 14.
 * No-ops when `values.length <= target`. Returns a new array.
 */
export function downsample(
  values: readonly number[],
  target: number,
): number[] {
  if (target <= 0) return [];
  if (values.length <= target) return [...values];
  const stride = values.length / target;
  const out: number[] = new Array(target);
  for (let i = 0; i < target; i++) {
    // Floor the stride sample, anchoring last bucket to last value
    // so the rightmost sample matches the latest price exactly.
    const idx = i === target - 1 ? values.length - 1 : Math.floor(i * stride);
    out[i] = values[idx]!;
  }
  return out;
}
