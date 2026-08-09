/**
 * PostGrid — a hashtag's posts as a three-column mosaic.
 *
 * A tag page is a browsing surface, not a reading one: you're scanning for
 * something that catches your eye, not reading captions in order. A feed
 * of full cards shows four posts per screen; this shows fifteen, which is
 * why every app that has a tag page uses a grid.
 *
 * Square tiles on a 1px grid — the gap is a gap, not a border, so the art
 * reads as one surface. Tapping a tile opens the post rather than a
 * lightbox: on a tag page you want the caption and the comments, which is
 * a different intent from tapping a photo inside a post you're already
 * reading.
 *
 * Posts without a photo still get a tile. A text-only post that vanishes
 * from its own tag page is a bug the author can see; the tile shows the
 * card art if there is one, and the caption if there isn't.
 */
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { Heart, Layers, MessageCircle } from "lucide-react-native";
import type { PostWire } from "@/infrastructure/http";
import { absolutize } from "@/presentation/features/social/SocialAvatar";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { formatCount } from "./PostCard";

const COLUMNS = 3;
const GAP = 1.5;

export function PostGrid({
  posts,
  onOpen,
  loading,
  footer,
  empty,
}: {
  posts: PostWire[];
  onOpen: (post: PostWire) => void;
  loading?: boolean;
  footer?: React.ReactNode;
  empty?: React.ReactNode;
}) {
  const p = useThemedPalette();
  const { width } = useWindowDimensions();
  const size = (width - GAP * (COLUMNS - 1)) / COLUMNS;

  if (loading) {
    return (
      <View style={styles.state}>
        <ActivityIndicator color={p.ink.dim} />
      </View>
    );
  }
  if (posts.length === 0) return <>{empty}</>;

  return (
    <View>
      <View style={styles.grid}>
        {posts.map((post) => (
          <Tile
            key={post.id}
            post={post}
            size={size}
            onPress={() => onOpen(post)}
          />
        ))}
      </View>
      {footer}
    </View>
  );
}

function Tile({
  post,
  size,
  onPress,
}: {
  post: PostWire;
  size: number;
  onPress: () => void;
}) {
  const p = useThemedPalette();
  const photo = post.media[0];
  const art = post.card?.image_url;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        post.body
          ? `${post.body.slice(0, 60)}, ${post.like_count} likes`
          : `Post by @${post.author.username}`
      }
      style={({ pressed }) => [
        { width: size, height: size, marginBottom: GAP, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      {photo ? (
        <Image
          source={{ uri: absolutize(photo.url) ?? undefined }}
          style={{ width: size, height: size, backgroundColor: p.bg.sunken }}
          contentFit="cover"
          transition={120}
          accessibilityIgnoresInvertColors
        />
      ) : art ? (
        // Card art is portrait; `contain` on a tinted ground beats cropping
        // the top off a Charizard.
        <View
          style={[
            styles.artTile,
            { width: size, height: size, backgroundColor: p.bg.sunken },
          ]}
        >
          <Image
            source={{ uri: art }}
            style={styles.art}
            contentFit="contain"
            transition={120}
          />
        </View>
      ) : (
        // Text-only. Showing the words is the only honest tile — a grey
        // placeholder would make the author think their post vanished.
        <View
          style={[
            styles.textTile,
            { width: size, height: size, backgroundColor: p.bg.elevated },
          ]}
        >
          <Text numberOfLines={5} style={[styles.textBody, { color: p.ink.muted }]}>
            {post.body ?? ""}
          </Text>
        </View>
      )}

      {/* Multi-photo marker, the way every grid signals a carousel. */}
      {post.media.length > 1 ? (
        <View style={styles.stack} pointerEvents="none">
          <Layers size={14} color="#fff" strokeWidth={2.4} />
        </View>
      ) : null}

      {/* Engagement, revealed on the tile itself. A tag page is ranked by
          it, so showing it is showing the reader why this is first. */}
      {post.like_count > 0 || post.comment_count > 0 ? (
        <View
          style={[styles.stats, { backgroundColor: withAlpha("#000000", 0.42) }]}
          pointerEvents="none"
        >
          {post.like_count > 0 ? (
            <View style={styles.stat}>
              <Heart size={11} color="#fff" fill="#fff" />
              <Text style={styles.statText}>{formatCount(post.like_count)}</Text>
            </View>
          ) : null}
          {post.comment_count > 0 ? (
            <View style={styles.stat}>
              <MessageCircle size={11} color="#fff" fill="#fff" />
              <Text style={styles.statText}>{formatCount(post.comment_count)}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GAP,
  },
  artTile: { alignItems: "center", justifyContent: "center", padding: 6 },
  art: { width: "100%", height: "100%" },
  textTile: { padding: 10, justifyContent: "center" },
  textBody: { fontSize: 11.5, lineHeight: 15 },
  stack: {
    position: "absolute",
    top: 6,
    right: 6,
    // A plain white glyph disappears over a light photo.
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 3,
  },
  stats: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  stat: { flexDirection: "row", alignItems: "center", gap: 3 },
  statText: { color: "#fff", fontSize: 10.5, fontWeight: "700" },
  state: { paddingVertical: 44, alignItems: "center" },
});
