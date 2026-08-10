/**
 * Record and post a story — or fork the capture into a feed post.
 *
 * Two steps in one screen: shoot, then confirm. Splitting them across
 * routes would put a back-navigation between capture and post, and the
 * back gesture would throw away the thing just recorded.
 *
 * The review step is where the caption goes, and it plays the video —
 * seeing the clip before posting it is the entire reason a review step
 * exists. Retake replaces the capture in place rather than navigating.
 *
 * The Instagram fork lives here too: "Your story" publishes a 24-hour
 * story; "Post" carries the exact same capture (and whatever caption was
 * typed) into the feed composer instead. `replace`, not `push` — back
 * from the composer must not land on a review screen for media that has
 * already moved on.
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useIsFocused } from "@react-navigation/native";
import { ImagePlus, RotateCcw, Send, ShieldAlert } from "lucide-react-native";
import { usePostStory } from "@/application/queries/social/useStories";
import { routes } from "@/shared/routes";
import { Video } from "@/presentation/features/social/Video";
import {
  StoryCamera,
  type Capture,
} from "@/presentation/features/social/stories/StoryCamera";
import { useIslandHiddenWhile } from "@/presentation/navigation/islandNavStore";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

const MAX_CAPTION = 280;

export default function StoryComposerScreen() {
  const [capture, setCapture] = useState<Capture | null>(null);
  // The island navbar floats over the shutter otherwise. Capture AND
  // review: the review step is full-bleed media too, and the bar popping
  // back between the two steps would read as the UI flickering.
  useIslandHiddenWhile(useIsFocused(), "story-composer");

  if (!capture) {
    return (
      <StoryCamera onCaptured={setCapture} onCancel={() => router.back()} />
    );
  }
  return (
    <Review
      capture={capture}
      onRetake={() => setCapture(null)}
      onDone={() => router.back()}
    />
  );
}

function Review({
  capture,
  onRetake,
  onDone,
}: {
  capture: Capture;
  onRetake: () => void;
  onDone: () => void;
}) {
  const p = useThemedPalette();
  const post = usePostStory();
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);

  const publish = () => {
    setError(null);
    Haptics.selectionAsync().catch(() => {});
    post.mutate(
      {
        uri: capture.uri,
        kind: capture.kind,
        caption,
        durationMs: capture.durationMs,
      },
      {
        onSuccess: onDone,
        // A refusal from moderation lands here. Shown in place, with the
        // capture still on screen — retake is the answer, and losing the
        // shot to an alert would make that impossible.
        onError: (err) => setError(err.message),
      },
    );
  };

  // The other branch of the fork: same capture, the FEED instead of the
  // 24-hour tray. The typed caption rides along — retyping it because you
  // changed which surface it goes to would be pure punishment.
  const toPost = () => {
    Haptics.selectionAsync().catch(() => {});
    router.replace({
      pathname: routes.communityCompose(),
      params: {
        mediaUri: capture.uri,
        mediaKind: capture.kind,
        prefill: caption,
      },
    });
  };

  return (
    <View style={styles.root}>
      {capture.kind === "video" ? (
        // Loops, unlike the viewer: this is a check of what you just shot,
        // and re-tapping play to see it again is friction at exactly the
        // wrong moment.
        <Video uri={capture.uri} loop muted={false} contentFit="contain" />
      ) : (
        <Image
          source={{ uri: capture.uri }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
        />
      )}

      <SafeAreaView style={styles.chrome} pointerEvents="box-none">
        <View style={styles.top}>
          <Pressable
            onPress={onRetake}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Retake"
            style={styles.chip}
          >
            <RotateCcw size={19} color="#fff" strokeWidth={2.2} />
            <Text style={styles.chipText}>Retake</Text>
          </Pressable>
        </View>

        <View style={styles.spacer} pointerEvents="none" />

        {error ? (
          <View
            style={[styles.error, { backgroundColor: withAlpha(p.accent.rose, 0.92) }]}
          >
            <ShieldAlert size={16} color="#fff" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.bottom}>
          <TextInput
            value={caption}
            onChangeText={(t) => {
              setCaption(t.slice(0, MAX_CAPTION));
              if (error) setError(null);
            }}
            placeholder="Say something…"
            placeholderTextColor="rgba(255,255,255,0.6)"
            multiline
            style={styles.caption}
            accessibilityLabel="Caption"
          />
        </View>

        {/* The Instagram fork: the capture can become a 24-hour story or a
            feed post. Story keeps the filled treatment — it's this screen's
            namesake — and Post is the equal-weight alternative beside it. */}
        <View style={styles.destinations}>
          <Pressable
            onPress={publish}
            disabled={post.isPending}
            accessibilityRole="button"
            accessibilityLabel="Share to your story"
            style={[styles.share, { backgroundColor: p.accent.mint }]}
          >
            {post.isPending ? (
              <ActivityIndicator size="small" color="#06140d" />
            ) : (
              <>
                <Text style={styles.shareText}>Your story</Text>
                <Send size={16} color="#06140d" strokeWidth={2.6} />
              </>
            )}
          </Pressable>
          <Pressable
            onPress={toPost}
            disabled={post.isPending}
            accessibilityRole="button"
            accessibilityLabel="Create a post with this instead"
            style={styles.postDest}
          >
            <ImagePlus size={16} color="#fff" strokeWidth={2.4} />
            <Text style={styles.postDestText}>Post</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  chrome: { ...StyleSheet.absoluteFillObject },
  top: { flexDirection: "row", paddingHorizontal: 14, paddingTop: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  chipText: { color: "#fff", fontSize: 13.5, fontWeight: "700" },
  spacer: { flex: 1 },
  error: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    borderRadius: 14,
  },
  errorText: { flex: 1, color: "#fff", fontSize: 13, fontWeight: "700", lineHeight: 18 },
  bottom: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  destinations: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  postDest: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  postDestText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  caption: {
    flex: 1,
    maxHeight: 110,
    minHeight: 46,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: "#fff",
    borderRadius: 23,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  share: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 999,
    justifyContent: "center",
  },
  shareText: { color: "#06140d", fontSize: 15, fontWeight: "800" },
});
