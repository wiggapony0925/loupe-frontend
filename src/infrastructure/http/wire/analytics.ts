/**
 * Card analytics + ownership wire types.
 *   - `GET /v1/cards/{id}/analytics` (public) → derived market metrics.
 *   - `GET /v1/cards/{id}/ownership` (auth)   → the signed-in user's copies.
 *
 * Both are *composed server-side* (mirrors `app/schemas/card_analytics.py` and
 * `app/schemas/ownership.py`) so web + mobile render identical numbers.
 *
 * NOTE: `*_usd` and `grade` are Pydantic Decimals → JSON strings. Coerce with
 * `Number(...)` before arithmetic / `.toFixed()`.
 */

import type { DecimalString, GradeHouse, ID, ISODate, RawCondition } from "../atoms";

// ─── Derived market analytics ──────────────────────────────────────────

export interface CardAnalyticsWire {
  card_id: string;
  // Valuation
  market_price_usd: DecimalString | null;
  graded_avg_usd: DecimalString | null;
  population: number;
  market_cap_usd: DecimalString | null;
  // Momentum — signed % change over each trailing window
  momentum_7d: number | null;
  momentum_30d: number | null;
  momentum_90d: number | null;
  momentum_1y: number | null;
  // Risk & quality
  volatility_pct: number | null;
  grade_premium: number | null;
  // Extremes
  all_time_high_usd: DecimalString | null;
  all_time_low_usd: DecimalString | null;
  pct_off_ath: number | null;
  // Liquidity
  liquidity_30d: number;
}

// ─── Per-user ownership ────────────────────────────────────────────────

export type AcquisitionSource = "scan" | "manual" | "import";

/** One owned copy of a card (a `GradedCard` row), with derived figures. */
export interface CardHoldingWire {
  holding_id: ID;
  grade: DecimalString;
  house: GradeHouse;
  is_graded: boolean;
  condition: RawCondition | null;
  subgrades: Record<string, unknown> | null;
  estimated_value_usd: DecimalString | null;
  purchase_price_usd: DecimalString | null;
  purchase_date: ISODate | null;
  acquired_via: AcquisitionSource | null;
  scan_job_id: ID | null;
  fingerprint_hash: string | null;
  notes: string | null;
  graded_at: ISODate;
  days_held: number | null;
  unrealized_pl_usd: DecimalString | null;
  unrealized_pl_pct: number | null;
}

/** The signed-in user's ownership of one card, rolled up across copies. */
export interface CardOwnershipWire {
  owned: boolean;
  copies: number;
  holdings: CardHoldingWire[];
  cost_basis_usd: DecimalString | null;
  holding_value_usd: DecimalString | null;
  unrealized_pl_usd: DecimalString | null;
  unrealized_pl_pct: number | null;
}
