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
        contentContainerStyle={{ gap, paddingRight: 4 }}
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
