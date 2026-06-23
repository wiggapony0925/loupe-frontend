/**
 * Donut/allocation geometry — the math behind the web + mobile `DonutChart`.
 *
 * Pure: turns `{ label, value }[]` into stroke-dash ring segments (the
 * classic SVG donut technique — one `<circle>` per slice with a
 * `strokeDasharray` + `strokeDashoffset`). Colors are left to the renderer
 * (web CSS vars, mobile hex) via `colorIndex`/`isOther`, so both draw the
 * identical ring. Folds the long tail into an "Other" slice.
 */

export interface DonutDatum {
  label: string;
  value: number;
}

export interface DonutSegment {
  label: string;
  value: number;
  /** 0–100. */
  pct: number;
  /** Palette slot for the renderer; ignored when `isOther`. */
  colorIndex: number;
  isOther: boolean;
  /** Length of the colored arc, in circumference units. */
  dash: number;
  /** Remaining gap (`circumference - dash`). */
  gap: number;
  /** strokeDashoffset for this segment. */
  offset: number;
}

export interface DonutGeometry {
  segments: DonutSegment[];
  total: number;
  size: number;
  /** Ring thickness. */
  stroke: number;
  radius: number;
  circumference: number;
  /** size / 2 — the ring's center x/y. */
  center: number;
}

/**
 * Build donut ring geometry. Returns `null` when there's nothing positive to
 * plot (callers render their empty state). Mirrors the web DonutChart exactly.
 */
export function buildDonut(opts: {
  data: DonutDatum[];
  size: number;
  /** Slices beyond this fold into "Other". Default 5. */
  maxSlices?: number;
  /** Ring thickness as a fraction of `size`. Default 0.12. */
  strokeRatio?: number;
}): DonutGeometry | null {
  const { data, size, maxSlices = 5, strokeRatio = 0.12 } = opts;

  const cleaned = data.filter((d) => d.value > 0);
  if (cleaned.length === 0) return null;

  let slices = cleaned;
  if (cleaned.length > maxSlices) {
    const head = cleaned.slice(0, maxSlices);
    const restVal = cleaned.slice(maxSlices).reduce((s, d) => s + d.value, 0);
    slices = [...head, { label: "Other", value: restVal }];
  }

  const total = slices.reduce((s, d) => s + d.value, 0) || 1;
  const stroke = Math.round(size * strokeRatio);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  let acc = 0;
  const segments: DonutSegment[] = slices.map((d, i) => {
    const frac = d.value / total;
    const dash = frac * circumference;
    const isOther = d.label === "Other";
    const seg: DonutSegment = {
      label: d.label,
      value: d.value,
      pct: frac * 100,
      colorIndex: i,
      isOther,
      dash,
      gap: circumference - dash,
      offset: -acc,
    };
    acc += dash;
    return seg;
  });

  return {
    segments,
    total,
    size,
    stroke,
    radius,
    circumference,
    center: size / 2,
  };
}
