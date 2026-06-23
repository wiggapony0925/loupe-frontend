/**
 * Shared chart data shapes. Deliberately tiny + presentation-free so they
 * mean the same thing on web (`<svg>`) and mobile (`react-native-svg`).
 */

export interface ChartPoint {
  /** Epoch ms. */
  t: number;
  v: number;
}

export interface ChartSeries {
  id: string;
  label?: string;
  /**
   * Optional explicit color. Web passes CSS vars (`var(--accent-blue)`),
   * mobile passes hex. When omitted the renderer assigns from its palette.
   */
  color?: string;
  points: ChartPoint[];
}

export type RangeKey = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "ALL";
