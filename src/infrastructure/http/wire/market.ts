/**
 * Market wire types — `/v1/cards/{id}/market`, `/v1/cards/{id}/listings`,
 * `/v1/cards/{id}/comps`. Includes house-by-house pop reports & live listings.
 */

import type { Money } from "../atoms";
import type { PriceHistoryWire } from "./catalog";

// ─── Market snapshot ───────────────────────────────────────────────────

export type HouseId = "psa" | "cgc" | "bgs" | "sgc" | "tag";

export interface MarketSummaryWire {
  raw: Money | null;
  graded_avg: Money | null;
  pop_top: Money | null;
  pop_total: number;
  change_pct_1y: number;
  last_sale_at: string | null;
  primary_house: HouseId | string;
}

export interface HouseGradeRowWire {
  house: HouseId | string;
  grade: number;
  grade_label: string;
  population: number;
  market: Money;
  change_pct: number;
  last_sale_at: string | null;
  listing_url: string | null;
  source?: "real" | "synthesized";
}

export interface HouseBlockWire {
  house: HouseId | string;
  pop_total: number;
  grades: HouseGradeRowWire[];
}

export interface MarketSnapshotWire {
  summary: MarketSummaryWire;
  history: Record<string, PriceHistoryWire>;
  houses: HouseBlockWire[];
  tiers_total: number;
}

export interface MarketResponseWire {
  card_id: string;
  snapshot: MarketSnapshotWire;
}

// ─── Live listings ─────────────────────────────────────────────────────

export interface GradeWire {
  company: string;
  value: number;
}

/** Mirrors `ListingWire` in `app/schemas/listings.py`. */
export interface ListingWire {
  source: string;
  title: string;
  price: Money;
  url: string;
  condition: string | null;
  image_url: string | null;
  is_auction: boolean;
  time_left_seconds: number | null;
}

export interface ListingsResponseWire {
  card_id: string;
  query: string;
  listings: ListingWire[];
}

// ─── Sold comps ────────────────────────────────────────────────────────

/** Mirrors `SoldCompWire` in `app/schemas/comps.py`. */
export interface SoldCompWire {
  source: string;
  title: string;
  price: Money;
  sold_at: string;
  condition: string | null;
  grade: string | null;
  house: string | null;
  url: string | null;
  image_url: string | null;
}

/** Mirrors `CompsFilters` in `app/schemas/comps.py`. */
export interface CompsFiltersWire {
  grade: string | null;
  house: string | null;
}

export interface CompsResponseWire {
  card_id: string;
  query: string;
  days: number;
  filters: CompsFiltersWire;
  comps: SoldCompWire[];
}
