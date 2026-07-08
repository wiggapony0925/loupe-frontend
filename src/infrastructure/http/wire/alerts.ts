/**
 * Price-alert wire types — backs `/v1/alerts`.
 *
 * `card_name` / `card_image_url` are joined by the server so vault /
 * card-detail rows render without an N+1 fetch. `triggered_at` /
 * `triggered_price_usd` are null until the price-backfill worker flips
 * the alert.
 *
 * `threshold_usd` and `triggered_price_usd` are decimal strings on the
 * wire (Pydantic `Decimal` round-trip). Parse them client-side via
 * `parseFloat` / `Number()` when you need numbers.
 */

import type { DecimalString, ID, ISODate } from "../atoms";
import type { components } from "./__generated__";

/** Sourced from OpenAPI codegen so wire + backend enums never drift. */
export type PriceAlertCondition =
  components["schemas"]["PriceAlertCondition"];

export interface PriceAlertWire {
  id: ID;
  user_id: ID;
  card_id: ID;
  /** Composite catalog id (`pokemontcg:base1-4`) the alert's card resolves to,
   *  so the card-detail can match its "already alerted?" state by that id. */
  upstream_id?: string | null;
  condition: PriceAlertCondition;
  threshold_usd: DecimalString;
  note: string | null;
  created_at: ISODate;
  triggered_at: ISODate | null;
  triggered_price_usd: DecimalString | null;
  card_name: string | null;
  card_image_url: string | null;
}

export interface PriceAlertCreateWire {
  card_id: ID;
  condition: PriceAlertCondition;
  threshold_usd: DecimalString | number;
  note?: string | null;
}
