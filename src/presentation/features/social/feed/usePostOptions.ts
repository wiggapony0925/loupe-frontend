/**
 * The ⋯ menu behind every post, in one place.
 *
 * Two surfaces show a post — the feed list and the permalink page — and
 * they had drifted badly. The feed opened a menu; the permalink page wired
 * ⋯ straight to `delete`, so on your own post a single tap on a button
 * labelled "Post options" destroyed it, with no menu and no confirmation.
 *
 * What the menu offers is decided by the SERVER, via `can_edit` /
 * `can_delete` on the post. That matters for the staff case: a moderator
 * can remove a post but must not rewrite one under someone else's byline,
 * and re-deriving that rule per client is how one of them gets it wrong.
 *
 * The app's standing rule is "tap = do it, no confirm popups". Delete is
 * the documented exception — it is irreversible and it takes other
 * people's replies with it — and this action sheet IS that confirmation,
 * which is why the destructive item never fires straight from the ⋯ tap.
 */
import { useCallback } from "react";
import { Alert } from "react-native";
import type { PostWire } from "@/infrastructure/http/wire/social";

export interface PostOptionsHandlers {
  onEdit: (post: PostWire) => void;
  onReport: (post: PostWire) => void;
  onDelete: (post: PostWire) => void;
}

export function usePostOptions({
  onEdit,
  onReport,
  onDelete,
}: PostOptionsHandlers): (post: PostWire) => void {
  return useCallback(
    (post: PostWire) => {
      const options: {
        text: string;
        style?: "cancel" | "destructive";
        onPress?: () => void;
      }[] = [];

      if (post.can_edit) {
        options.push({ text: "Edit caption", onPress: () => onEdit(post) });
      }
      // Reporting your own post is noise in the moderation queue.
      if (post.author.relationship !== "self") {
        options.push({ text: "Report post", onPress: () => onReport(post) });
      }
      if (post.can_delete) {
        options.push({
          text: "Delete post",
          style: "destructive",
          onPress: () => onDelete(post),
        });
      }
      // Nothing to offer — don't flash an empty sheet.
      if (options.length === 0) return;

      options.push({ text: "Cancel", style: "cancel" });
      Alert.alert("Post options", undefined, options);
    },
    [onEdit, onReport, onDelete],
  );
}
