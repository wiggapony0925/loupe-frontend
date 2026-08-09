/**
 * StoryViewer — full screen, tap through, hold to pause.
 *
 * The rules that make a story viewer feel right, and the reasons they are
 * not obvious:
 *
 * * **A still runs on a timer, a video runs on the video.** Driving both
 *   from one fixed countdown either cuts clips off or leaves a finished
 *   video sitting on its last frame. The progress bar's duration comes
 *   from `duration_ms` when the server sent one.
 * * **Tap left/right, hold to pause.** The hold has to cancel the advance
 *   as well as the bar, or a story someone paused to read jumps forward
 *   the moment they let go.
 * * **Seen is marked on ARRIVAL, not on completion.** You saw it; skipping
 *   ahead doesn't un-see it, and marking on completion leaves a ring lit
 *   over something already watched.
 * * **The bar animates with the JS thread stopped.** `withTiming` on the
 *   UI thread keeps it smooth while images decode.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  type SharedValue,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { Eye, MessageCircle, Trash2, X } from "lucide-react-native";
import type { StoryWire } from "@/infrastructure/http/wire/social";
import {
  useDeleteStory,
  useMarkStorySeen,
  useStories,
} from "@/application/queries/social/useStories";
import { absolutize } from "@/presentation/features/social/SocialAvatar";
import { Video } from "@/presentation/features/social/Video";
import { SocialAvatar } from "@/presentation/features/social/SocialAvatar";
import { relativeTime } from "@/shared/format";
import { StoryCommentsSheet } from "./StoryCommentsSheet";
import { StoryViewersSheet } from "./StoryViewersSheet";

/** How long a photo stays up. Instagram's number. */
const STILL_MS = 5000;

export function StoryViewer({
  handle,
  onClose,
}: {
  handle: string | null;
  onClose: () => void;
}) {
  const stories = useStories(handle);
  const cards = stories.data ?? [];

  return (
    <Modal
      visible={Boolean(handle)}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {stories.isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : cards.length === 0 ? (
        <View style={styles.loading}>
          <Text style={styles.gone}>These stories have expired.</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
            <Text style={styles.goneCta}>Close</Text>
          </Pressable>
        </View>
      ) : (
        <Reel
          key={handle ?? ""}
          handle={handle!}
          cards={cards}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}

function Reel({
  handle,
  cards,
  onClose,
}: {
  handle: string;
  cards: StoryWire[];
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const markSeen = useMarkStorySeen();
  const remove = useDeleteStory();

  // Open on the first UNSEEN card. Restarting someone's reel from the top
  // when you've already watched four of five is the single most annoying
  // thing a story viewer can do.
  const firstUnseen = Math.max(
    0,
    cards.findIndex((s) => !s.seen),
  );
  const [index, setIndex] = useState(
    cards.some((s) => !s.seen) ? firstUnseen : 0,
  );
  const [paused, setPaused] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);

  const story = cards[Math.min(index, cards.length - 1)];
  const isVideo = story?.kind === "video";
  const durationMs = isVideo ? (story.duration_ms ?? 8000) : STILL_MS;

  const progress = useSharedValue(0);

  const advance = useCallback(() => {
    setIndex((i) => {
      if (i + 1 < cards.length) return i + 1;
      onClose();
      return i;
    });
  }, [cards.length, onClose]);

  // A sheet over the top must not let the reel run on underneath it.
  const held = paused || commentsOpen || viewersOpen;

  // Restart the bar on every card, and drive it for exactly this card's
  // length. `runOnJS` hands the finish back to React to advance.
  useEffect(() => {
    if (!story) return;
    progress.value = 0;
    if (held) return;
    progress.value = withTiming(1, { duration: durationMs }, (done) => {
      if (done) runOnJS(advance)();
    });
    return () => cancelAnimation(progress);
  }, [story?.id, held, durationMs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Seen on arrival — you saw it.
  useEffect(() => {
    if (story && !story.seen) {
      markSeen.mutate({ storyId: story.id, handle });
    }
  }, [story?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!story) return null;

  const back = () => {
    Haptics.selectionAsync().catch(() => {});
    setIndex((i) => (i > 0 ? i - 1 : i));
  };
  const forward = () => {
    Haptics.selectionAsync().catch(() => {});
    advance();
  };

  return (
    <View style={[styles.root, { width, height }]}>
      {isVideo ? (
        <Video
          uri={absolutize(story.url) ?? ""}
          loop={false}
          muted={false}
          paused={held}
          contentFit="contain"
        />
      ) : (
        <Image
          source={{ uri: absolutize(story.url) ?? undefined }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          transition={120}
          accessibilityIgnoresInvertColors
        />
      )}

      {/* Tap zones. Full height and behind the chrome, so the header's
          buttons still win — a close button you can't hit because a tap
          zone is over it is the classic bug here. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={styles.zones}>
          <Pressable
            style={styles.zoneBack}
            onPress={back}
            onLongPress={() => setPaused(true)}
            onPressOut={() => setPaused(false)}
            delayLongPress={180}
            accessibilityRole="button"
            accessibilityLabel="Previous story"
          />
          <Pressable
            style={styles.zoneNext}
            onPress={forward}
            onLongPress={() => setPaused(true)}
            onPressOut={() => setPaused(false)}
            delayLongPress={180}
            accessibilityRole="button"
            accessibilityLabel="Next story"
          />
        </View>
      </View>

      <SafeAreaView style={styles.chrome} pointerEvents="box-none">
        <View style={styles.bars}>
          {cards.map((card, i) => (
            <Bar
              key={card.id}
              state={i < index ? "done" : i === index ? "active" : "todo"}
              progress={progress}
            />
          ))}
        </View>

        <View style={styles.head}>
          <SocialAvatar
            handle={story.author.username}
            name={story.author.display_name}
            url={story.author.avatar_url}
            size={32}
            isPro={story.author.is_pro}
          />
          <View style={styles.ident}>
            <Text style={styles.name} numberOfLines={1}>
              {story.author.username}
            </Text>
            <Text style={styles.when}>{relativeTime(story.created_at)}</Text>
          </View>
          {story.can_delete ? (
            <Pressable
              onPress={() =>
                remove.mutate(
                  { storyId: story.id },
                  { onSuccess: onClose },
                )
              }
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Delete this story"
              style={styles.headButton}
            >
              <Trash2 size={18} color="#fff" />
            </Pressable>
          ) : null}
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close stories"
            style={styles.headButton}
          >
            <X size={22} color="#fff" strokeWidth={2.3} />
          </Pressable>
        </View>

        <View style={styles.spacer} pointerEvents="none">
          {story.caption ? (
            <Text style={styles.caption}>{story.caption}</Text>
          ) : null}
        </View>

        <View style={styles.foot}>
          <Pressable
            onPress={() => setCommentsOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`${story.comment_count} comments`}
            style={styles.footButton}
          >
            <MessageCircle size={18} color="#fff" />
            <Text style={styles.footText}>
              {story.comment_count > 0
                ? `${story.comment_count} ${story.comment_count === 1 ? "comment" : "comments"}`
                : "Add a comment"}
            </Text>
          </Pressable>

          {/* Your own story only — nobody sees who watched someone else's,
              and the server refuses the request anyway. */}
          {story.view_count > 0 || story.author.relationship === "self" ? (
            <Pressable
              onPress={() => setViewersOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`${story.view_count} viewers`}
              style={styles.footViews}
            >
              <Eye size={17} color="#fff" />
              <Text style={styles.footText}>{story.view_count}</Text>
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>

      <StoryCommentsSheet
        story={commentsOpen ? story : null}
        onClose={() => setCommentsOpen(false)}
      />
      <StoryViewersSheet
        story={viewersOpen ? story : null}
        onClose={() => setViewersOpen(false)}
      />
    </View>
  );
}

/** One segment of the progress row. */
function Bar({
  state,
  progress,
}: {
  state: "done" | "active" | "todo";
  progress: SharedValue<number>;
}) {
  const fill = useAnimatedStyle(() => ({
    width: `${(state === "done" ? 1 : state === "active" ? progress.value : 0) * 100}%`,
  }));
  return (
    <View style={styles.bar}>
      <Animated.View style={[styles.barFill, fill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    backgroundColor: "#000",
  },
  gone: { color: "rgba(255,255,255,0.75)", fontSize: 15, fontWeight: "600" },
  goneCta: { color: "#fff", fontSize: 15, fontWeight: "800" },
  chrome: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-start" },
  bars: { flexDirection: "row", gap: 3, paddingHorizontal: 10, paddingTop: 8 },
  bar: {
    flex: 1,
    height: 2.5,
    borderRadius: 2,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  barFill: { height: "100%", backgroundColor: "#fff" },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  ident: { flex: 1, minWidth: 0 },
  name: { color: "#fff", fontSize: 14, fontWeight: "800" },
  when: { color: "rgba(255,255,255,0.7)", fontSize: 11.5, fontWeight: "600" },
  headButton: { padding: 4 },
  zones: { flex: 1, flexDirection: "row" },
  // A third / two thirds, not half and half: forward is the common action,
  // so it gets the bigger target.
  zoneBack: { flex: 1 },
  zoneNext: { flex: 2 },
  spacer: { flex: 1, justifyContent: "flex-end", paddingHorizontal: 18 },
  caption: {
    color: "#fff",
    fontSize: 15.5,
    fontWeight: "600",
    lineHeight: 21,
    paddingBottom: 12,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 6,
  },
  foot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  footButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  footViews: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  footText: { color: "#fff", fontSize: 13.5, fontWeight: "700" },
});
