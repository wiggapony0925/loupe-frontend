/**
 * CardHorizontalRail — horizontal-scrolling list of `CardTile`s.
 *
 * Use for "Hot right now", "Recently graded", "Top movers" rails. First
 * three tiles get `priority="normal"`; the rest are `"low"` so the
 * decoder isn't saturated on launch.
 */
import React, { useCallback } from "react";
import { FlatList, Text, View, type ListRenderItem } from "react-native";
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
  showTrend = false,
  title,
  onCardPress,
  gap = 12,
  snap = false,
}: CardHorizontalRailProps) {
  const keyExtractor = useCallback((c: CardWire) => c.id, []);

  const renderItem: ListRenderItem<CardWire> = useCallback(
    ({ item, index }) => {
      const priority = index < 3 ? "normal" : "low";
      const trend = showTrend
        ? // synthesize a trend from pricing_summary if available, else null
          item.pricing_summary?.market?.amount != null
          ? null
          : null
        : null;
      return (
        <CardTile
          card={item}
          size={tileSize}
          width={TILE_WIDTH[tileSize]}
          showPrice={showPrice}
          trend={trend}
          priority={priority}
          onPress={onCardPress ? () => onCardPress(item) : undefined}
        />
      );
    },
    [tileSize, showPrice, showTrend, onCardPress],
  );

  return (
    <View>
      {title ? (
        <Text className="mb-2 text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
          {title}
        </Text>
      ) : null}
      <FlatList
        data={cards}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        horizontal
        ItemSeparatorComponent={() => <View style={{ width: gap }} />}
        showsHorizontalScrollIndicator={false}
        snapToInterval={snap ? TILE_WIDTH[tileSize] + gap : undefined}
        decelerationRate={snap ? "fast" : "normal"}
        contentContainerStyle={{ paddingRight: 4 }}
        initialNumToRender={6}
        windowSize={8}
        // Horizontal rails are short; clipping subviews routinely unmounts
        // tiles mid-fetch (especially on iOS), which is the visible "image
        // never appears" symptom. Keep them mounted.
        removeClippedSubviews={false}
      />
    </View>
  );
}
