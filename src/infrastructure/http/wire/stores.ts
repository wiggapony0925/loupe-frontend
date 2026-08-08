/** Wire types for the card-shop locator (`/v1/public/stores`). */

/** One physical shop near the user. Positions are WGS84. */
export interface NearbyStoreWire {
  /** Stable upstream id (`osm:<type>:<id>`). */
  id: string;
  name: string;
  lat: number;
  lng: number;
  distance_km: number;
  /** Backend-owned label — render verbatim ("Card & game store"). */
  category: string;
  address: string | null;
  website: string | null;
  phone: string | null;
  opening_hours: string | null;
  /** The same hours as an ordered Monday-first week, parsed server-side. */
  hours: OpeningHoursWeekWire | null;
  /** Photo the shop publishes (OSM image tag, else its site's og:image). */
  photo_url: string | null;
  /** Community rating over Loupe reviews (null until someone rates). */
  rating: number | null;
  review_count: number;
  /** Whether I've hearted this shop. */
  is_saved: boolean;
}

export interface StoreSaveWire {
  store_id: string;
  is_saved: boolean;
}

export interface SavedStoresWire {
  stores: NearbyStoreWire[];
}

/** One collector's review of a shop. */
export interface StoreReviewWire {
  id: string;
  store_id: string;
  rating: number;
  body: string | null;
  created_at: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_mine: boolean;
}

export interface StoreDetailWire {
  store: NearbyStoreWire;
  reviews: StoreReviewWire[];
}

export interface NearbyStoresWire {
  stores: NearbyStoreWire[];
  /** `live` | `cached` | `unavailable` (upstream down → empty list). */
  source: "live" | "cached" | "unavailable";
}

/** One row of a store's week. */
export interface OpeningHoursDayWire {
  day: string;
  short: string;
  /** Time spans exactly as the source wrote them. Empty = closed, unless
   *  `unknown`, which means the data never said. */
  ranges: string[];
  unknown: boolean;
}

export interface OpeningHoursWeekWire {
  days: OpeningHoursDayWire[];
  always_open: boolean;
  /** Holiday qualifiers and anything the parser couldn't structure. */
  notes: string[];
  raw: string | null;
}

/** One pickable place. `label` is server-formatted and is what gets STORED,
 *  so the same city reads identically on every surface. */
export interface PlaceSuggestionWire {
  label: string;
  city: string | null;
  region: string | null;
  country: string | null;
  country_code: string | null;
}

export interface PlaceSuggestionsWire {
  places: PlaceSuggestionWire[];
  /** The gazetteer was unreachable — fall back to accepting free text
   *  rather than blocking a profile save. */
  degraded: boolean;
}
