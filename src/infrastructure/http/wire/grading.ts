/**
 * Grading wire types — graded cards & fingerprints.
 * Backs `/v1/grades/*` and the joined card columns used to render rows
 * without an N+1 fetch.
 */

import type { DecimalString, GradeHouse, ID, ISODate, RawCondition } from "../atoms";

export interface SubgradeDetail {
  score: number;
  confidence: number | null;
  notes: string | null;
}

export interface Subgrades {
  centering: SubgradeDetail | null;
  corners: SubgradeDetail | null;
  edges: SubgradeDetail | null;
  surface: SubgradeDetail | null;
}

/**
 * Mirrors `GradedCardRead` in `app/schemas/grade.py`.
 *
 * NOTE: `grade` and `estimated_value_usd` are Pydantic Decimals → JSON
 * strings. Coerce with `Number(grade.grade)` before doing arithmetic /
 * `.toFixed()`.
 */
export interface GradedCard {
  id: ID;
  user_id: ID;
  card_id: ID;
  scan_job_id: ID | null;
  grade: DecimalString;
  house: GradeHouse;
  /**
   * Raw-card condition (PSA-style: NM/LP/MP/HP/DMG). Only meaningful when
   * `house === "loupe"` (our slug for "raw / not slabbed"); always null
   * for third-party slabbed grades since the slab already encodes condition.
   */
  condition: RawCondition | null;
  subgrades: Record<string, unknown> | null;
  estimated_value_usd: DecimalString | null;
  /** What the user paid for the card. `null` = no cost recorded. */
  purchase_price_usd: DecimalString | null;
  /** ISO date (YYYY-MM-DD) the user acquired the card. */
  purchase_date: ISODate | null;
  fingerprint_hash: string | null;
  notes: string | null;
  graded_at: ISODate;
  created_at: ISODate;
  updated_at: ISODate;
  // Joined from the cards table so the UI can render a row without an N+1 fetch.
  card_name: string | null;
  card_image_url: string | null;
  card_number: string | null;
  card_set_name: string | null;
  card_year: number | null;
  card_tcg: string | null;
}

export interface FingerprintSummary {
  card_id: ID;
  hash: string;
  algorithm: "phash" | "dhash" | "ahash";
  similarity: number | null;
  matched_card_id: ID | null;
}

/* ─── Portfolio analytics (mirrors app/services/portfolio_service.py) ─── */

/**
 * Mirrors `portfolio_service.summary()`. Note: this endpoint returns
 * camelCase keys (it predates the snake_case convention in CONTRACT.md).
 */
export interface PortfolioSummaryWire {
  totalValueUsd: number;
  cardCount: number;
  avgGrade: number | null;
  avgAccuracy: number | null;
  /**
   * Cost-basis aggregates. All four are `null` until the user records a
   * purchase price on at least one card — the UI should hide the P/L
   * chip in that case rather than show "+$0.00 (+0%)".
   */
  totalCostUsd: number | null;
  costBasisCardCount: number;
  unrealizedPnlUsd: number | null;
  unrealizedPnlPct: number | null;
}

export type PortfolioRangeWire =
  | "1D"
  | "1W"
  | "1M"
  | "3M"
  | "YTD"
  | "1Y"
  | "ALL";

export interface PortfolioPointWire {
  /** ISO date (UTC). */
  date: ISODate;
  /** USD value of the portfolio at this bucket. */
  priceUsd: number;
}

/** Mirrors `portfolio_service.PortfolioHistory.to_dict()`. */
export interface PortfolioHistoryWire {
  range: PortfolioRangeWire;
  points: PortfolioPointWire[];
  deltaUsd: number;
  deltaPct: number;
}

/** Mirrors `portfolio_service.CardSparkline.to_dict()`. */
export interface CardSparklineWire {
  /** The GradedCard.id (not the catalog card id). */
  cardId: ID;
  /** Real USD values, length 14, oldest → newest. */
  points: number[];
  /** First → last pct change, 0 when flat/empty. */
  deltaPct: number;
}
