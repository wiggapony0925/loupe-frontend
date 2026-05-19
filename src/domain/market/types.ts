/**
 * Market aggregate — UI-facing price points used by sparklines & charts.
 *
 * NOTE: The richer wire shape (`PricePoint` from `/v1/cards/{id}/prices`)
 * lives in `src/infrastructure/http/` and is **not** the same type.
 */

/** Single sold-listing data point for the price-history sparkline. */
export interface PricePoint {
  /** ISO yyyy-mm-dd. */
  date: string;
  priceUsd: number;
  /** Optional source label (e.g. "eBay", "PWCC", "Goldin"). */
  venue?: string;
}
