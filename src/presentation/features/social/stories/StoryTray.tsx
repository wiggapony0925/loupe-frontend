/**
 * StoryTray — the row of avatars above the feed.
 *
 * Ordered by the SERVER (unseen first, then recency), rendered verbatim.
 * The client re-sorting would put the two surfaces one refetch out of step
 * with each other, and the ordering is the feature: the tray is a queue of
 * what you haven't watched, not a list of who posts most.
 *
 * Your own slot always comes first and always shows a ⊕, whether or not you
 * have anything up — it is the entry point to posting, not a queue item, so
 * it never wears an unseen ring.
 */
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { Plus } from "lucide-react-native";
import type { StoryTrayEntryWire } from "@/infrastructure/http/wire/social";
import { useStoryTray } from "@/application/queries/social/useStories";
import { absolutize } from "@/presentation/features/social/SocialAvatar";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { relativeTime } from "@/shared/format";

const SIZE = 62;
const GUTTER = 20;

export function StoryTray({
  onOpen,
  onCompose,
}: {
  /** Watch this collector's stories. */
  onOpen: (handle: string) => void;
  /** The ⊕ — record a new one. */
  onCompose: () => void;
}) {
  const p = useThemedPalette();
  const tray = useStoryTray();

  const mine = tray.data?.mine ?? null;
  const entries = tray.data?.entries ?? [];

  // Before the first load there is nothing honest to show but the compose
  // slot; a row of skeleton rings implies stories that may not exist.
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Standing rule: every horizontal surface bleeds edge to edge, so a
      // half-visible avatar at the margin reads as scrollable.
      contentContainerStyle={styles.row}
    >
      <Pressable
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          onCompose();
        }}
        onLongPress={mine ? () => onOpen(mine.author.username) : undefined}
        accessibilityRole="button"
        accessibilityLabel={
          mine ? "Add to your story. Long press to watch it." : "Add to your story"
        }
        style={styles.cell}
      >
        <View style={styles.avatarWrap}>
          <View
            style={[
              styles.ring,
              { borderColor: mine ? p.accent.mint : "transparent" },
            ]}
          >
            <Avatar
              url={mine?.preview_url ?? null}
              fallback={p.bg.elevated}
              border={p.bg.base}
            />
          </View>
          <View
            style={[
              styles.plus,
              { backgroundColor: p.accent.mint, borderColor: p.bg.base },
            ]}
          >
            <Plus size={13} color="#06140d" strokeWidth={3.2} />
          </View>
        </View>
        <Text numberOfLines={1} style={[styles.label, { color: p.ink.default }]}>
          Your story
        </Text>
      </Pressable>

      {entries.map((entry) => (
        <TrayCell
          key={entry.author.user_id}
          entry={entry}
          onPress={() => onOpen(entry.author.username)}
        />
      ))}
    </ScrollView>
  );
}

function TrayCell({
  entry,
  onPress,
}: {
  entry: StoryTrayEntryWire;
  onPress: () => void;
}) {
  const p = useThemedPalette();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={
        `${entry.author.username}, ${entry.story_count} ` +
        `${entry.story_count === 1 ? "story" : "stories"}, ` +
        `${entry.has_unseen ? "unwatched" : "watched"}`
      }
      style={({ pressed }) => [styles.cell, pressed && { opacity: 0.7 }]}
    >
      <View
        style={[
          styles.ring,
          {
            // A watched ring goes quiet rather than disappearing: the
            // avatar still has to sit on the same 62pt grid, or the row
            // reflows as you watch your way along it.
            borderColor: entry.has_unseen ? p.accent.mint : withAlpha(p.ink.dim, 0.3),
          },
        ]}
      >
        <Avatar
          url={entry.preview_url}
          fallback={p.bg.elevated}
          border={p.bg.base}
        />
      </View>
      <Text numberOfLines={1} style={[styles.label, { color: p.ink.muted }]}>
        {entry.author.username}
      </Text>
      <Text numberOfLines={1} style={[styles.when, { color: p.ink.dim }]}>
        {relativeTime(entry.latest_at)}
      </Text>
    </Pressable>
  );
}

/** The newest story's first frame, behind the ring. */
function Avatar({
  url,
  fallback,
  border,
}: {
  url: string | null;
  fallback: string;
  border: string;
}) {
  const style = {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: fallback,
    borderWidth: 2,
    borderColor: border,
  };
  if (!url) return <View style={style} />;
  return (
    <Image
      source={{ uri: absolutize(url) ?? undefined }}
      style={style}
      contentFit="cover"
      transition={140}
      accessibilityIgnoresInvertColors
    />
  );
}

const styles = StyleSheet.create({
  row: { gap: 14, paddingHorizontal: GUTTER, paddingVertical: 12 },
  cell: { width: SIZE + 8, alignItems: "center", gap: 5 },
  avatarWrap: { position: "relative" },
  ring: {
    padding: 2.5,
    borderWidth: 2.5,
    borderRadius: (SIZE + 10) / 2,
  },
  plus: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 21,
    height: 21,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 2.5,
  },
  label: { fontSize: 11.5, fontWeight: "700", maxWidth: SIZE + 8 },
  when: { fontSize: 10, fontWeight: "600" },
});
