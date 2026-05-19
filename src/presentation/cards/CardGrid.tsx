/**
 * CardGrid — N-column virtualized grid of `CardTile`s.
 *
 * Renders via `FlatList` with `numColumns` + standard virtualization
 * settings tuned for card-image lists (`initialNumToRender=8`,
 * `windowSize=5`, `removeClippedSubviews=true`). First four tiles get
 * `priority="normal"`; the rest fall back to `"low"` so off-screen
 * thumbnails don't compete for decoder bandwidth on launch.
 */
import React, { useCallback, useMemo, type ReactElement } from "react";
import { FlatList, Platform, View, useWindowDimensions, type ListRenderItem } from "react-native";
import { CardTile } from "./CardTile";
import type { CardWire, CardTileSize } from "./types";

export interface CardGridProps {
  cards: CardWire[];
  numColumns?: number;
  tileSize?: CardTileSize;
  showPrice?: boolean;
  showSet?: boolean;
  ListHeaderComponent?: ReactElement | null;
  ListEmptyComponent?: ReactElement | null;
  onCardPress?: (card: CardWire) => void;
  contentPaddingBottom?: number;
  /** Inter-tile gap (dp). Defaults to 12. */
  gap?: number;
  /** Page-level horizontal padding. Used to compute pixel-perfect column widths. */
  horizontalPadding?: number;
}

export function CardGrid({
  cards,
  numColumns = 2,
  tileSize = "md",
  showPrice = false,
  showSet,
  ListHeaderComponent,
  ListEmptyComponent,
  onCardPress,
  contentPaddingBottom = 0,
  gap = 12,
  horizontalPadding = 16,
}: CardGridProps) {
  const { width: screenW } = useWindowDimensions();
  const keyExtractor = useCallback((c: CardWire) => c.id, []);

  // Compute exact pixel width for tiles to avoid layout blowups on iOS
  // caused by nested aspectRatios inside flex containers.
  const tileW = useMemo(() => {
    return Math.floor((screenW - horizontalPadding * 2 - gap * (numColumns - 1)) / numColumns);
  }, [screenW, horizontalPadding, gap, numColumns]);

  const renderItem: ListRenderItem<CardWire> = useCallback(
    ({ item, index }) => {
      const priority = index < 4 ? "normal" : "low";
      return (
        <View style={{ width: tileW, paddingHorizontal: gap / 2 }}>
          <CardTile
            card={item}
            size={tileSize}
            width={tileW}
            showPrice={showPrice}
            showSet={showSet}
            priority={priority}
            onPress={onCardPress ? () => onCardPress(item) : undefined}
          />
        </View>
      );
    },
    [tileW, gap, tileSize, showPrice, showSet, onCardPress],
  );

  return (
    <FlatList
      data={cards}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      numColumns={numColumns}
      columnWrapperStyle={
        numColumns > 1 ? { marginHorizontal: horizontalPadding - gap / 2 } : { paddingHorizontal: horizontalPadding }
      }
      contentContainerStyle={{ gap, paddingBottom: contentPaddingBottom }}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      initialNumToRender={12}
      windowSize={10}
      removeClippedSubviews={Platform.OS === 'android'}
    />
  );
}
