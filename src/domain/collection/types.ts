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
  /**
   * Catalog FK shared by every graded copy of the same printing. Used to
   * detect duplicate ownership ("×2") and to key per-card analytics
   * (sparklines, price history). Distinct from `id`, which is the unique
   * graded-row PK.
   */
  cardId: string;
  title: string;
  set: CardSet;
  year: number;
  /** PSA-style grade, 1..10. */
  grade: number;
  /**
   * Lowercase grading-house slug as emitted by the backend
   * (`loupe | psa | bgs | sgc | cgc | tag`). `loupe` means we produced
   * the grade ourselves via the scanner pipeline; anything else is a
   * third-party slab the user self-reported.
   */
  house: string;
  estimatedValueUsd: number;
  thumbnailUri: string;
  /** ISO timestamp when the card was last scanned. */
  scannedAt: string;
}
