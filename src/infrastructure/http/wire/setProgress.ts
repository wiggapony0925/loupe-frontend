/**
 * Set-progress wire types — backs `GET /v1/sets/progress`.
 *
 * Returns one row per `CardSet` the signed-in user owns at least one
 * card from. `total` is the upstream-published set size when known,
 * else the count of cards we have indexed for that set (honest upper
 * bound rather than a fabricated percentage).
 */

import type { TcgKey } from "../atoms";

export interface SetProgressMissingCardWire {
  cardId: string;
  name: string;
  number: string | null;
  imageUrl: string | null;
}

export interface SetProgressWire {
  setId: string;
  setName: string;
  setCode: string | null;
  tcg: TcgKey;
  imageUrl: string | null;
  owned: number;
  total: number;
  /** 0–100, two decimals. */
  percent: number;
  /** Sum of the user's `GradedCard.estimated_value_usd` for this set. */
  estimatedValueUsd: number;
  /** Up to five cards in the set the user does NOT own. */
  missingTop: SetProgressMissingCardWire[];
}

/**
 * One row in a set checklist — backs `GET /v1/sets/{set_id}/checklist`.
 *
 * `id` is the composite `<source>:<upstream_id>` (Pokémon, from the catalog
 * mirror) or a bare card UUID (local fallback for Magic/Yu-Gi-Oh) — either way
 * it routes straight to `/card/[id]`.
 */
export interface SetChecklistCardWire {
  id: string;
  name: string;
  number: string | null;
  imageUrl: string | null;
  owned: boolean;
}

/**
 * Full owned/missing checklist for one set. The complete card list comes from
 * the catalog mirror (Pokémon); sets with no mirror coverage fall back to the
 * cards we've indexed locally, so every OWNED card still renders.
 */
export interface SetChecklistWire {
  setId: string;
  setName: string;
  total: number;
  owned: number;
  cards: SetChecklistCardWire[];
}
