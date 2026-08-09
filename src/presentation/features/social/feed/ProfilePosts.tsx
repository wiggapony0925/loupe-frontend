/**
 * ProfilePosts — a collector's posts, on their profile.
 *
 * A GRID, the same `PostGrid` a hashtag page uses. A profile is a browsing
 * surface — you're scanning someone's work, not reading it in order — and
 * the grid shows fifteen posts per screen where stacked cards showed four.
 * Tapping a tile opens the post, where the caption and comments live.
 *
 * Reusing the grid rather than writing a second one is the point: a tile
 * has to look and behave the same wherever you meet it, and a spacing fix
 * lands in both places at once.
 *
 * Plain View, not a FlatList: this lives inside the profile's ScrollView,
 * and nesting a VirtualizedList there breaks measurement (RN warns about
 * exactly this). Paging is a "Load more" button, so the list stays short
 * by construction and virtualisation buys nothing.
 */
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { feedPosts, useUserPosts } from "@/application/queries/social/useFeed";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { routes } from "@/shared/routes";
import { PostGrid } from "./PostGrid";

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
  const rows = feedPosts(posts.data);

  return (
    <PostGrid
      posts={rows}
      loading={posts.isLoading}
      // A profile grid is someone's work, not a leaderboard — see PostGrid.
      showStats={false}
      onOpen={(post) => router.push(routes.communityPost(post.id))}
      footer={
        posts.hasNextPage ? (
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
        ) : null
      }
      empty={
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
      }
    />
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
