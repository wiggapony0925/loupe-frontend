/**
 * Grading wire types — graded cards & fingerprints.
 * Backs `/v1/grades/*` and the joined card columns used to render rows
 * without an N+1 fetch.
 */

import type { DecimalString, GradeHouse, ID, ISODate } from "../atoms";

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
  subgrades: Record<string, unknown> | null;
  estimated_value_usd: DecimalString | null;
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
