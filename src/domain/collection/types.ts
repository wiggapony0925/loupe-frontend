/**
 * Collection aggregate — the user's vault of graded cards.
 *
 * NOTE: `CardSet` here is a **UI-facing enum** of named sets used by mock
 * fixtures. The richer wire shape (`CardSet` from the backend `/v1/sets`
 * endpoint) lives in `src/infrastructure/http/` and is *not* the same type.
 */

/** Named card sets surfaced in the UI (filter chips, sample data). */
export type CardSet =
  | "Pokemon Base Set"
  | "2026 World Cup Goals"
  | "Topps Chrome 2025"
  | "Magic Alpha";

/** A graded card held in the user's vault. */
export interface CollectionCard {
  id: string;
  title: string;
  set: CardSet;
  year: number;
  /** PSA-style grade, 1..10. */
  grade: number;
  estimatedValueUsd: number;
  thumbnailUri: string;
  /** ISO timestamp when the card was last scanned. */
  scannedAt: string;
}
