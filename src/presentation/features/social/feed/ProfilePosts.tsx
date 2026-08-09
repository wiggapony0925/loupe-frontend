/**
 * ProfilePosts — a collector's posts, on their profile.
 *
 * Rendered as a plain mapped list rather than a FlatList: this lives inside
 * the profile's ScrollView, and nesting a VirtualizedList in a ScrollView
 * breaks measurement (RN warns about exactly this). A profile's post count
 * is bounded by a "Load more" button, so the list stays short by
 * construction and virtualisation buys nothing.
 *
 * Everything else — the card chrome, likes, comments, the lightbox, the ⋯
 * menu — is the SAME components the feed uses. A post has to look and
 * behave identically wherever you meet it.
 */
import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { PostWire } from "@/infrastructure/http";
import {
  feedPosts,
  useLikePost,
  useUserPosts,
} from "@/application/queries/social/useFeed";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { CommentsSheet } from "./CommentsSheet";
import { ImageLightbox } from "./ImageLightbox";
import { PostCard } from "./PostCard";
import { ReportSheet, type ReportTarget } from "./ReportSheet";

export function ProfilePosts({
  handle,
  isSelf,
  onCompose,
}: {
  handle: string;
  isSelf: boolean;
  /** Offered in the empty state on your OWN profile. */
  onCompose?: () => void;
}) {
  const p = useThemedPalette();
  const posts = useUserPosts(handle);
  const like = useLikePost();

  const [openPost, setOpenPost] = useState<PostWire | null>(null);
  const [reporting, setReporting] = useState<ReportTarget | null>(null);
  const [viewing, setViewing] = useState<{
    media: PostWire["media"];
    index: number;
  } | null>(null);

  const rows = feedPosts(posts.data);

  if (posts.isLoading) {
    return (
      <View style={styles.state}>
        <ActivityIndicator color={p.ink.dim} />
      </View>
    );
  }

  if (rows.length === 0) {
    return (
      <View style={styles.state}>
        <Text style={[styles.emptyTitle, { color: p.ink.default }]}>
          {isSelf ? "You haven't posted yet" : "No posts yet"}
        </Text>
        <Text style={[styles.emptyBody, { color: p.ink.dim }]}>
          {isSelf
            ? "Show off a pull, a grail, or a whole binder."
            : "When they post, it'll show up here."}
        </Text>
        {isSelf && onCompose ? (
          <Pressable
            onPress={onCompose}
            accessibilityRole="button"
            style={[styles.cta, { backgroundColor: p.accent.mint }]}
          >
            <Text style={styles.ctaText}>Create a post</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View>
      {rows.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onToggleLike={like.mutate}
          onOpenComments={setOpenPost}
          onOpenMedia={(target, index) =>
            setViewing({ media: target.media, index })
          }
          // No Follow button here: you're already on their profile, where
          // the header's own follow control is the one that matters.
          onToggleFollow={undefined}
          onMore={
            isSelf
              ? undefined
              : (target) =>
                  setReporting({
                    type: "post",
                    id: target.id,
                    label: `@${target.author.username}'s post`,
                  })
          }
        />
      ))}

      {posts.hasNextPage ? (
        <Pressable
          onPress={() => void posts.fetchNextPage()}
          disabled={posts.isFetchingNextPage}
          accessibilityRole="button"
          style={[
            styles.more,
            {
              borderColor: p.line.default,
              backgroundColor: withAlpha(p.ink.default, 0.03),
            },
          ]}
        >
          {posts.isFetchingNextPage ? (
            <ActivityIndicator size="small" color={p.ink.dim} />
          ) : (
            <Text style={[styles.moreText, { color: p.ink.muted }]}>
              Load more posts
            </Text>
          )}
        </Pressable>
      ) : null}

      <CommentsSheet post={openPost} onClose={() => setOpenPost(null)} />
      <ReportSheet target={reporting} onClose={() => setReporting(null)} />
      <ImageLightbox
        media={viewing?.media ?? null}
        initialIndex={viewing?.index ?? 0}
        onClose={() => setViewing(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  state: { paddingVertical: 44, paddingHorizontal: 28, alignItems: "center", gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: "800", letterSpacing: -0.3 },
  emptyBody: { fontSize: 13.5, textAlign: "center", lineHeight: 19 },
  cta: {
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  ctaText: { fontSize: 14, fontWeight: "800", color: "#06140d" },
  more: {
    marginHorizontal: 20,
    marginTop: 14,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  moreText: { fontSize: 13.5, fontWeight: "700" },
});
