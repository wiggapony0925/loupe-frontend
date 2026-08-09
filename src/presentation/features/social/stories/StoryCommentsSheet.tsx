/**
 * Comments on a story.
 *
 * Deliberately comments, not DMs. Instagram routes story replies into the
 * message inbox; this app has no inbox, and building one to carry them
 * would drag in threads, read receipts and blocking semantics — a much
 * larger feature wearing a small one's clothes. So a story comment is
 * public to everyone who can see the story, exactly like a post comment,
 * and moderated through the same chokepoint.
 *
 * Reuses the shared `BottomSheet` with `avoidKeyboard`, so the input rides
 * above the keyboard here for the same reason it does under a post.
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { SendHorizonal, Trash2 } from "lucide-react-native";
import type { StoryWire } from "@/infrastructure/http/wire/social";
import {
  useCommentOnStory,
  useDeleteStoryComment,
  useStoryComments,
} from "@/application/queries/social/useStories";
import { useSocialMe } from "@/application/queries/social/useSocial";
import { BottomSheet } from "@/presentation/components/BottomSheet";
import { SocialAvatar } from "@/presentation/features/social/SocialAvatar";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { relativeTime } from "@/shared/format";

export function StoryCommentsSheet({
  story,
  onClose,
}: {
  story: StoryWire | null;
  onClose: () => void;
}) {
  const p = useThemedPalette();
  const me = useSocialMe();
  const thread = useStoryComments(story?.id ?? null);
  const add = useCommentOnStory();
  const remove = useDeleteStoryComment();
  const [draft, setDraft] = useState("");

  const rows = thread.data ?? [];

  const submit = () => {
    const body = draft.trim();
    if (!body || !story || add.isPending) return;
    Haptics.selectionAsync().catch(() => {});
    add.mutate(
      { storyId: story.id, body },
      { onSuccess: () => setDraft("") },
    );
  };

  return (
    <BottomSheet
      visible={Boolean(story)}
      onClose={onClose}
      title="Comments"
      subtitle={
        rows.length > 0
          ? `${rows.length} ${rows.length === 1 ? "comment" : "comments"}`
          : "Be the first to say something"
      }
      overlay
      minHeight="62%"
      maxHeight="92%"
      flush
      avoidKeyboard
    >
      <View style={styles.fill}>
        {thread.isLoading ? (
          <ActivityIndicator color={p.ink.dim} style={styles.loading} />
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={[styles.empty, { color: p.ink.dim }]}>
                No comments yet. They disappear when the story does.
              </Text>
            }
            renderItem={({ item }) => (
              <View style={styles.row}>
                <SocialAvatar
                  handle={item.author.username}
                  name={item.author.display_name}
                  url={item.author.avatar_url}
                  size={32}
                  isPro={item.author.is_pro}
                />
                <View style={styles.rowBody}>
                  <Text style={[styles.rowText, { color: p.ink.default }]}>
                    <Text style={styles.rowHandle}>{item.author.username} </Text>
                    {item.body}
                  </Text>
                  <Text style={[styles.rowWhen, { color: p.ink.dim }]}>
                    {relativeTime(item.created_at)}
                  </Text>
                </View>
                {item.can_delete && story ? (
                  <Pressable
                    onPress={() =>
                      remove.mutate({ commentId: item.id, storyId: story.id })
                    }
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Delete this comment"
                  >
                    <Trash2 size={15} color={p.ink.dim} />
                  </Pressable>
                ) : null}
              </View>
            )}
          />
        )}

        <View style={[styles.composer, { borderTopColor: p.line.default }]}>
          {me.data?.profile ? (
            <SocialAvatar
              handle={me.data.profile.username}
              url={me.data.profile.avatar_url}
              size={32}
            />
          ) : null}
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Add a comment…"
            placeholderTextColor={p.ink.dim}
            multiline
            maxLength={500}
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
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  loading: { paddingVertical: 40 },
  list: { paddingHorizontal: 20, paddingBottom: 12, gap: 16 },
  empty: { fontSize: 13.5, textAlign: "center", paddingVertical: 34 },
  row: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  rowBody: { flex: 1, gap: 3 },
  rowText: { fontSize: 14, lineHeight: 19 },
  rowHandle: { fontWeight: "800" },
  rowWhen: { fontSize: 11.5, fontWeight: "600" },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 9,
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    maxHeight: 96,
    minHeight: 38,
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 9,
    fontSize: 14.5,
    borderWidth: 1,
    borderRadius: 20,
  },
  send: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
  },
});
