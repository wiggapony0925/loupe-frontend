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

// ─── Nearby Facebook Marketplace listings ──────────────────────────────

/** Mirrors `NearbyListingWire` in `app/schemas/nearby_listings.py`. */
export interface NearbyListingWire {
  source: string; // "facebook"
  title: string;
  price: Money;
  url: string;
  condition: string | null;
  image_url: string | null;
  distance_km: number | null;
  location_label: string | null;
}

export interface NearbyListingsResponseWire {
  card_id: string;
  query: string;
  center: { lat: number; lng: number };
  radius_km: number;
  listings: NearbyListingWire[];
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

// ─── Per-grade price summary ───────────────────────────────────────────

/** Last-sale entry inside a grade-summary row. */
export interface GradeSummaryLastSaleWire {
  amount: number;
  currency: string;
  sold_at: string;
  url: string | null;
}

/** Mirrors `app/services/market/grade_summary_service.py`. */
export interface GradeSummaryRowWire {
  grade: string; // "UNGRADED" | "PSA 10" | "CGC 9.5" | ...
  house: string | null;
  currency: string;
  last_sale: GradeSummaryLastSaleWire | null;
  median_recent: number | null;
  sales_count: number;
  delta_amount: number | null;
  delta_pct: number | null;
}

export interface GradeSummaryResponseWire {
  card_id: string;
  window_days: number;
  grades: GradeSummaryRowWire[];
}

// ─── Per-marketplace lowest active price ───────────────────────────────

/** Mirrors `app/services/market/marketplace_prices_service.py`. */
export interface MarketplacePriceRowWire {
  source: string;
  label: string;
  kind?: "listing" | "market_price";
  price_kind?: string | null;
  price: Money;
  market?: {
    market: Money | null;
    low: Money | null;
    mid: Money | null;
    high: Money | null;
  } | null;
  url: string | null;
  image_url: string | null;
  is_auction: boolean;
  updated_at?: string | null;
  subtitle?: string | null;
  search_url: string | null;
}

export interface MarketplaceActionWire {
  source: string;
  label: string;
  url: string;
  kind: "search" | string;
}

export interface MarketplacePricesResponseWire {
  card_id: string;
  query: string;
  generated_at?: string;
  providers: MarketplacePriceRowWire[];
  actions?: MarketplaceActionWire[];
}
