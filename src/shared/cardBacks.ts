/**
 * Card back variant model.
 *
 * Card backs are NOT per-card art — they're a function of (TCG, region,
 * print era). Modeling them as typed metadata (not file paths) lets us:
 *
 *   1. Render placeholders today even before we bundle real assets.
 *   2. Add per-locale variants (Japanese Pokémon vs English) without
 *      touching call sites — just register a new `BackVariant`.
 *   3. Treat *back-print errors* (blank back, wrong-back, double-back)
 *      as a property of the user's specific graded copy rather than
 *      the catalog card. Those belong on `GradedCard.user_scan_back_url`
 *      and override anything inferred here.
 *
 * Inference precedence at render time should be:
 *
 *   user's own back scan  (per-copy, future P3)
 *   → catalog back override  (rare back-error variant cards)
 *   → inferBackVariant(card)  (this file)
 *   → "unknown" placeholder
 */
import type { CardSearchResult } from "@/infrastructure/http";

export type BackVariant =
  | "pokemon_en_modern"
  | "pokemon_en_wotc"
  | "pokemon_jp_classic"
  | "pokemon_jp_modern"
  | "mtg_standard"
  | "mtg_dfc_helper"
  | "ygo_en"
  | "ygo_jp"
  | "lorcana_en"
  | "onepiece_en"
  | "unknown";

/**
 * Infer a card's back variant from its catalog row.
 *
 * Heuristics, ordered cheapest → most specific. We deliberately bias
 * toward "modern English" when the signal is ambiguous because that's
 * the majority of the catalog and the safest default. Add explicit
 * overrides as the dataset's language / region tagging improves.
 */
export function inferBackVariant(
  card: Pick<CardSearchResult, "tcg" | "year" | "attributes"> | null | undefined,
): BackVariant {
  if (!card) return "unknown";

  const tcg = (card.tcg ?? "").toLowerCase();
  const attrs = (card.attributes ?? {}) as Record<string, unknown>;
  const language = String(attrs.language ?? attrs.lang ?? "en").toLowerCase();
  // MTG marks double-faced cards in many ways depending on upstream;
  // accept any of the common booleans/layout flags.
  const layout = String(attrs.layout ?? "").toLowerCase();
  const isDfc =
    layout === "transform" ||
    layout === "modal_dfc" ||
    layout === "double_faced_token" ||
    attrs.is_dfc === true;

  switch (tcg) {
    case "pokemon": {
      const isJapanese = language.startsWith("ja") || language === "jp";
      if (isJapanese) {
        // 1996-2001 Japanese Pokémon used the "Pocket Monsters Card
        // Game" back; from 2002 onward they moved to the modern art.
        if (typeof card.year === "number" && card.year <= 2001) {
          return "pokemon_jp_classic";
        }
        return "pokemon_jp_modern";
      }
      // English: WOTC (1999-2003) and post-WOTC use the same art but
      // collectors care about the print era; keep them distinct so a
      // future "Show period-accurate back" toggle is a one-line change.
      if (typeof card.year === "number" && card.year <= 2003) {
        return "pokemon_en_wotc";
      }
      return "pokemon_en_modern";
    }
    case "mtg":
    case "magic":
      return isDfc ? "mtg_dfc_helper" : "mtg_standard";
    case "yugioh":
    case "ygo":
      return language.startsWith("ja") ? "ygo_jp" : "ygo_en";
    case "lorcana":
      return "lorcana_en";
    case "onepiece":
    case "one_piece":
      return "onepiece_en";
    default:
      return "unknown";
  }
}

/**
 * Human-readable label for the variant — surfaced under the card in
 * the 3D modal so collectors know which back they're looking at.
 */
export const BACK_VARIANT_LABEL: Record<BackVariant, string> = {
  pokemon_en_modern: "Pokémon · English",
  pokemon_en_wotc: "Pokémon · WOTC era",
  pokemon_jp_classic: "Pokémon · Japanese (classic)",
  pokemon_jp_modern: "Pokémon · Japanese",
  mtg_standard: "Magic: The Gathering",
  mtg_dfc_helper: "Magic · Double-faced helper",
  ygo_en: "Yu-Gi-Oh! · English",
  ygo_jp: "Yu-Gi-Oh! · Japanese",
  lorcana_en: "Disney Lorcana",
  onepiece_en: "One Piece",
  unknown: "Generic back",
};
