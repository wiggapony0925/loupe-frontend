/**
 * SearchResultRow — live-catalog result row.
 *
 * Thin adapter: maps a `CardSearchResult` onto the canonical `CardSparkRow`
 * so live results, sealed matches, and the local vault rows all share ONE
 * row language (52×72 art · title · badge+meta · range/spark · price).
 *
 * Live results have no price history, so the middle slot shows the honest
 * low↔high market-range meter from `pricing_summary` when the provider
 * returned a band.
 */
import React from "react";
import { router, type Href } from "expo-router";
import { routes } from "@/shared/routes";
import type { CardSearchResult } from "@/infrastructure/http";
import { CardSparkRow } from "@/presentation/cards";
import { pickCardBlurhash, pickCardImageUrl } from "@/shared/cardImage";
import { useThemedPalette, type Palette } from "@/presentation/theme/tokens";

/** Brand tint per game so the badge (and only the badge) carries the TCG. */
function tcgTint(tcg: string, p: Palette): string {
  switch (tcg) {
    case "pokemon":
      return p.accent.amber;
    case "magic":
      return p.accent.blue;
    case "yugioh":
      return p.accent.purple;
    default:
      return p.accent.mint;
  }
}

function tcgLabel(tcg: string): string {
  switch (tcg) {
    case "pokemon":
      return "Pokémon";
    case "magic":
      return "Magic";
    case "yugioh":
      return "Yu-Gi-Oh!";
    default:
      return tcg.toUpperCase();
  }
}

interface SearchResultRowProps {
  card: CardSearchResult;
  bordered?: boolean;
  /** Priority hint for expo-image — off-screen rows should pass "low". */
  priority?: "low" | "normal" | "high";
  /** Fires *before* navigation so callers can persist analytics / recents. */
  onPressCapture?: () => void;
  /** Override the default `/card/[id]` destination (used by sealed). */
  route?: Href;
  /** Override the badge label (defaults to the TCG name). */
  badgeText?: string;
  /** Override the right-column eyebrow (defaults to "Market"). */
  priceLabel?: string;
}

export function SearchResultRow({
  card,
  bordered = false,
  priority = "low",
  onPressCapture,
  route,
  badgeText,
  priceLabel = "Market",
}: SearchResultRowProps) {
  const p = useThemedPalette();
  const summary = card.pricing_summary;
  const market = summary?.market?.amount ?? null;
  const low = summary?.low?.amount ?? null;
  const high = summary?.high?.amount ?? null;
  const small = pickCardImageUrl(card, "small");
  const normal = pickCardImageUrl(card, "normal");
  const tint = tcgTint(card.tcg, p);

  // Identity line: set · #number · year, with rarity folded in when known —
  // every field the catalog gives us earns its place on the row.
  const meta = [
    card.set_name,
    card.number ? `#${card.number}` : null,
    card.year,
    card.rarity,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <CardSparkRow
      thumbUri={small ?? normal}
      thumbFallbackUri={small && normal && small !== normal ? normal : undefined}
      blurhash={pickCardBlurhash(card)}
      recyclingKey={card.id}
      title={card.name}
      badge={{ label: badgeText ?? tcgLabel(card.tcg), tint }}
      meta={meta || null}
      range={low != null && high != null ? { low, high, market } : null}
      priceUsd={market}
      priceLabel={priceLabel}
      bordered={bordered}
      priority={priority}
      onPress={() => {
        onPressCapture?.();
        router.push(route ?? routes.card(card.id));
      }}
      accessibilityLabel={`${card.name}, ${meta || card.tcg}`}
    />
  );
}
