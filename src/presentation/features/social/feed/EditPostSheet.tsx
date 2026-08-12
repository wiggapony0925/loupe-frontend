/**
 * EditPostSheet — rewrite a caption.
 *
 * The caption ONLY. Photos are immutable once published, which is
 * Instagram's rule and the right one: swapping the image under a post
 * people have already liked changes what they endorsed. Editing words is a
 * correction; editing the picture is a bait-and-switch.
 *
 * Same `CaptionInput` as the composer, so tags tint live and the
 * suggestion row behaves identically — an editor that felt different from
 * the composer would be a second thing to learn for the same job.
 *
 * The server re-screens the new text, so a rewrite can be refused. The
 * refusal renders in place rather than as an alert: the words that caused
 * it are still on screen and still editable, which is the whole point.
 */
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { ShieldAlert } from "lucide-react-native";
import type { PostWire } from "@/infrastructure/http/wire/social";
import { useEditPost } from "@/application/queries/social/useFeed";
import { BottomSheet } from "@/presentation/components/BottomSheet";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { CaptionInput } from "./CaptionInput";
import { DraftTags } from "./DraftTags";

const MAX_BODY = 2200;
/** The suggestion row's escape distance to the screen edges: the
 *  BottomSheet shell's own padding (spacing.xl — the sheet is rendered
 *  without `flush`) PLUS this body's padding below. Counting only the
 *  body's 20 left the row clipping mid-air 24pt inside the screen. */
const SHELL_PADDING = 24;
const BODY_PADDING = 20;
const EDGE_INSET = SHELL_PADDING + BODY_PADDING;

export function EditPostSheet({
  post,
  onClose,
}: {
  post: PostWire | null;
  onClose: () => void;
}) {
  const p = useThemedPalette();
  const edit = useEditPost();
  const [body, setBody] = useState("");
  const [refusal, setRefusal] = useState<string | null>(null);

  // Reseed whenever a DIFFERENT post opens. Keyed on the id rather than on
  // the object so a cache patch (someone likes it while the sheet is open)
  // doesn't wipe out what's being typed.
  useEffect(() => {
    if (post) {
      setBody(post.body ?? "");
      setRefusal(null);
    }
  }, [post?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = post ? body.trim() !== (post.body ?? "").trim() : false;
  const canSave = dirty && !edit.isPending;

  const save = () => {
    if (!post || !canSave) return;
    Haptics.selectionAsync().catch(() => {});
    edit.mutate(
      { postId: post.id, body: body.trim() },
      {
        onSuccess: onClose,
        onError: (error) => setRefusal(error.message),
      },
    );
  };

  return (
    <BottomSheet
      visible={!!post}
      onClose={onClose}
      title="Edit caption"
      subtitle="Photos can't be changed after posting."
      overlay
      minHeight="60%"
      maxHeight="92%"
      avoidKeyboard
      closeDisabled={edit.isPending}
    >
      <View style={styles.body}>
        <CaptionInput
          value={body}
          onChangeText={(next) => {
            setBody(next.slice(0, MAX_BODY));
            // Editing IS the answer to a refusal — clear it as they type.
            if (refusal) setRefusal(null);
          }}
          placeholder="Write a caption…"
          autoFocus
          maxLength={MAX_BODY}
          suggestionInsets={{ left: EDGE_INSET, right: EDGE_INSET }}
        >
          {/* Same pills the composer shows — right under the field, not
              pinned to the sheet bottom by the input's flex. */}
          <DraftTags body={body} />
        </CaptionInput>

        {refusal ? (
          <View
            style={[
              styles.refusal,
              { backgroundColor: withAlpha(p.accent.rose, 0.12) },
            ]}
          >
            <ShieldAlert size={15} color={p.accent.rose} />
            <Text style={[styles.refusalText, { color: p.accent.rose }]}>
              {refusal}
            </Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Text style={[styles.count, { color: p.ink.dim }]}>
            {MAX_BODY - body.length}
          </Text>
          <Pressable
            onPress={save}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityLabel="Save caption"
            style={[
              styles.save,
              {
                backgroundColor: canSave
                  ? p.accent.mint
                  : withAlpha(p.ink.default, 0.1),
              },
            ]}
          >
            {edit.isPending ? (
              <ActivityIndicator size="small" color="#06140d" />
            ) : (
              <Text
                style={[
                  styles.saveText,
                  { color: canSave ? "#06140d" : p.ink.dim },
                ]}
              >
                Save
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: BODY_PADDING, paddingTop: 4 },
  refusal: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  refusalText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: "600" },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
  },
  count: { fontSize: 12, fontWeight: "600" },
  save: {
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 10,
    minWidth: 84,
    alignItems: "center",
  },
  saveText: { fontSize: 14, fontWeight: "800", letterSpacing: 0.2 },
});
