/**
 * One post — the permalink.
 *
 * This is where a notification lands ("@x commented on your post"), so it
 * opens with the comment sheet already up: arriving at the post but not the
 * comment you were told about would make the notification a dead end.
 */
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import {
  useDeletePost,
  useLikePost,
  usePost,
} from "@/application/queries/social/useFeed";
import { useFollowCollector } from "@/application/queries/social/useSocial";
import { CommentsSheet } from "@/presentation/features/social/feed/CommentsSheet";
import { PostCard } from "@/presentation/features/social/feed/PostCard";
import { useCommunityIslandPresence } from "@/presentation/navigation/CommunityIsland";
import { useThemedPalette } from "@/presentation/theme/tokens";

export default function PostScreen() {
  const p = useThemedPalette();
  const params = useLocalSearchParams<{ id?: string; comments?: string }>();
  const id = params.id ?? null;
  const [commentsOpen, setCommentsOpen] = useState(false);

  useCommunityIslandPresence();

  const post = usePost(id);
  const like = useLikePost();
  const follow = useFollowCollector();
  const remove = useDeletePost();

  // `?comments=1` is what a "someone commented" notification links to.
  useEffect(() => {
    if (params.comments === "1" && post.data) setCommentsOpen(true);
  }, [params.comments, post.data]);

  return (
    <View style={[styles.root, { backgroundColor: p.bg.base }]}>
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <View style={styles.bar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <ChevronLeft size={22} color={p.ink.default} strokeWidth={2.2} />
          </Pressable>
          <Text style={[styles.title, { color: p.ink.default }]}>Post</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {post.isLoading ? (
            <ActivityIndicator color={p.ink.dim} style={styles.loading} />
          ) : post.data ? (
            <PostCard
              post={post.data}
              onToggleLike={like.mutate}
              onOpenComments={() => setCommentsOpen(true)}
              onToggleFollow={follow.mutate}
              onMore={
                post.data.can_delete
                  ? (target) =>
                      remove.mutate(
                        { postId: target.id },
                        { onSuccess: () => router.back() },
                      )
                  : undefined
              }
            />
          ) : (
            <View style={styles.missing}>
              <Text style={[styles.missingTitle, { color: p.ink.default }]}>
                Post unavailable
              </Text>
              <Text style={[styles.missingBody, { color: p.ink.dim }]}>
                It was deleted, or it belongs to a private account you don't
                follow.
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      <CommentsSheet
        post={commentsOpen ? (post.data ?? null) : null}
        onClose={() => setCommentsOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  title: { fontSize: 17, fontWeight: "800", letterSpacing: -0.4 },
  content: { paddingBottom: 130 },
  loading: { paddingVertical: 40 },
  missing: { paddingVertical: 60, paddingHorizontal: 32, alignItems: "center", gap: 6 },
  missingTitle: { fontSize: 16, fontWeight: "800" },
  missingBody: { fontSize: 13.5, textAlign: "center", lineHeight: 19 },
});
