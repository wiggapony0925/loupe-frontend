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
