/**
 * CommentsSheet — the thread under a post.
 *
 * Built on the shared BottomSheet so it inherits the app's sheet chrome
 * (presentation, backdrop, handle, close control) rather than re-deriving it.
 *
 * Three things this screen has to get right:
 *
 * • **The caption is pinned at the top of the list**, not floating above it,
 *   so the thread reads as a reply to something rather than as a bare list
 *   of remarks.
 * • **The composer never hides under the keyboard.** It is the reason the
 *   sheet was opened; a composer you have to dismiss the keyboard to find
 *   makes the whole surface feel broken.
 * • **Replying is visibly aimed.** Tapping Reply pins a "Replying to @x"
 *   strip above the input with a way out — otherwise a reply that lands as
 *   a top-level comment is a silent mistake.
 */
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { SendHorizonal, X } from "lucide-react-native";
import type { CommentWire, PostWire } from "@/infrastructure/http";
import {
  useAddComment,
  useComments,
  useDeleteComment,
  useLikeComment,
  useReplies,
} from "@/application/queries/social/useFeed";
import { useSocialMe } from "@/application/queries/social/useSocial";
import { BottomSheet } from "@/presentation/components/BottomSheet";
import { SocialAvatar } from "@/presentation/features/social/SocialAvatar";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { relativeTime } from "@/shared/format";
import { CommentRow } from "./CommentRow";
import { PostCaption } from "./PostCaption";

export interface CommentsSheetProps {
  post: PostWire | null;
  onClose: () => void;
}

export function CommentsSheet({ post, onClose }: CommentsSheetProps) {
  const p = useThemedPalette();
  const me = useSocialMe();
  const postId = post?.id ?? null;

  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<CommentWire | null>(null);
  const [expandedParent, setExpandedParent] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const thread = useComments(postId);
  const extra = useReplies(expandedParent);
  const add = useAddComment();
  const remove = useDeleteComment();
  const like = useLikeComment(postId ?? "");

  const comments = thread.data?.pages.flatMap((page) => page.items) ?? [];
  const total = thread.data?.pages[0]?.total ?? post?.comment_count ?? 0;

  const close = useCallback(() => {
    setDraft("");
    setReplyTo(null);
    setExpandedParent(null);
    onClose();
  }, [onClose]);

  const submit = () => {
    const body = draft.trim();
    if (!body || !postId || add.isPending) return;
    Haptics.selectionAsync().catch(() => {});
    add.mutate(
      { postId, body, parentId: replyTo?.id ?? null },
      {
        onSuccess: () => {
          setDraft("");
          setReplyTo(null);
        },
      },
    );
  };

  const startReply = (comment: CommentWire) => {
    setReplyTo(comment);
    // Seed the mention the way every threaded app does — the reply reads as
    // addressed to someone, and the backend indexes it as a real mention.
    setDraft((current) =>
      current.startsWith(`@${comment.author.username} `)
        ? current
        : `@${comment.author.username} `,
    );
    inputRef.current?.focus();
  };

  return (
    <BottomSheet
      visible={!!post}
      onClose={close}
      title="Comments"
      subtitle={total > 0 ? `${total} ${total === 1 ? "comment" : "comments"}` : null}
      overlay
      minHeight="72%"
      maxHeight="92%"
      flush
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.fill}
      >
        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            post?.body ? (
              <View
                style={[styles.caption, { borderBottomColor: p.line.default }]}
              >
                <SocialAvatar
                  handle={post.author.username}
                  name={post.author.display_name}
                  url={post.author.avatar_url}
                  size={32}
                  isPro={post.author.is_pro}
                />
                <View style={styles.captionBody}>
                  <PostCaption
                    body={post.body}
                    hashtags={post.hashtags}
                    mentions={post.mentions}
                    prefix={post.author.username}
                  />
                  <Text style={[styles.when, { color: p.ink.dim }]}>
                    {relativeTime(post.created_at)}
                  </Text>
                </View>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <CommentRow
              comment={item}
              onToggleLike={like.mutate}
              onReply={startReply}
              onDelete={
                postId
                  ? (comment) =>
                      remove.mutate({ commentId: comment.id, postId })
                  : undefined
              }
              onExpandReplies={(comment) => setExpandedParent(comment.id)}
              extraReplies={
                expandedParent === item.id ? extra.data?.items : undefined
              }
            />
          )}
          ListEmptyComponent={
            thread.isLoading ? (
              <View style={styles.state}>
                <ActivityIndicator color={p.ink.dim} />
              </View>
            ) : (
              <View style={styles.state}>
                <Text style={[styles.emptyTitle, { color: p.ink.default }]}>
                  No comments yet
                </Text>
                <Text style={[styles.emptyBody, { color: p.ink.dim }]}>
                  Be the first to say something.
                </Text>
              </View>
            )
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (thread.hasNextPage && !thread.isFetchingNextPage) {
              void thread.fetchNextPage();
            }
          }}
          ListFooterComponent={
            thread.isFetchingNextPage ? (
              <View style={styles.state}>
                <ActivityIndicator color={p.ink.dim} />
              </View>
            ) : null
          }
        />

        {replyTo ? (
          <View
            style={[
              styles.replyBar,
              { backgroundColor: p.bg.sunken, borderTopColor: p.line.default },
            ]}
          >
            <Text style={[styles.replyText, { color: p.ink.dim }]}>
              Replying to @{replyTo.author.username}
            </Text>
            <Pressable
              onPress={() => {
                setReplyTo(null);
                setDraft("");
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Cancel reply"
            >
              <X size={14} color={p.ink.dim} strokeWidth={2.4} />
            </Pressable>
          </View>
        ) : null}

        <View style={[styles.composer, { borderTopColor: p.line.default }]}>
          {me.data?.profile ? (
            <SocialAvatar
              handle={me.data.profile.username}
              url={me.data.profile.avatar_url}
              size={32}
            />
          ) : null}
          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={setDraft}
            placeholder="Add a comment…"
            placeholderTextColor={p.ink.dim}
            multiline
            style={[
              styles.input,
              {
                color: p.ink.default,
                backgroundColor: p.bg.elevated,
                borderColor: p.line.default,
              },
            ]}
            accessibilityLabel="Write a comment"
          />
          <Pressable
            onPress={submit}
            disabled={!draft.trim() || add.isPending}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Post comment"
            style={[
              styles.send,
              {
                backgroundColor: draft.trim()
                  ? p.accent.mint
                  : withAlpha(p.ink.default, 0.1),
              },
            ]}
          >
            {add.isPending ? (
              <ActivityIndicator size="small" color="#06140d" />
            ) : (
              <SendHorizonal
                size={16}
                color={draft.trim() ? "#06140d" : p.ink.dim}
                strokeWidth={2.4}
              />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  list: { paddingHorizontal: 20, paddingBottom: 12 },
  caption: {
    flexDirection: "row",
    gap: 10,
    paddingBottom: 12,
    marginBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  captionBody: { flex: 1, gap: 4 },
  when: { fontSize: 11.5 },
  state: { paddingVertical: 28, alignItems: "center", gap: 4 },
  emptyTitle: { fontSize: 15, fontWeight: "700" },
  emptyBody: { fontSize: 13 },
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  replyText: { fontSize: 12.5, fontWeight: "600" },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14.5,
  },
  send: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
});
