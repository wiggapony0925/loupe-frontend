/**
 * TagPill — THE hashtag pill. Every surface that draws a `#tag` in a
 * rounded box draws this one: the trending rail above For You, the tag row
 * under a post, the composer's suggestion row, and the draft preview.
 *
 * They had drifted into three hand-rolled variants (14/8 vs 13/8 vs 10/4
 * padding, neutral vs mint chrome) and the composer's chips had quietly
 * opted out of the mint-wash "this is an action" treatment that
 * HashtagChips documents as the house rule. One component, two sizes, one
 * treatment — the drift can't reopen.
 *
 * `onPress` is optional on purpose: the draft preview is a statement about
 * what WILL be indexed, not a navigation surface, so its pills are inert
 * (matching the web's DraftTags, which renders plain spans).
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

/** Text drawn on solid mint — same ink as every mint CTA in the app. */
const ON_MINT = "#06140d";

export interface TagPillProps {
  /** Without the leading `#` — the pill draws it. */
  tag: string;
  /** Post count, drawn dimmed after the tag (suggestion row only). */
  count?: number;
  /** md = rails and suggestions · sm = under a caption. */
  size?: "sm" | "md";
  /** Solid mint — a tag page showing its own tag. */
  active?: boolean;
  onPress?: () => void;
  /** Overrides the default "#tag" / "#tag, N posts" label. */
  accessibilityLabel?: string;
}

export function TagPill({
  tag,
  count,
  size = "md",
  active = false,
  onPress,
  accessibilityLabel,
}: TagPillProps) {
  const p = useThemedPalette();
  const s = size === "sm" ? sm : md;

  const chrome = {
    borderColor: active ? p.accent.mint : withAlpha(p.accent.mint, 0.38),
    backgroundColor: active ? p.accent.mint : withAlpha(p.accent.mint, 0.13),
  };
  const body = (
    <>
      <Text style={[s.text, { color: active ? ON_MINT : p.accent.mint }]}>
        #{tag}
      </Text>
      {count !== undefined && count > 0 ? (
        <Text style={[s.count, { color: active ? ON_MINT : p.ink.dim }]}>
          {count}
        </Text>
      ) : null}
    </>
  );

  if (!onPress) {
    return <View style={[s.chip, chrome]}>{body}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ??
        (count !== undefined && count > 0
          ? `#${tag}, ${count} posts`
          : `#${tag}`)
      }
      // The sm pill is well under the 44pt guideline on its own; vertical
      // slop makes the touch target honest. Horizontal slop stays inside
      // the row's 6pt gap — generous sideways slop made neighboring pills'
      // targets overlap, and an edge tap could open the WRONG tag.
      hitSlop={
        size === "sm" ? { top: 10, bottom: 10, left: 3, right: 3 } : 6
      }
      style={({ pressed }) => [s.chip, chrome, { opacity: pressed ? 0.7 : 1 }]}
    >
      {body}
    </Pressable>
  );
}

const base = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  borderWidth: 1,
  borderRadius: 999,
};

const md = StyleSheet.create({
  chip: { ...base, gap: 7, paddingHorizontal: 14, paddingVertical: 8 },
  text: { fontSize: 13.5, fontWeight: "700", letterSpacing: -0.2 },
  count: { fontSize: 11.5, fontWeight: "600" },
});

const sm = StyleSheet.create({
  chip: { ...base, gap: 5, paddingHorizontal: 10, paddingVertical: 4 },
  text: { fontSize: 12, fontWeight: "700", letterSpacing: -0.2 },
  count: { fontSize: 10.5, fontWeight: "600" },
});
