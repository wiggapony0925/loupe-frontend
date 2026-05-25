/**
 * Sealed-product wire types.
 * Mirrors `app/schemas/sealed.py` (loupe-backend) for `/v1/sealed/*`
 * and `/v1/sealed-holdings/*`.
 */

import type {
  DecimalString,
  ID,
  ISODate,
  SealedProductType,
  Tcg,
} from "../atoms";

/** Public catalog row — `/v1/sealed/search` and `/v1/sealed/{id}`. */
export interface SealedProductWire {
  id: ID;
  tcg: Tcg;
  product_type: SealedProductType;
  set_id: ID | null;
  name: string;
  set_name: string | null;
  image_url: string | null;
  msrp_usd: DecimalString | null;
  release_date: ISODate | null;
}

/**
 * A user's sealed holding plus the joined product columns the vault
 * needs to render a row without an N+1 fetch. `product_*` are nullable
 * because tests / orphaned rows may not have the join populated.
 */
export interface SealedHoldingWire {
  id: ID;
  user_id: ID;
  product_id: ID;
  quantity: number;
  purchase_price_usd: DecimalString | null;
  purchase_date: ISODate | null;
  estimated_value_usd: DecimalString | null;
  notes: string | null;
  /** When the user "ripped" the box. Null = still sealed. */
  opened_at: ISODate | null;
  acquired_at: ISODate;
  created_at: ISODate;
  updated_at: ISODate;
  product_name: string | null;
  product_image_url: string | null;
  product_type: SealedProductType | null;
  product_tcg: Tcg | null;
  product_set_name: string | null;
}

export interface SealedHoldingCreateWire {
  product_id: ID;
  quantity?: number;
  purchase_price_usd?: DecimalString | null;
  purchase_date?: ISODate | null;
  estimated_value_usd?: DecimalString | null;
  notes?: string | null;
}

export interface SealedHoldingUpdateWire {
  quantity?: number;
  purchase_price_usd?: DecimalString | null;
  purchase_date?: ISODate | null;
  estimated_value_usd?: DecimalString | null;
  notes?: string | null;
  opened_at?: ISODate | null;
}
