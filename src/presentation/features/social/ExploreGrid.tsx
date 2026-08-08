/**
 * ExploreGrid — Instagram's Explore, for cards.
 *
 * A full-bleed mosaic of card art from public collections: hairline gaps,
 * no rounded corners, no captions, no chrome. The art IS the interface.
 * Tapping a tile opens that card.
 *
 * Why a mosaic and not the old people rail: Community used to answer "who
 * is here" with a column of avatars, on an app whose entire subject is card
 * art. This answers "what is here", which is the question a collector opens
 * the tab with — and it means a collector with no cards is simply absent
 * from the grid rather than rendered as an empty frame.
 *
 * Band geometry lives in `exploreMosaic.ts` (pure + unit-tested); this file
 * only draws what that returns.
 */
import React, { useMemo } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import type { ExploreCardWire } from "@/infrastructure/http";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { mosaicBands } from "./exploreMosaic";

/** Hairline seam between tiles — Instagram's grid is nearly gapless. */
const GAP = 2;
const COLUMNS = 3;
/** Card art is portrait; a square-ish cell crops least badly. */
const CELL_RATIO = 1.18;

export function ExploreGrid({
  cards,
  onOpenCard,
}: {
  cards: readonly ExploreCardWire[];
  onOpenCard: (card: ExploreCardWire) => void;
}) {
  const p = useThemedPalette();
  const { width } = useWindowDimensions();

  const unit = (width - GAP * (COLUMNS - 1)) / COLUMNS;
  const cell = unit * CELL_RATIO;
  const bands = useMemo(() => mosaicBands(cards), [cards]);

  if (cards.length === 0) return null;

  const tile = (card: ExploreCardWire, w: number, h: number, key: string) => (
    <Pressable
      key={key}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onOpenCard(card);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${card.card_name ?? "Card"}, owned by @${card.username}`}
      style={({ pressed }) => [
        { width: w, height: h, backgroundColor: withAlpha(p.ink.default, 0.06) },
        pressed ? { opacity: 0.72 } : null,
      ]}
    >
      <Image
        source={{ uri: card.image_url }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={140}
        recyclingKey={card.id}
        accessibilityIgnoresInvertColors
      />
    </Pressable>
  );

  return (
    <View style={styles.grid}>
      {bands.map((band, bi) => {
        if (band.kind === "plain") {
          return (
            <View key={`p${bi}`} style={styles.row}>
              {band.items.map((c, i) => tile(c, unit, cell, `${c.id}-${i}`))}
            </View>
          );
        }
        // Hero band: a 2x2 tile beside two stacked singles.
        const [big, a, b] = band.items;
        const bigSize = unit * 2 + GAP;
        const bigHeight = cell * 2 + GAP;
        const stack = (
          <View key="stack" style={{ gap: GAP }}>
            {tile(a!, unit, cell, `${a!.id}-s1`)}
            {tile(b!, unit, cell, `${b!.id}-s2`)}
          </View>
        );
        const hero = tile(big!, bigSize, bigHeight, `${big!.id}-hero`);
        return (
          <View key={`h${bi}`} style={styles.row}>
            {band.side === "left" ? [hero, stack] : [stack, hero]}
          </View>
        );
      })}
    </View>
  );
}

/** Skeleton in the grid's own shape, so nothing shifts when art lands. */
export function ExploreGridSkeleton() {
  const p = useThemedPalette();
  const { width } = useWindowDimensions();
  const unit = (width - GAP * (COLUMNS - 1)) / COLUMNS;
  const cell = unit * CELL_RATIO;
  return (
    <View style={styles.grid}>
      {[0, 1, 2].map((r) => (
        <View key={r} style={styles.row}>
          {[0, 1, 2].map((c) => (
            <View
              key={c}
              style={{
                width: unit,
                height: cell,
                // NOT bg.elevated: in light mode that is #ffffff on a #f7f7f8
                // page — an invisible block that reads as a 300pt hole rather
                // than as loading. A tinted ink wash works on both themes.
                backgroundColor: withAlpha(p.ink.default, 0.07),
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

export function ExploreEmpty({ label }: { label: string }) {
  const p = useThemedPalette();
  return <Text style={[styles.empty, { color: p.ink.dim }]}>{label}</Text>;
}

const styles = StyleSheet.create({
  grid: { gap: GAP },
  row: { flexDirection: "row", gap: GAP },
  empty: { textAlign: "center", paddingVertical: 40, fontSize: 13 },
});
