/**
 * CollectionGrid — someone else's cards.
 *
 * A grid of art, not the app's list rows. Browsing a stranger's vault is a
 * looking activity: you're scanning for what they have, not comparing your
 * own positions, so the card image is the content and the numbers are the
 * caption. The Vault's dense row (name, set, grade, value, sparkline) carries
 * information you have no use for on someone else's collection and turns a
 * hundred cards into a wall of text.
 *
 * Tapping a card opens the NATIVE card screen — with live pricing, your own
 * ownership context and alerts — which is the thing the WebView embed had to
 * fake by intercepting web links.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import type { SocialCollectionItemWire } from "@/infrastructure/http";
import { routes } from "@/shared/routes";
import { useThemedPalette } from "@/presentation/theme/tokens";

const GAP = 10;
const PAGE_PADDING = 20;

export function CollectionGrid({
  items,
}: {
  items: readonly SocialCollectionItemWire[];
}) {
  const { width } = useWindowDimensions();
  // Three across on a normal phone; the tile width is derived rather than
  // fixed so a small phone shrinks the art instead of dropping a column.
  const columns = width >= 700 ? 4 : 3;
  const tileW =
    (width - PAGE_PADDING * 2 - GAP * (columns - 1)) / columns;

  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <CollectionTile key={item.id} item={item} width={tileW} />
      ))}
    </View>
  );
}

function CollectionTile({
  item,
  width,
}: {
  item: SocialCollectionItemWire;
  width: number;
}) {
  const p = useThemedPalette();
  // Standard trading-card ratio (2.5 × 3.5in). Deriving it keeps every tile
  // the same shape regardless of what the provider's image happens to be.
  const height = width * 1.4;
  const grade = Number(item.grade);
  const hasGrade = Number.isFinite(grade) && grade > 0;

  return (
    <Pressable
      onPress={() => router.push(routes.card(item.card_id))}
      accessibilityRole="button"
      accessibilityLabel={item.card_name ?? "Card"}
      style={{ width }}
    >
      <View
        style={[
          styles.art,
          { width, height, backgroundColor: p.bg.elevated, borderColor: p.line.default },
        ]}
      >
        {item.card_image_url ? (
          <Image
            source={{ uri: item.card_image_url }}
            style={{ width, height }}
            contentFit="cover"
            transition={140}
            accessibilityIgnoresInvertColors
          />
        ) : null}
        {hasGrade ? (
          <View style={[styles.grade, { backgroundColor: p.bg.base }]}>
            <Text style={[styles.gradeText, { color: p.ink.default }]}>
              {item.house} {grade % 1 === 0 ? grade : grade.toFixed(1)}
            </Text>
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} style={[styles.name, { color: p.ink.muted }]}>
        {item.card_name ?? "Unknown card"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  art: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  grade: {
    position: "absolute",
    left: 5,
    bottom: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  gradeText: { fontSize: 9.5, fontWeight: "800" },
  name: { fontSize: 11, marginTop: 5 },
});
