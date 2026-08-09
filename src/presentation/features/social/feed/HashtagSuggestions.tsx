/**
 * HashtagSuggestions — what to offer while someone is typing a `#`.
 *
 * Appears the instant a `#` is typed and narrows as they keep going. The
 * empty-query case deliberately shows TRENDING rather than nothing: that
 * first moment is when a suggestion is most useful, and an empty list
 * there teaches people the feature doesn't work.
 *
 * Tapping completes the tag in place and adds a trailing space, so the
 * next word doesn't get swallowed into the tag — the single most annoying
 * bug in every autocomplete that doesn't do it.
 */
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useHashtagSuggestions } from "@/application/queries/social/useFeed";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

export { activeHashtag, completeHashtag } from "./hashtagCaret";

export function HashtagSuggestions({
  query,
  onPick,
}: {
  /** The text after `#`, or null when the caret isn't in a tag. */
  query: string | null;
  onPick: (tag: string) => void;
}) {
  const p = useThemedPalette();
  const suggestions = useHashtagSuggestions(query);
  const rows = suggestions.data ?? [];

  if (query === null || rows.length === 0) return null;

  return (
    <View style={[styles.wrap, { borderTopColor: p.line.default }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={styles.row}
      >
        {rows.map((entry) => (
          <Pressable
            key={entry.tag}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onPick(entry.tag);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Use #${entry.tag}, ${entry.post_count} posts`}
            style={({ pressed }) => [
              styles.chip,
              {
                borderColor: p.line.default,
                backgroundColor: pressed
                  ? withAlpha(p.accent.mint, 0.18)
                  : p.bg.elevated,
              },
            ]}
          >
            <Text style={[styles.tag, { color: p.accent.mint }]}>
              #{entry.tag}
            </Text>
            {entry.post_count > 0 ? (
              <Text style={[styles.count, { color: p.ink.dim }]}>
                {entry.post_count}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: StyleSheet.hairlineWidth },
  row: { gap: 8, paddingHorizontal: 20, paddingVertical: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  tag: { fontSize: 14, fontWeight: "700", letterSpacing: -0.2 },
  count: { fontSize: 11.5, fontWeight: "600" },
});
