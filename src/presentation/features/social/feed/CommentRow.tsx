/**
 * CommentRow — one comment, and its replies nested one level under it.
 *
 * The heart sits on the RIGHT edge, aligned with the body's first line, and
 * its count sits under the text beside "Reply" — so the tap target and the
 * number it changes are on opposite sides. That is the reference layout, and
 * it works because the count is read while reading the comment while the
 * heart is reached for deliberately.
 */
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { BadgeCheck, Heart } from "lucide-react-native";
import type { CommentWire } from "@/infrastructure/http";
import { SocialAvatar } from "@/presentation/features/social/SocialAvatar";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { relativeTime } from "@/shared/format";
import { routes } from "@/shared/routes";
import { PostCaption } from "./PostCaption";
import { formatCount } from "./PostCard";

export interface CommentRowProps {
  comment: CommentWire;
  onToggleLike: (next: { commentId: string; liked: boolean }) => void;
  onReply: (comment: CommentWire) => void;
  onDelete?: (comment: CommentWire) => void;
  /** Replies render the same row, indented and without their own replies. */
  depth?: 0 | 1;
  /** Fetches and appends the rest of a thread's replies. */
  onExpandReplies?: (comment: CommentWire) => void;
  extraReplies?: CommentWire[];
}

export function CommentRow({
  comment,
  onToggleLike,
  onReply,
  onDelete,
  depth = 0,
  onExpandReplies,
  extraReplies,
}: CommentRowProps) {
  const p = useThemedPalette();
  const [expanded, setExpanded] = useState(false);
  const author = comment.author;

  const inlineReplies = comment.replies ?? [];
  const shown = expanded && extraReplies?.length ? extraReplies : inlineReplies;
  const hidden = comment.reply_count - shown.length;

  return (
    <View style={depth === 1 ? styles.nested : undefined}>
      <View style={styles.row}>
        <Pressable
          onPress={() => router.push(routes.collector(author.username))}
          hitSlop={4}
        >
          <SocialAvatar
            handle={author.username}
            name={author.display_name}
            url={author.avatar_url}
            size={depth === 0 ? 32 : 26}
            isPro={author.is_pro}
          />
        </Pressable>

        <View style={styles.body}>
          <View style={styles.byline}>
            <Text
              onPress={() => router.push(routes.collector(author.username))}
              style={[styles.handle, { color: p.ink.default }]}
            >
              {author.username}
            </Text>
            {author.is_admin ? (
              <BadgeCheck size={12} color={p.accent.blue} strokeWidth={2.6} />
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
            <Text style={[styles.when, { color: p.ink.dim }]}>
              {relativeTime(comment.created_at)}
            </Text>
          </View>

          <PostCaption body={comment.body} hashtags={[]} mentions={[]} />

          <View style={styles.footer}>
            {comment.like_count > 0 ? (
              <Text style={[styles.footerText, { color: p.ink.dim }]}>
                {formatCount(comment.like_count)}{" "}
                {comment.like_count === 1 ? "Like" : "Likes"}
              </Text>
            ) : null}
            <Pressable onPress={() => onReply(comment)} hitSlop={6}>
              <Text style={[styles.footerText, { color: p.ink.dim }]}>Reply</Text>
            </Pressable>
            {comment.can_delete && onDelete ? (
              <Pressable onPress={() => onDelete(comment)} hitSlop={6}>
                <Text style={[styles.footerText, { color: p.ink.dim }]}>
                  Delete
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onToggleLike({
              commentId: comment.id,
              liked: comment.viewer_has_liked,
            });
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={
            comment.viewer_has_liked ? "Unlike this comment" : "Like this comment"
          }
          style={styles.heart}
        >
          <Heart
            size={15}
            color={comment.viewer_has_liked ? p.accent.rose : p.ink.dim}
            fill={comment.viewer_has_liked ? p.accent.rose : "transparent"}
            strokeWidth={2.2}
          />
        </Pressable>
      </View>

      {shown.map((reply) => (
        <CommentRow
          key={reply.id}
          comment={reply}
          onToggleLike={onToggleLike}
          onReply={onReply}
          onDelete={onDelete}
          depth={1}
        />
      ))}

      {hidden > 0 && depth === 0 ? (
        <Pressable
          onPress={() => {
            setExpanded(true);
            onExpandReplies?.(comment);
          }}
          style={styles.more}
        >
          <View style={[styles.moreRule, { backgroundColor: p.line.default }]} />
          <Text style={[styles.moreText, { color: p.ink.dim }]}>
            View {hidden} {hidden === 1 ? "reply" : "replies"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, paddingVertical: 10 },
  nested: { paddingLeft: 34 },
  body: { flex: 1, gap: 3 },
  byline: { flexDirection: "row", alignItems: "center", gap: 5 },
  handle: { fontSize: 13, fontWeight: "700" },
  proChip: { borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  proChipText: { fontSize: 8.5, fontWeight: "900", letterSpacing: 0.5 },
  when: { fontSize: 11.5 },
  footer: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 2 },
  footerText: { fontSize: 12, fontWeight: "600" },
  heart: { paddingTop: 4 },
  more: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 42,
    paddingVertical: 6,
  },
  moreRule: { width: 22, height: StyleSheet.hairlineWidth },
  moreText: { fontSize: 12, fontWeight: "600" },
});
