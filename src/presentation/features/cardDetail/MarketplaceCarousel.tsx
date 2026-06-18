/**
 * MarketplaceCarousel — the single, always-on "Marketplaces" rail on the
 * card-detail screen.
 *
 * The backend rarely returns true seller rows (eBay isn't configured), but it
 * almost always returns per-marketplace *market prices* (Cardmarket / TCGplayer
 * / catalog) plus *shop deep-links*. The old UI fragmented that into a vertical
 * price list + an empty "No active seller rows" note + a separate "Search on"
 * rail, so most cards looked broken. This carousel folds all three data tiers
 * into ONE photo-forward rail that never collapses.
 *
 * The precedence rules + tile model live in `./marketplaceTiles` (pure,
 * unit-tested). This module is the view: it maps each tile onto the reusable
 * `MarketplaceTileCard` so listings, market prices, and shop links all share
 * one visual language.
 */
import React from "react";
import { ScrollView } from "react-native";
import {
  Activity,
  Clock,
  Gavel,
  Search,
  ShoppingBag,
  Tag,
  TrendingUp,
  type LucideIcon,
} from "lucide-react-native";
import {
  MarketplaceTileCard,
  MARKETPLACE_TILE_WIDTH,
} from "@/presentation/components/MarketplaceTileCard";
import type { ExternalBrowserTarget } from "@/presentation/components/ExternalBrowserSheet";
import { spacing, useThemedPalette, type Palette } from "@/presentation/theme/tokens";
import { normalizeSource, type MarketplaceTile, type TileToneKey } from "./marketplaceTiles";

// Re-export the pure API so callers can import everything from the carousel.
export {
  buildMarketplaceTiles,
  marketplaceSummaryBadge,
  formatListingSource,
  formatNativeMoney,
  type MarketplaceTile,
  type MarketplaceCardContext,
} from "./marketplaceTiles";

const TILE_GAP = spacing.sm + 2;

function toneColor(p: Palette, key: TileToneKey): string {
  switch (key) {
    case "blue":
      return p.accent.blue;
    case "mint":
      return p.accent.mint;
    case "amber":
      return p.accent.amber;
    case "purple":
      return p.accent.purple;
    default:
      return p.ink.muted;
  }
}

/** Fallback icon (shown when a tile has no photo) by kind/source. */
function tileIcon(tile: MarketplaceTile): LucideIcon {
  if (tile.kind === "listing") return tile.isAuction ? Gavel : ShoppingBag;
  if (tile.kind === "market") return tile.caption.toLowerCase().includes("trend") ? TrendingUp : Activity;
  switch (normalizeSource(tile.source)) {
    case "cardmarket":
      return ShoppingBag;
    case "pricecharting":
      return Tag;
    default:
      return Search;
  }
}

function formatTimeLeft(seconds: number | null): string | null {
  if (seconds === null || seconds === undefined) return null;
  if (seconds <= 0) return "ending";
  const days = Math.floor(seconds / 86_400);
  if (days >= 1) return `${days}d`;
  const hours = Math.floor(seconds / 3_600);
  if (hours >= 1) return `${hours}h`;
  return `${Math.max(1, Math.floor(seconds / 60))}m`;
}

export function MarketplaceCarousel({
  tiles,
  onOpen,
}: {
  tiles: MarketplaceTile[];
  onOpen: (target: ExternalBrowserTarget) => void;
}) {
  const p = useThemedPalette();
  if (tiles.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: TILE_GAP, paddingBottom: 4, paddingRight: 4 }}
      decelerationRate="fast"
      snapToInterval={MARKETPLACE_TILE_WIDTH + TILE_GAP}
      snapToAlignment="start"
    >
      {tiles.map((tile) => {
        const accent = toneColor(p, tile.toneKey);
        const timeLeft = tile.isAuction ? formatTimeLeft(tile.timeLeftSeconds) : null;
        return (
          <MarketplaceTileCard
            key={tile.id}
            imageUrl={tile.imageUrl}
            blurhash={tile.blurhash}
            fallbackIcon={tileIcon(tile)}
            accent={accent}
            sourceLabel={tile.sourceLabel}
            title={tile.title}
            caption={tile.caption}
            priceText={tile.priceText}
            condition={tile.condition}
            statusOverlay={timeLeft ? { icon: Clock, label: timeLeft } : null}
            disabled={!tile.target}
            onPress={tile.target ? () => onOpen(tile.target!) : undefined}
            accessibilityLabel={`${tile.sourceLabel} · ${tile.title}`}
            recyclingKey={tile.id}
          />
        );
      })}
    </ScrollView>
  );
}
