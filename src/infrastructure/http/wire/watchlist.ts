/**
 * Watchlist wire types — backs `/v1/watchlist`.
 *
 * One row per (user, card) pin. `card_name` / `card_image_url` are
 * joined by the server so the watchlist list renders without an N+1
 * card-detail fetch.
 */

import type { ID, ISODate } from "../atoms";

export interface WatchlistItemWire {
  id: ID;
  user_id: ID;
  card_id: ID;
  /**
   * Composite catalog id (`pokemontcg:base1-4`) the card was materialized
   * from. Lets the card-detail heart match its pinned state by the id the
   * browse/search view has, without knowing the local UUID.
   */
  upstream_id?: string | null;
  created_at: ISODate;
  card_name: string | null;
  card_image_url: string | null;
}

export interface WatchlistAddWire {
  card_id: ID;
}
