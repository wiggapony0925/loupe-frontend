/**
 * Wire shapes for `POST /v1/cards/resolve`.
 *
 * The resolve endpoint is the single funnel every "I'm adding a card"
 * surface in the app should route through — scan, search-tap, manual
 * entry, deep link, etc. It accepts any combination of hints and
 * returns the canonical Loupe identity (creating a local Card row on
 * demand when ``materialize`` is true).
 *
 * Mirrors `loupe-backend/app/routers/cards.py::ResolveCardRequest` and
 * the JSON returned by the same handler.
 */

import type { CanonicalCard } from "./canonicalCard";

export interface ResolveCardRequest {
  /** Composite catalog id like ``"pokemontcg:base1-4"`` or ``"psa:cert/12345"``. */
  upstream_id?: string;
  /** Free-text query (name, set, number, etc). */
  query?: string;
  /** Perceptual hash of a scan capture, hex-encoded. */
  phash?: string;
  /** Existing local Loupe card UUID. */
  uuid?: string;
  /** Optional TCG hint to narrow text/phash matching. */
  tcg?: "pokemon" | "magic" | "yugioh";
  /**
   * When true (default) the server will create a local ``Card`` row +
   * ``CardExternalRef`` if the upstream is known but not yet linked, so
   * the response always carries a stable local ``card_id``.
   */
  materialize?: boolean;
}

export interface ResolveCardResponse {
  /** Local Loupe UUID. Null when nothing could be resolved or materialized. */
  card_id: string | null;
  /** The composite upstream id that was matched, if any. */
  upstream_id: string | null;
  /** Which path produced the match: ``"local" | "external_ref" | "phash" | "upstream" | "search"``. */
  source: string | null;
  /** Confidence in the resolution, 0..1. */
  confidence: number | null;
  /** Full canonical document for the resolved card, or null when unresolved. */
  canonical: CanonicalCard | null;
}
