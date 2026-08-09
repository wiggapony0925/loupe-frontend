/**
 * HashtagRow — the composer's tag suggestions, always on screen.
 *
 * Supersedes the type-a-`#`-first behaviour of HashtagSuggestions (still
 * used where a row should only appear mid-token). Two states, one row:
 *
 *   caret not in a tag  →  YOUR tags, most recently used first
 *   caret inside `#…`   →  matches for what's been typed so far
 *
 * Showing nothing until a `#` was typed made the feature invisible to
 * anyone who didn't already know it was there — and the moment it helps
 * most is the empty caption, when someone is deciding what to tag at all.
 * The server answers "your tags" with its own trending list behind it, so
 * a brand-new account still gets a full row.
 */
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import {
  useHashtagSuggestions,
  useRecentHashtags,
} from "@/application/queries/social/useFeed";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

export function HashtagRow({
  query,
  onPick,
}: {
  /** Text after `#`, or null when the caret isn't inside a tag. */
  query: string | null;
  onPick: (tag: string) => void;
}) {
  const p = useThemedPalette();
  const typing = query !== null;
  // Both hooks always run — React's rules — but each is gated internally, so
  // only the one that matches the current state actually fetches.
  const matches = useHashtagSuggestions(query);
  const recent = useRecentHashtags(!typing);

  const rows = (typing ? matches.data : recent.data) ?? [];
  if (rows.length === 0) return null;

  return (
    <View style={[styles.wrap, { borderTopColor: p.line.default }]}>
      <Text style={[styles.label, { color: p.ink.dim }]}>
        {typing ? "MATCHING TAGS" : "YOUR TAGS"}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // "always", not "handled": the composer's keyboard must survive a
        // chip tap, or picking a tag dismisses the keyboard and the caret
        // that the completion depends on.
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
                borderColor: pressed ? p.accent.mint : p.line.default,
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
  wrap: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  label: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6,
    paddingHorizontal: 20,
  },
  // Edge-to-edge: the row bleeds past the page gutter so a chip can sit
  // half-off screen and read as scrollable. Standing rule for every
  // horizontal surface in the app.
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
