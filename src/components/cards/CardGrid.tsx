/**
 * CardGrid — N-column virtualized grid of `CardTile`s.
 *
 * Renders via `FlatList` with `numColumns` + standard virtualization
 * settings tuned for card-image lists (`initialNumToRender=8`,
 * `windowSize=5`, `removeClippedSubviews=true`). First four tiles get
 * `priority="normal"`; the rest fall back to `"low"` so off-screen
 * thumbnails don't compete for decoder bandwidth on launch.
 */
import React, { useCallback, type ReactElement } from "react";
import { FlatList, View, type ListRenderItem } from "react-native";
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
}: CardGridProps) {
  const keyExtractor = useCallback((c: CardWire) => c.id, []);

  const renderItem: ListRenderItem<CardWire> = useCallback(
    ({ item, index }) => {
      const priority = index < 4 ? "normal" : "low";
      return (
        <View style={{ flex: 1 / numColumns, paddingHorizontal: gap / 2 }}>
          <CardTile
            card={item}
            size={tileSize}
            showPrice={showPrice}
            showSet={showSet}
            priority={priority}
            onPress={onCardPress ? () => onCardPress(item) : undefined}
            // Let the wrapper drive width; override tile's intrinsic width.
            style={{ width: "100%" }}
          />
        </View>
      );
    },
    [numColumns, gap, tileSize, showPrice, showSet, onCardPress],
  );

  return (
    <FlatList
      data={cards}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      numColumns={numColumns}
      columnWrapperStyle={
        numColumns > 1 ? { marginHorizontal: -gap / 2 } : undefined
      }
      contentContainerStyle={{ gap, paddingBottom: contentPaddingBottom }}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      initialNumToRender={8}
      windowSize={5}
      removeClippedSubviews
      showsVerticalScrollIndicator={false}
    />
  );
}
