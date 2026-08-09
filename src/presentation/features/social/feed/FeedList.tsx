/**
 * FeedList — the one list every post surface renders through.
 *
 * The feed tabs, a collector's profile grid and a hashtag page are the same
 * list of the same rows with the same gestures; writing them three times is
 * how a like button ends up behaving differently depending on where you
 * tapped it. Callers pass a query result and a header, and get scrolling,
 * paging, pull-to-refresh, the comments sheet, likes, follows and delete.
 */
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { InfiniteData, UseInfiniteQueryResult } from "@tanstack/react-query";
import type { FeedWire, PostWire } from "@/infrastructure/http";
import {
  feedPosts,
  useDeletePost,
  useLikePost,
} from "@/application/queries/social/useFeed";
import { useFollowCollector } from "@/application/queries/social/useSocial";
import { useThemedPalette } from "@/presentation/theme/tokens";
import { CommentsSheet } from "./CommentsSheet";
import { PostCard } from "./PostCard";
import { ReportSheet, type ReportTarget } from "./ReportSheet";

export interface FeedListProps {
  query: UseInfiniteQueryResult<InfiniteData<FeedWire>>;
  header?: React.ReactElement | null;
  /** Shown when the query succeeds with nothing in it. */
  emptyTitle?: string;
  emptyBody?: string;
  emptyAction?: React.ReactNode;
  /** Extra bottom padding so content clears the floating island navbar. */
  bottomInset?: number;
}

export function FeedList({
  query,
  header,
  emptyTitle = "Nothing here yet",
  emptyBody = "Posts will show up here.",
  emptyAction,
  bottomInset = 130,
}: FeedListProps) {
  const p = useThemedPalette();
  const [openPost, setOpenPost] = useState<PostWire | null>(null);
  const [reporting, setReporting] = useState<ReportTarget | null>(null);

  const like = useLikePost();
  const follow = useFollowCollector();
  const remove = useDeletePost();

  const posts = feedPosts(query.data);

  /**
   * The ⋯ menu. What it offers depends on whose post it is: your own can be
   * deleted, someone else's can be reported. Staff see both — they can
   * remove anything, and should still be able to file a case for the record.
   */
  const onMore = useCallback(
    (post: PostWire) => {
      const mine = post.author.relationship === "self";
      const options: { text: string; style?: "cancel" | "destructive"; onPress?: () => void }[] =
        [];

      if (!mine) {
        options.push({
          text: "Report post",
          onPress: () =>
            setReporting({
              type: "post",
              id: post.id,
              label: `@${post.author.username}'s post`,
            }),
        });
      }
      if (post.can_delete) {
        options.push({
          text: "Delete post",
          style: "destructive",
          // The app's standing rule is "tap = do it, no confirm popups", but
          // deleting is irreversible and destroys other people's replies —
          // the one place a confirm earns its keep, and this sheet IS it.
          onPress: () => remove.mutate({ postId: post.id }),
        });
      }
      if (options.length === 0) return;
      options.push({ text: "Cancel", style: "cancel" });

      Alert.alert("Post options", undefined, options);
    },
    [remove],
  );

  return (
    <>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: bottomInset }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onToggleLike={like.mutate}
            onOpenComments={setOpenPost}
            onToggleFollow={follow.mutate}
            onMore={onMore}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching && !query.isFetchingNextPage}
            onRefresh={() => void query.refetch()}
            tintColor={p.ink.dim}
          />
        }
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) {
            void query.fetchNextPage();
          }
        }}
        ListEmptyComponent={
          query.isLoading ? (
            <View style={styles.state}>
              <ActivityIndicator color={p.ink.dim} />
            </View>
          ) : (
            <View style={styles.state}>
              <Text style={[styles.emptyTitle, { color: p.ink.default }]}>
                {emptyTitle}
              </Text>
              <Text style={[styles.emptyBody, { color: p.ink.dim }]}>
                {emptyBody}
              </Text>
              {emptyAction}
            </View>
          )
        }
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <View style={styles.state}>
              <ActivityIndicator color={p.ink.dim} />
            </View>
          ) : null
        }
      />
      <CommentsSheet post={openPost} onClose={() => setOpenPost(null)} />
      <ReportSheet target={reporting} onClose={() => setReporting(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  state: { paddingVertical: 48, paddingHorizontal: 32, alignItems: "center", gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: "800", letterSpacing: -0.3 },
  emptyBody: { fontSize: 13.5, textAlign: "center", lineHeight: 19 },
});
