/**
 * HashtagChips — the trending tag row above For You.
 *
 * Bleeds edge-to-edge (the app's standing rule for every horizontal swipe
 * surface): a rail that stops at the page gutter looks like it ended, so
 * the negative margin puts the first chip against the screen edge and the
 * content padding puts it back in line with the text above it.
 */
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { router } from "expo-router";
import type { HashtagWire } from "@/infrastructure/http";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { routes } from "@/shared/routes";

export function HashtagChips({
  tags = [],
  gutter = 20,
  activeTag,
}: {
  tags: HashtagWire[];
  gutter?: number;
  /** Rendered filled — used on a tag's own page. */
  activeTag?: string;
}) {
  const p = useThemedPalette();
  if (tags.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -gutter }}
      contentContainerStyle={[styles.row, { paddingHorizontal: gutter }]}
    >
      {tags.map((tag) => {
        const active = tag.tag === activeTag;
        return (
          <Pressable
            key={tag.tag}
            onPress={() => router.push(routes.communityTag(tag.tag))}
            accessibilityRole="button"
            accessibilityLabel={`#${tag.tag}, ${tag.post_count} posts`}
            style={({ pressed }) => [
              styles.chip,
              // Loupe-green tags, not neutral chips: gray-on-gray read as
              // decoration, and nobody knew the row was tappable. The mint
              // wash is the app's standing "this is an action" treatment
              // (follow pill, switcher thumb); active stays solid mint.
              {
                borderColor: active
                  ? p.accent.mint
                  : withAlpha(p.accent.mint, 0.38),
                backgroundColor: active
                  ? p.accent.mint
                  : withAlpha(p.accent.mint, 0.13),
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text
              style={[styles.text, { color: active ? "#06140d" : p.accent.mint }]}
            >
              #{tag.tag}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 12 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  text: { fontSize: 13.5, fontWeight: "700", letterSpacing: -0.2 },
});
