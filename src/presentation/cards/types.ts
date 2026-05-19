/**
 * Canonical "card-like" shape consumed by every primitive in this folder.
 *
 * We use the wire shape from `/v1/cards/search` (`CardSearchResult`) as the
 * canonical type since it is the richest and most-emitted card representation
 * from the backend. Local stores (e.g. `CollectionCard`) are adapted via
 * `collectionToCardWire()` below so the primitives stay shape-agnostic.
 */
import type { CardSearchResult } from "@/infrastructure/http";
import type { CollectionCard } from "@/domain";

export type CardWire = CardSearchResult;

export type CardTileSize = "sm" | "md" | "lg";

export interface TrendInfo {
  /** Percentage change over the trailing window (e.g. 12.4 for +12.4%). */
  pct: number;
  /** Absolute USD delta over the same window (optional). */
  delta?: number;
}

/** Width (in dp) of a card tile at each named size. Drives layout math. */
export const TILE_WIDTH: Record<CardTileSize, number> = {
  sm: 80,
  md: 120,
  lg: 160,
};

/** Adapter: locally-stored `CollectionCard` → wire `CardWire`. */
export function collectionToCardWire(c: CollectionCard): CardWire {
  return {
    id: c.id,
    name: c.title,
    tcg: "pokemon",
    set_name: c.set,
    year: c.year,
    image_url: c.thumbnailUri,
    source: "vault",
  };
}
