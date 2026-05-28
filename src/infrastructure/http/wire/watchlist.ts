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
  created_at: ISODate;
  card_name: string | null;
  card_image_url: string | null;
}

export interface WatchlistAddWire {
  card_id: ID;
}
