/**
 * CardHorizontalRail — horizontal-scrolling list of `CardTile`s.
 *
 * Use for "Hot right now", "Recently graded", "Top movers" rails. First
 * three tiles get `priority="normal"`; the rest are `"low"` so the
 * decoder isn't saturated on launch.
 *
 * Implementation note: this used FlashList horizontal, but FlashList v2
 * dropped `estimatedItemSize` and the auto-sizing path was stretching
 * tiles to fill the parent (which is why the Yu-Gi-Oh! rail surfaced
 * two huge cards while the Magic rail rendered three small ones with
 * identical props). For short rails (≤24 items) a plain ScrollView
 * gives predictable per-item width and the loss of virtualization is
 * negligible.
 */
import React from "react";
import { ScrollView, Text, View } from "react-native";
import { CardTile } from "./CardTile";
import { TILE_WIDTH, type CardWire, type CardTileSize } from "./types";

export interface CardHorizontalRailProps {
  cards: CardWire[];
  tileSize?: CardTileSize;
  showPrice?: boolean;
  showTrend?: boolean;
  title?: string;
  onCardPress?: (card: CardWire) => void;
  /** Inter-tile gap (dp). Defaults to 12. */
  gap?: number;
  snap?: boolean;
  /**
   * Horizontal padding the parent screen applies to its content box
   * (e.g. 20dp from the home/search ScrollView). When > 0, the rail
   * uses a negative outer margin equal to this value plus matching
   * `paddingHorizontal` on the content container so tiles still start
   * aligned with the section header but the scroll track extends to
   * the actual phone edge. This is the standard App Store / Netflix
   * "edge bleed" pattern — without it, scrolling content stops short
   * inside the parent padding and looks like it's overflowing weirdly.
   */
  edgeBleed?: number;
}

export function CardHorizontalRail({
  cards,
  tileSize = "md",
  showPrice = false,
  showTrend: _showTrend = false,
  title,
  onCardPress,
  gap = 12,
  snap = false,
  edgeBleed = 0,
}: CardHorizontalRailProps) {
  const tileWidth = TILE_WIDTH[tileSize];

  return (
    <View>
      {title ? (
        <Text className="mb-2 text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
          {title}
        </Text>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={edgeBleed > 0 ? { marginHorizontal: -edgeBleed } : undefined}
        contentContainerStyle={{
          gap,
          paddingLeft: edgeBleed > 0 ? edgeBleed : 0,
          paddingRight: edgeBleed > 0 ? edgeBleed : 4,
        }}
        snapToInterval={snap ? tileWidth + gap : undefined}
        decelerationRate={snap ? "fast" : "normal"}
      >
        {cards.map((item, index) => (
          <CardTile
            key={item.id}
            card={item}
            size={tileSize}
            width={tileWidth}
            showPrice={showPrice}
            priority={index < 3 ? "normal" : "low"}
            onPress={onCardPress ? () => onCardPress(item) : undefined}
          />
        ))}
      </ScrollView>
    </View>
  );
}
