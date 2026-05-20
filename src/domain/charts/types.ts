/**
 * Chart domain types.
 *
 * Pure data shapes shared by every chart in the app. UI components &
 * TanStack hooks import from here; this file imports from nothing
 * else inside the app (only TS types).
 */
import type { PricePoint } from "@/domain/market";

export type { PricePoint };

/** Timeframe vocabulary the API speaks for portfolio history. */
export type PortfolioTimeframe =
  | "1D"
  | "1W"
  | "1M"
  | "3M"
  | "YTD"
  | "1Y"
  | "ALL";

/** Timeframe vocabulary for per-card price history. */
export type PriceHistoryTimeframe = "7d" | "30d" | "90d" | "180d" | "1y";

/** A portfolio history response, post-adaptation from the wire. */
export interface PortfolioSeries {
  timeframe: PortfolioTimeframe;
  points: PricePoint[];
  /** `points[last] - points[0]` in USD. */
  deltaUsd: number;
  /** `deltaUsd / points[0]` × 100, or 0 when first point is zero. */
  deltaPct: number;
}

/** A per-card sparkline, as served by `/v1/grades/sparklines`. */
export interface CardSparklineSeries {
  /** The **GradedCard.id** (not the catalog card id). */
  cardId: string;
  /** Raw USD values, oldest → newest. May be empty when history is unknown. */
  points: number[];
  /** First → last pct change, 0 when flat/empty. */
  deltaPct: number;
}

/** Direction inferred from a series's first → last delta. */
export type SeriesDirection = "up" | "down" | "flat";

/** Result of a delta computation. */
export interface DeltaResult {
  absUsd: number;
  pct: number;
  direction: SeriesDirection;
}
