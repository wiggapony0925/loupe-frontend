/**
 * Shared chart math.
 *
 * Monotone-cubic interpolation through the points (Fritsch–Carlson) →
 * smooth, never-overshooting Robinhood-style curve. Re-used by every
 * line chart in the app so the visual feel stays consistent.
 */
export function monotoneCubic(
  coords: readonly (readonly [number, number])[],
): string {
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

/** Snap an x-coordinate to the nearest data point index. */
export function nearestIndex(
  x: number,
  coords: readonly (readonly [number, number])[],
): number {
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
