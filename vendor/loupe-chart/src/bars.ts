/**
 * Bar-chart geometry — the (small but real) shared math behind every Loupe
 * bar/distribution chart: the web `BarChart` (vertical), and mobile's
 * `YearDistribution` (vertical) + `GradeBars` (horizontal).
 *
 * Pure: computes the `max`, each bar's `fraction` (0–1 of the max), the
 * default highlight (explicit, else the tallest bar), and the gridline
 * fractions. Renderers apply their OWN min-height + scale so each keeps its
 * exact look — this just unifies the normalization + highlight logic.
 */

export interface BarDatum {
  label: string;
  value: number;
}

export interface Bar {
  label: string;
  value: number;
  index: number;
  /** value / max, in [0, 1]. Renderers scale + clamp this themselves. */
  fraction: number;
}

export interface BarsGeometry {
  bars: Bar[];
  max: number;
  /** Index highlighted at rest (explicit, or the tallest bar). */
  highlight: number;
  /** Horizontal gridline fractions, top→bottom. */
  grid: number[];
}

/** Horizontal gridlines (fractions of plot height, top→bottom). */
export const BAR_GRID = [0, 0.25, 0.5, 0.75, 1];

export function buildBars(opts: {
  data: BarDatum[];
  /** Which bar is highlighted at rest; defaults to the tallest. */
  highlightIndex?: number;
}): BarsGeometry {
  const { data, highlightIndex } = opts;
  const max = Math.max(...data.map((d) => d.value), 1);

  let highlight = highlightIndex ?? 0;
  if (highlightIndex === undefined) {
    let peak = -Infinity;
    data.forEach((d, i) => {
      if (d.value > peak) {
        peak = d.value;
        highlight = i;
      }
    });
  }

  const bars: Bar[] = data.map((d, i) => ({
    label: d.label,
    value: d.value,
    index: i,
    fraction: d.value / max,
  }));

  return { bars, max, highlight, grid: BAR_GRID };
}
