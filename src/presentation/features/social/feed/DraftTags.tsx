/**
 * DraftTags — the tags in the draft, as pills, while the caption is still
 * being written. Native port of the web's DraftTags (loupe-web
 * Feed/DraftTags.tsx): "a writer sees a tag become a tag the moment they
 * type it".
 *
 * The caption field already tints `#tokens` mint, but tint is a hint — a
 * pill is a promise, so the pills only show what the server's indexer
 * would actually keep: 2–64 characters of [A-Za-z0-9_], lowercased and
 * deduped (`#Charizard` and `#charizard` collapse into one pill, `#1`
 * shows nothing — the server never indexes single-character tags). It is
 * still a PREVIEW, not a verdict: the server's blocklist can drop a tag
 * this row shows, and that's fine — a client can't (and shouldn't) know
 * the blocklist.
 *
 * The pills are SOLID mint where the suggestion row's are mint-washed:
 * wash is the app's "this is an action" treatment and these are not
 * actions — they're the draft's state. Filled = chosen, washed = offered,
 * and the two rows stop reading as duplicates of each other.
 *
 * Purely derived from the body — no state, no callbacks, and the pills
 * are deliberately inert (matching web): the caption text is the only
 * editor of the tag list, so there is no remove-X to disagree with it.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useThemedPalette } from "@/presentation/theme/tokens";
import { TagPill } from "./TagPill";

/** The server's own bounds — HASHTAG_RE caps a tag at 64 chars and the
 *  policy floor is 2 (loupe-backend feed_common / hashtag_policy). An
 *  over-long run pills as its first 64 chars, exactly what gets indexed. */
const TAG_RE = /#([A-Za-z0-9_]{2,64})/g;

export function draftTagsFrom(body: string): string[] {
  const seen = new Set<string>();
  for (const match of body.matchAll(TAG_RE)) {
    seen.add(match[1]!.toLowerCase());
  }
  return [...seen];
}

export function DraftTags({ body }: { body: string }) {
  const p = useThemedPalette();
  const tags = draftTagsFrom(body);
  if (tags.length === 0) return null;

  return (
    <View style={styles.wrap} accessibilityLabel="Tags in this post">
      <Text style={[styles.label, { color: p.ink.dim }]}>IN THIS POST</Text>
      <View style={styles.row}>
        {tags.map((tag) => (
          <TagPill key={tag} tag={tag} size="sm" active />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, marginTop: 10 },
  label: { fontSize: 10, fontWeight: "800", letterSpacing: 1.6 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
});
