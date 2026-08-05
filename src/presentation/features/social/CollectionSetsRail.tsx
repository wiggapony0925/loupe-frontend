/**
 * CollectionSetsRail — the sets a collector owns, as an edge-to-edge rail.
 *
 * "They have 5 Evolving Skies" is how collectors actually size each other
 * up, so the breakdown gets its own App-Store-style shelf above the card
 * grid: cover art (the set's most valuable card), set name, count and
 * value. Renders nothing for one-set collections — a rail of one tile
 * reads as a mistake, and the grid below already tells that story.
 */
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Layers } from "lucide-react-native";
import type { SocialCollectionSetWire } from "@/infrastructure/http";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

const PAGE_PADDING = 20;

export function CollectionSetsRail({
  sets,
}: {
  sets: readonly SocialCollectionSetWire[];
}) {
  const p = useThemedPalette();
  if (sets.length < 2) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.bleed}
      contentContainerStyle={styles.rail}
    >
      {sets.map((s) => (
        <View
          key={s.name}
          style={[
            styles.tile,
            { borderColor: p.line.default, backgroundColor: p.bg.elevated },
          ]}
        >
          {s.cover_image_url ? (
            <Image
              source={{ uri: s.cover_image_url }}
              style={styles.cover}
              contentFit="cover"
              transition={120}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View
              style={[
                styles.cover,
                styles.coverFallback,
                { backgroundColor: withAlpha(p.accent.mint, 0.1) },
              ]}
            >
              <Layers size={20} color={p.accent.mint} strokeWidth={2.2} />
            </View>
          )}
          <View style={styles.meta}>
            <Text numberOfLines={1} style={[styles.name, { color: p.ink.default }]}>
              {s.name}
            </Text>
            <Text numberOfLines={1} style={[styles.sub, { color: p.ink.dim }]}>
              {s.count} {s.count === 1 ? "card" : "cards"}
              {s.estimated_value_usd != null
                ? ` · $${Number(s.estimated_value_usd).toLocaleString("en-US", {
                    maximumFractionDigits: 0,
                  })}`
                : ""}
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bleed: { marginHorizontal: -PAGE_PADDING },
  rail: { paddingHorizontal: PAGE_PADDING, gap: 10, paddingVertical: 2 },
  tile: {
    width: 132,
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  cover: { width: "100%", height: 92 },
  coverFallback: { alignItems: "center", justifyContent: "center" },
  meta: { paddingHorizontal: 10, paddingVertical: 8, gap: 2 },
  name: { fontSize: 12.5, fontWeight: "700", letterSpacing: -0.2 },
  sub: { fontSize: 11 },
});
