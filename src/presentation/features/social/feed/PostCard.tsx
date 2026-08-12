/**
 * PostCard — one post in the feed.
 *
 * Anatomy, top to bottom (the order the reference feed uses, and the order
 * that survives a fast scroll):
 *
 *   author row   avatar · name + badges · @handle · when · Follow · ⋯
 *   media        edge-to-edge, pre-sized so nothing shifts as it loads
 *   card chip    the catalog card this post is about, when there is one
 *   actions      ♥ N Likes    💬 N       (counts beside the icon, not under)
 *   caption      handle in bold, then the text with #tags and @mentions live
 *   date         the absolute day, quiet
 *
 * The byline goes ABOVE the photo rather than below it. The reference app
 * puts it underneath, which means that while scrolling you meet a picture
 * with no idea whose it is and have to scroll PAST it to find out.
 */
import React, { memo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { BadgeCheck, Heart, MessageCircle, MoreHorizontal } from "lucide-react-native";
import type { PostWire } from "@/infrastructure/http";
import { SocialAvatar } from "@/presentation/features/social/SocialAvatar";
import { followLabel } from "@/presentation/features/social/socialLabels";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { relativeTime } from "@/shared/format";
import { routes } from "@/shared/routes";
import { PostCaption } from "./PostCaption";
import { PostMedia } from "./PostMedia";
import { TagPill } from "./TagPill";

export interface PostCardProps {
  post: PostWire;
  onToggleLike: (next: { postId: string; liked: boolean }) => void;
  onOpenComments: (post: PostWire) => void;
  /** Single tap on the media — opens the full-screen viewer. */
  onOpenMedia?: (post: PostWire, index: number) => void;
  onToggleFollow?: (next: { handle: string; following: boolean }) => void;
  onMore?: (post: PostWire) => void;
  /** Horizontal padding of the surrounding list, so media can bleed out. */
  gutter?: number;
  /** From the list's viewability tracker — drives inline video autoplay.
   *  Omitted (single-post surfaces) means "on screen". */
  mediaVisible?: boolean;
}

/** The heart's acknowledgement: liking punches, unliking dips. */
const LIKE_SPRING = {
  damping: 12,
  stiffness: 380,
  mass: 0.6,
  reduceMotion: ReduceMotion.System,
} as const;

function PostCardImpl({
  post,
  onToggleLike,
  onOpenComments,
  onOpenMedia,
  onToggleFollow,
  onMore,
  gutter = 20,
  mediaVisible,
}: PostCardProps) {
  const p = useThemedPalette();
  // Hooks before the author guard — a skipped row must not change hook order.
  const heartScale = useSharedValue(1);
  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));
  const author = post.author;
  // Wire data: a post row without its author can't be rendered honestly —
  // skip it rather than throw. (Everything on the card hangs off the author.)
  if (!author) return null;
  const isSelf = author.relationship === "self";
  const isFollowing =
    author.relationship === "following" || author.relationship === "requested";

  const openAuthor = () => router.push(routes.collector(author.username));

  const like = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    // Turning ON punches in with an overshoot; turning OFF is a quiet dip.
    // The state change is optimistic elsewhere — this is pure acknowledgement.
    heartScale.value = post.viewer_has_liked
      ? withSequence(
          withTiming(0.82, { duration: 90, reduceMotion: ReduceMotion.System }),
          withSpring(1, LIKE_SPRING),
        )
      : withSequence(
          withTiming(0.7, { duration: 60, reduceMotion: ReduceMotion.System }),
          withSpring(1.28, LIKE_SPRING),
          withSpring(1, LIKE_SPRING),
        );
    onToggleLike({ postId: post.id, liked: post.viewer_has_liked });
  };

  return (
    <View style={[styles.card, { borderBottomColor: p.line.default }]}>
      {/* ── Author ── */}
      <View style={[styles.head, { paddingHorizontal: gutter }]}>
        <Pressable onPress={openAuthor} hitSlop={6}>
          <SocialAvatar
            handle={author.username}
            name={author.display_name}
            url={author.avatar_url}
            size={38}
            isPro={author.is_pro}
          />
        </Pressable>
        <Pressable onPress={openAuthor} style={styles.ident}>
          <View style={styles.nameLine}>
            <Text
              numberOfLines={1}
              style={[styles.name, { color: p.ink.default }]}
            >
              {author.display_name?.trim() || `@${author.username}`}
            </Text>
            {author.is_admin ? (
              <BadgeCheck
                size={14}
                color={p.accent.blue}
                strokeWidth={2.6}
                accessibilityLabel="Loupe staff"
              />
            ) : null}
            {author.is_pro ? (
              <View
                style={[
                  styles.proChip,
                  { backgroundColor: withAlpha(p.accent.amber, 0.18) },
                ]}
              >
                <Text style={[styles.proChipText, { color: p.accent.amber }]}>
                  PRO
                </Text>
              </View>
            ) : null}
          </View>
          <Text numberOfLines={1} style={[styles.meta, { color: p.ink.dim }]}>
            @{author.username} · {relativeTime(post.created_at)}
            {/* Comments underneath may be answering words that are no
                longer there. Saying so is the honest thing. */}
            {post.edited_at ? " · edited" : ""}
          </Text>
        </Pressable>

        {!isSelf && onToggleFollow ? (
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onToggleFollow({
                handle: author.username,
                following: isFollowing,
              });
            }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`${followLabel(author.relationship)} @${author.username}`}
            style={[
              styles.follow,
              isFollowing
                ? { borderColor: p.line.default }
                : {
                    borderColor: "transparent",
                    backgroundColor: withAlpha(p.accent.mint, 0.16),
                  },
            ]}
          >
            <Text
              style={[
                styles.followText,
                { color: isFollowing ? p.ink.muted : p.accent.mint },
              ]}
            >
              {followLabel(author.relationship)}
            </Text>
          </Pressable>
        ) : null}

        {onMore ? (
          <Pressable
            onPress={() => onMore(post)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Post options"
          >
            <MoreHorizontal size={19} color={p.ink.dim} />
          </Pressable>
        ) : null}
      </View>

      {/* ── Media ── */}
      {(post.media?.length ?? 0) > 0 ? (
        <View style={styles.mediaWrap}>
          <PostMedia
            media={post.media}
            visible={mediaVisible}
            onPress={(index) => onOpenMedia?.(post, index)}
            // Only ever likes — see PostMedia. Already-liked stays liked.
            onDoubleTapLike={() => {
              if (!post.viewer_has_liked) {
                onToggleLike({ postId: post.id, liked: false });
              }
            }}
          />
        </View>
      ) : null}

      {/* ── The card this post is about ── */}
      {post.card ? (
        <Pressable
          onPress={() => router.push(routes.card(post.card!.card_id))}
          style={[
            styles.cardChip,
            {
              marginHorizontal: gutter,
              borderColor: p.line.default,
              backgroundColor: p.bg.elevated,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Open ${post.card.name ?? "this card"}`}
        >
          {post.card.image_url ? (
            <Image
              source={{ uri: post.card.image_url }}
              style={styles.cardArt}
              contentFit="cover"
              transition={120}
            />
          ) : null}
          <View style={styles.cardText}>
            <Text
              numberOfLines={1}
              style={[styles.cardName, { color: p.ink.default }]}
            >
              {post.card.name ?? "Card"}
            </Text>
            <Text numberOfLines={1} style={[styles.cardMeta, { color: p.ink.dim }]}>
              {[post.card.set_name, post.card.number && `#${post.card.number}`]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
        </Pressable>
      ) : null}

      {/* ── Actions ── */}
      <View style={[styles.actions, { paddingHorizontal: gutter }]}>
        <Pressable
          onPress={like}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={
            post.viewer_has_liked ? "Unlike this post" : "Like this post"
          }
          style={styles.action}
        >
          <Animated.View style={heartStyle}>
            <Heart
              size={21}
              color={post.viewer_has_liked ? p.accent.rose : p.ink.default}
              fill={post.viewer_has_liked ? p.accent.rose : "transparent"}
              strokeWidth={2}
            />
          </Animated.View>
          <Text style={[styles.actionText, { color: p.ink.default }]}>
            {formatCount(post.like_count)}{" "}
            {post.like_count === 1 ? "Like" : "Likes"}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onOpenComments(post)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${post.comment_count} comments`}
          style={styles.action}
        >
          <MessageCircle size={21} color={p.ink.default} strokeWidth={2} />
          <Text style={[styles.actionText, { color: p.ink.default }]}>
            {formatCount(post.comment_count)}
          </Text>
        </Pressable>
      </View>

      {/* ── Caption ── */}
      {post.body ? (
        <View style={{ paddingHorizontal: gutter }}>
          <PostCaption
            body={post.body}
            hashtags={post.hashtags}
            mentions={post.mentions}
            numberOfLines={3}
            prefix={author.username}
            onPressPrefix={openAuthor}
          />
        </View>
      ) : null}

      {/* ── The post's tags, as chips ── */}
      {/* Inline caption text can't wear a rounded box (RN ignores radius on
          nested Text runs), so the tags repeat under the caption as real
          pills — TagPill, shared with the trending rail. One scrollable
          row, not a wrap: a many-tag post was costing the feed three lines
          of pills, and every horizontal surface bleeds edge-to-edge (the
          standing rule). */}
      {post.hashtags.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tagRow}
          contentContainerStyle={[styles.tagRowContent, { paddingHorizontal: gutter }]}
        >
          {post.hashtags.map((tag) => (
            <TagPill
              key={tag}
              tag={tag}
              size="sm"
              onPress={() => router.push(routes.communityTag(tag))}
            />
          ))}
        </ScrollView>
      ) : null}

      <Text style={[styles.date, { color: p.ink.dim, paddingHorizontal: gutter }]}>
        {new Date(post.created_at).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })}
      </Text>
    </View>
  );
}

/** "6.0K" rather than "6017" — a feed reads counts at a glance. */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const k = n / 1000;
    return `${k < 10 ? k.toFixed(1) : Math.round(k)}K`;
  }
  const m = n / 1_000_000;
  return `${m < 10 ? m.toFixed(1) : Math.round(m)}M`;
}

/**
 * Memoised on the fields that actually change while scrolling. A feed
 * re-renders its whole window whenever one heart is tapped otherwise, and
 * every image in it flickers.
 */
export const PostCard = memo(PostCardImpl, (prev, next) => {
  const a = prev.post;
  const b = next.post;
  return (
    a.id === b.id &&
    a.viewer_has_liked === b.viewer_has_liked &&
    a.like_count === b.like_count &&
    a.comment_count === b.comment_count &&
    a.author?.relationship === b.author?.relationship &&
    // Visibility only ever changes for posts carrying video (the list
    // tracks nothing else), so photos keep their full memo win.
    prev.mediaVisible === next.mediaVisible
  );
});

const styles = StyleSheet.create({
  card: { paddingTop: 12, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  ident: { flex: 1, gap: 1 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 5 },
  name: { fontSize: 14.5, fontWeight: "700", letterSpacing: -0.2, flexShrink: 1 },
  meta: { fontSize: 12 },
  proChip: { borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1.5 },
  proChipText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.6 },
  follow: {
    minWidth: 82,
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  followText: { fontSize: 12.5, fontWeight: "700" },
  mediaWrap: { marginTop: 12 },
  cardChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 8,
    marginTop: 12,
  },
  cardArt: { width: 34, height: 47, borderRadius: 5 },
  cardText: { flex: 1, gap: 2 },
  cardName: { fontSize: 13.5, fontWeight: "700", letterSpacing: -0.2 },
  cardMeta: { fontSize: 11.5 },
  actions: { flexDirection: "row", alignItems: "center", gap: 20, marginTop: 12 },
  action: { flexDirection: "row", alignItems: "center", gap: 7 },
  actionText: { fontSize: 13.5, fontWeight: "600" },
  date: { fontSize: 11.5, marginTop: 8 },
  tagRow: { marginTop: 8 },
  tagRowContent: { flexDirection: "row", gap: 6 },
});
