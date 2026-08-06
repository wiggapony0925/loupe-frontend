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
}

export interface NearbyStoresWire {
  stores: NearbyStoreWire[];
  /** `live` | `cached` | `unavailable` (upstream down → empty list). */
  source: "live" | "cached" | "unavailable";
}
