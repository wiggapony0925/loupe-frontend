/**
 * Market-index wire types — backs `GET /v1/market/indices/{id}/history`.
 *
 * The PSA-10 cohort series is normalized to 100 at the first bucket so
 * the frontend can overlay it on the user's portfolio chart without
 * additional math: the portfolio is normalized identically at render
 * time and both lines start from the same baseline. Higher = the index
 * has outpaced its starting price; lower = it's underperformed.
 */

export interface MarketIndexPointWire {
  date: string;
  indexValue: number;
}

export interface MarketIndexHistoryWire {
  indexId: string;
  range: "1D" | "1W" | "1M" | "3M" | "YTD" | "1Y" | "ALL";
  points: MarketIndexPointWire[];
  /** Last point − 100. Positive when the cohort gained vs. start. */
  deltaPct: number;
  cohortSize: number;
}
