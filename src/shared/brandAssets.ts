/**
 * Brand logo registry — single source of truth for franchise artwork.
 *
 * ⚠️  LEGAL NOTE
 * Pokémon, Magic: The Gathering, Yu-Gi-Oh!, One Piece, Disney Lorcana,
 * Topps, Panini, FIFA, etc. are registered trademarks owned by their
 * respective rights-holders. We do NOT bundle any of those marks with
 * the app. To enable real logos at runtime, drop properly-licensed
 * (or your own) PNG/SVG assets into `assets/brands/` and uncomment the
 * matching `require(...)` lines below.
 *
 * The expected files (transparent PNG, ~256×256 or wide wordmark):
 *   assets/brands/pokemon.png
 *   assets/brands/magic.png
 *   assets/brands/yugioh.png
 *   assets/brands/onepiece.png
 *   assets/brands/digimon.png
 *   assets/brands/lorcana.png
 *   assets/brands/sports.png
 *   assets/brands/topps.png
 *   assets/brands/soccer.png
 *
 * Anything missing falls back to the SVG monogram glyph defined in
 * `src/components/brand/TcgMark.tsx`.
 */

import type { ImageSourcePropType } from "react-native";

/** Stable brand keys used by both Search and Vault filter chips. */
export type BrandKey =
  | "pokemon"
  | "magic"
  | "yugioh"
  | "onepiece"
  | "digimon"
  | "lorcana"
  | "sports"
  | "topps"
  | "soccer"
  | "all";

/**
 * Static asset map. Metro requires `require(...)` paths to be string
 * literals known at bundle time, so each brand needs its own entry.
 *
 * To activate a logo:
 *   1. Drop the file at `assets/brands/<key>.png`
 *   2. Uncomment its line below
 *   3. Reload the app — chips and tiles pick it up automatically.
 */
const REGISTRY: Partial<Record<BrandKey, ImageSourcePropType>> = {
  pokemon: require("../../assets/brands/pokemon.png"),
  magic: require("../../assets/brands/magic.png"),
  yugioh: require("../../assets/brands/yugioh.png"),
  onepiece: require("../../assets/brands/onepiece.png"),
  digimon: require("../../assets/brands/digimon.png"),
  lorcana: require("../../assets/brands/lorcana.png"),
  sports: require("../../assets/brands/sports.png"),
  // topps: require("../../assets/brands/topps.png"),
  // soccer: require("../../assets/brands/soccer.png"),
};

/**
 * Returns the bundled logo asset for a brand if one is registered,
 * otherwise `null` so callers can render their fallback (SVG mark
 * or monogram tile).
 */
export function getBrandLogo(key: BrandKey | string): ImageSourcePropType | null {
  return REGISTRY[key as BrandKey] ?? null;
}

/** Convenience predicate — useful for picking layout variants. */
export function hasBrandLogo(key: BrandKey | string): boolean {
  return getBrandLogo(key) !== null;
}
