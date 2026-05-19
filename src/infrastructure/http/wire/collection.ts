/**
 * Collection wire types — user-owned collections of graded cards.
 * Backs `/v1/collections/*`.
 */

import type { ID, ISODate } from "../atoms";

/** Mirrors `CollectionRead` in `app/schemas/collection.py`. */
export interface Collection {
  id: ID;
  user_id: ID;
  name: string;
  description: string | null;
  color: string | null;
  is_public: boolean;
  created_at: ISODate;
  updated_at: ISODate;
}

export interface CollectionItem {
  id: ID;
  collection_id: ID;
  graded_card_id: ID;
  note: string | null;
  added_at: ISODate;
}
