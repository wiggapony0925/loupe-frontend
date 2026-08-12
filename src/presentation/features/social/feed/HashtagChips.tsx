/**
 * HashtagChips — the trending tag row above For You.
 *
 * Bleeds edge-to-edge (the app's standing rule for every horizontal swipe
 * surface): a rail that stops at the page gutter looks like it ended, so
 * the negative margin puts the first chip against the screen edge and the
 * content padding puts it back in line with the text above it.
 *
 * The pill itself is TagPill — shared with the per-post tag row and the
 * composer, so the mint-wash "this is an action" treatment stays one
 * treatment.
 */
import React from "react";
import { ScrollView, StyleSheet } from "react-native";
import { router } from "expo-router";
import type { HashtagWire } from "@/infrastructure/http";
import { routes } from "@/shared/routes";
import { TagPill } from "./TagPill";

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
  if (tags.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -gutter }}
      contentContainerStyle={[styles.row, { paddingHorizontal: gutter }]}
    >
      {tags.map((tag) => (
        <TagPill
          key={tag.tag}
          tag={tag.tag}
          active={tag.tag === activeTag}
          onPress={() => router.push(routes.communityTag(tag.tag))}
          accessibilityLabel={`#${tag.tag}, ${tag.post_count} posts`}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 12 },
});
