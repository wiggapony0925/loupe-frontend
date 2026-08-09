/**
 * Record and post a story.
 *
 * Two steps in one screen: shoot, then confirm. Splitting them across
 * routes would put a back-navigation between capture and post, and the
 * back gesture would throw away the thing just recorded.
 *
 * The review step is where the caption goes, and it plays the video —
 * seeing the clip before posting it is the entire reason a review step
 * exists. Retake replaces the capture in place rather than navigating.
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
import { RotateCcw, Send, ShieldAlert } from "lucide-react-native";
import { usePostStory } from "@/application/queries/social/useStories";
import { Video } from "@/presentation/features/social/Video";
import {
  StoryCamera,
  type Capture,
} from "@/presentation/features/social/stories/StoryCamera";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

const MAX_CAPTION = 280;

export default function StoryComposerScreen() {
  const [capture, setCapture] = useState<Capture | null>(null);

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
            accessibilityLabel="Story caption"
          />
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
                <Text style={styles.shareText}>Share</Text>
                <Send size={16} color="#06140d" strokeWidth={2.6} />
              </>
            )}
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
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 999,
    minWidth: 104,
    justifyContent: "center",
  },
  shareText: { color: "#06140d", fontSize: 15, fontWeight: "800" },
});
