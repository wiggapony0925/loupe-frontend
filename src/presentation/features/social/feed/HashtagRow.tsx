/**
 * HashtagRow — the composer's tag suggestions, always on screen.
 *
 * Two states, one row:
 *
 *   caret not in a tag  →  YOUR tags, most recently used first
 *   caret inside `#…`   →  matches for what's been typed so far
 *
 * Showing nothing until a `#` was typed made the feature invisible to
 * anyone who didn't already know it was there — and the moment it helps
 * most is the empty caption, when someone is deciding what to tag at all.
 * The server answers "your tags" with its own trending list behind it, so
 * a brand-new account still gets a full row.
 *
 * The row bleeds past its container to the screen edges — the standing
 * rule for every horizontal surface. It can't do that by itself: it lives
 * inside the composer's padded, avatar-indented caption column, so the
 * host tells it how far it is from each screen edge via `insetLeft` /
 * `insetRight`, and the negative margins climb back out.
 */
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import {
  useHashtagSuggestions,
  useRecentHashtags,
} from "@/application/queries/social/useFeed";
import { useThemedPalette } from "@/presentation/theme/tokens";
import { TagPill } from "./TagPill";

/** Where the chips line up once they've escaped — the page gutter. */
const GUTTER = 20;

export function HashtagRow({
  query,
  onPick,
  insetLeft = 0,
  insetRight = 0,
}: {
  /** Text after `#`, or null when the caret isn't inside a tag. */
  query: string | null;
  onPick: (tag: string) => void;
  /** Distance from this row's container to the LEFT screen edge. */
  insetLeft?: number;
  /** Distance from this row's container to the RIGHT screen edge. */
  insetRight?: number;
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
    <View
      style={[
        styles.wrap,
        {
          borderTopColor: p.line.default,
          marginLeft: -insetLeft,
          marginRight: -insetRight,
        },
      ]}
    >
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
          <TagPill
            key={entry.tag}
            tag={entry.tag}
            count={entry.post_count}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onPick(entry.tag);
            }}
            accessibilityLabel={`Use #${entry.tag}, ${entry.post_count} posts`}
          />
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
    paddingHorizontal: GUTTER,
  },
  row: { gap: 8, paddingHorizontal: GUTTER, paddingVertical: 10 },
});
