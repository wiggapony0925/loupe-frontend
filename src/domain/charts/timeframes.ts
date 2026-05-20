/**
 * Timeframe vocabulary the app & API agree on.
 *
 * Keep this in lockstep with `loupe-backend/app/services/portfolio_service.py`
 * (`_RANGE_BUCKETS`) and `loupe-backend/app/services/card_search_service.py`
 * (`get_price_history`). The contract tests in
 * `__tests__/timeframes.test.ts` guard the casing & order.
 */
import type { PortfolioTimeframe, PriceHistoryTimeframe } from "./types";

/** Ordered list of timeframes for the portfolio chart pill row. */
export const PORTFOLIO_TIMEFRAMES: readonly PortfolioTimeframe[] = [
  "1D",
  "1W",
  "1M",
  "3M",
  "YTD",
  "1Y",
  "ALL",
] as const;

/** Ordered list of timeframes for the per-card price-history chart. */
export const PRICE_HISTORY_TIMEFRAMES: readonly PriceHistoryTimeframe[] = [
  "7d",
  "30d",
  "90d",
  "180d",
  "1y",
] as const;

const _PORTFOLIO_SET: ReadonlySet<string> = new Set(PORTFOLIO_TIMEFRAMES);
const _PRICE_HISTORY_SET: ReadonlySet<string> = new Set(PRICE_HISTORY_TIMEFRAMES);

/** Narrowing type guard for portfolio timeframes. */
export function isPortfolioTimeframe(v: string): v is PortfolioTimeframe {
  return _PORTFOLIO_SET.has(v);
}

/** Narrowing type guard for price-history timeframes. */
export function isPriceHistoryTimeframe(v: string): v is PriceHistoryTimeframe {
  return _PRICE_HISTORY_SET.has(v);
}

/**
 * Human-readable label for the period a timeframe represents — used as
 * the resting subtitle on the chart (e.g. "Past month", "Past year").
 */
export function labelForPortfolioTimeframe(tf: PortfolioTimeframe): string {
  switch (tf) {
    case "1D":
      return "Today";
    case "1W":
      return "Past week";
    case "1M":
      return "Past month";
    case "3M":
      return "Past 3 months";
    case "YTD":
      return "Year to date";
    case "1Y":
      return "Past year";
    case "ALL":
      return "All time";
  }
}
