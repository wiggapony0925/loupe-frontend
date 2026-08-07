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
