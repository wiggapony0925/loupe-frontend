/**
 * PostMedia — a post's photos, edge to edge, with the two gestures every
 * feed reader already has in their fingers.
 *
 * **Double-tap likes**, with a heart that punches in and fades — the
 * feedback IS the affordance, since nothing on screen advertises the
 * gesture. It only ever LIKES: double-tapping something you already liked
 * replays the heart and leaves it liked, because the gesture is an
 * expression of approval, not a toggle, and silently un-liking someone's
 * post because they tapped twice would be the worst kind of surprise.
 *
 * **Single tap opens it full screen** — the reason someone taps a card
 * photo is to look at a corner or an edge, and the feed's width can't
 * answer that. On a VIDEO slide the tap is the mute toggle instead (clips
 * autoplay muted in place — see `VideoSlide`), and the expand button in
 * the corner is what goes full screen.
 *
 * Two other decisions worth naming:
 *
 * **The frame is sized before the bytes arrive.** The server ships each
 * image's intrinsic width/height, so the container's height is known at
 * first render. Without it every image in a scrolling feed resizes its own
 * row as it decodes and shoves everything below it down.
 *
 * **Aspect is clamped, not obeyed.** A 9:21 screenshot would otherwise take
 * three screens on its own. Portrait is capped at 4:5 and landscape at
 * 1.91:1 — Instagram's bounds — cropped to fill.
 */
import React, { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { Heart, Maximize2, Play, Volume2, VolumeX } from "lucide-react-native";
import { Gesture, GestureDetector, ScrollView } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { PostMediaWire } from "@/infrastructure/http";
import { absolutize } from "@/presentation/features/social/SocialAvatar";
import { Video } from "@/presentation/features/social/Video";
import { useThemedPalette } from "@/presentation/theme/tokens";

/** Instagram's crop bounds: tallest 4:5, widest 1.91:1. */
const MIN_RATIO = 4 / 5;
const MAX_RATIO = 1.91;

export function mediaAspectRatio(media: PostMediaWire[]): number {
  const first = media[0];
  if (!first?.width || !first?.height) return 1;
  const ratio = first.width / first.height;
  if (!Number.isFinite(ratio) || ratio <= 0) return 1;
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio));
}

export interface PostMediaProps {
  media: PostMediaWire[];
  /** Total horizontal padding of the surrounding surface, so the carousel
   *  can bleed back out to the full screen width. */
  bleed?: number;
  /** Single tap on a PHOTO — opens the full-screen viewer at this slide.
   *  (Videos route the tap to the mute toggle; the expand button opens
   *  the viewer instead.) */
  onPress?: (index: number) => void;
  /** Double tap. Only ever likes; never un-likes. */
  onDoubleTapLike?: () => void;
  /** Is this post on screen? Drives video autoplay: the feed's viewability
   *  tracker flips it, so only visible clips decode and play. Defaults to
   *  true for single-post surfaces (the permalink page has no scroller
   *  deciding visibility — its one video should just play). */
  visible?: boolean;
}

export function PostMedia({
  media,
  bleed = 0,
  onPress,
  onDoubleTapLike,
  visible = true,
}: PostMediaProps) {
  const p = useThemedPalette();
  const { width: screenWidth } = useWindowDimensions();
  const [page, setPage] = useState(0);
  // One mute for the whole post, feed-default muted — a carousel where
  // slide 2 remembered sound-on while slide 1 was muted would be chaos.
  const [muted, setMuted] = useState(true);

  // The burst heart.
  //
  // Scale and opacity are driven SEPARATELY. Sharing one value meant the
  // heart could only fade by shrinking, so it collapsed away instead of
  // holding its size and dissolving — and the hold had to be long enough
  // to read, which is what made it linger.
  const burstScale = useSharedValue(0.4);
  const burstOpacity = useSharedValue(0);
  const burstStyle = useAnimatedStyle(() => ({
    opacity: burstOpacity.value,
    transform: [{ scale: burstScale.value }],
  }));

  const first = media[0];

  // Everything the gesture worklets need, behind stable refs: the gestures
  // are memoised ONCE (below), so they must never close over a state value
  // or an unstable prop — and un-memoised gestures were re-attaching native
  // handlers on every `setPage` scroll tick, per RNGH's own warning.
  const pageRef = useRef(0);
  const mediaRef = useRef(media);
  mediaRef.current = media;
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;
  const onDoubleTapLikeRef = useRef(onDoubleTapLike);
  onDoubleTapLikeRef.current = onDoubleTapLike;

  const gesture = useMemo(() => {
    const celebrate = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      onDoubleTapLikeRef.current?.();
    };
    // Kind-aware single tap: a photo opens the viewer; a video toggles its
    // sound. Routing a video tap into the viewer was why clips could only
    // be watched full screen — the tap gesture won the race and cancelled
    // the player's own press handling every time.
    const tapSlide = () => {
      const current = mediaRef.current[pageRef.current];
      if (current?.kind === "video") {
        setMuted((m) => !m);
        return;
      }
      onPressRef.current?.(pageRef.current);
    };

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDuration(260)
      .onEnd(() => {
        // Instagram's curve and, more importantly, its LENGTH: ~310ms end to
        // end. Punch in with a little overshoot, hold just long enough to
        // register, then go.
        //
        // The first version ran ~700ms. Past roughly half a second a
        // confirmation stops reading as feedback and starts reading as an
        // obstruction sitting on the photo you were trying to look at — you
        // notice yourself waiting for it, which is the opposite of the point.
        burstScale.value = 0.4;
        burstOpacity.value = 1;
        burstScale.value = withSequence(
          withSpring(1.08, { damping: 9, stiffness: 520, mass: 0.45 }),
          withTiming(0.98, { duration: 70 }),
          withTiming(1.18, { duration: 140 }),
        );
        burstOpacity.value = withSequence(
          withTiming(1, { duration: 70 }),
          withTiming(1, { duration: 100 }),
          withTiming(0, { duration: 140 }),
        );
        runOnJS(celebrate)();
      });

    // Exclusive(a, b) already makes b wait for a to fail — the explicit
    // requireExternalGestureToFail it used to carry just registered the
    // same relation twice.
    const singleTap = Gesture.Tap()
      .numberOfTaps(1)
      .onEnd(() => {
        runOnJS(tapSlide)();
      });

    return Gesture.Exclusive(doubleTap, singleTap);
    // Shared values are stable for the component's lifetime.
  }, [burstScale, burstOpacity]);

  if (!first) return null;

  const width = screenWidth;
  const height = Math.round(width / mediaAspectRatio(media));

  const frame = {
    width,
    height,
    marginHorizontal: -bleed / 2,
    backgroundColor: p.bg.sunken,
  };

  const overlay = (
    <Animated.View style={[styles.burst, burstStyle]} pointerEvents="none">
      {/* Red, matching the heart in the action row underneath — the two
          are the same state, and a white burst that resolves into a red
          button reads as two different things happening. */}
      <Heart
        size={92}
        color={p.accent.rose}
        fill={p.accent.rose}
        strokeWidth={1.5}
      />
    </Animated.View>
  );

  // The expand control lives OUTSIDE the GestureDetector subtree: the
  // detector's tap gesture cancels any Pressable underneath it, so a
  // button inside would never fire. As a sibling its touches never reach
  // the media gestures at all.
  const expand =
    onPress != null ? (
      <Pressable
        onPress={() => onPress(pageRef.current)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Watch full screen"
        style={styles.expand}
      >
        <Maximize2 size={14} color="#fff" strokeWidth={2.5} />
      </Pressable>
    ) : null;

  if (media.length === 1) {
    return (
      <View style={frame}>
        <GestureDetector gesture={gesture}>
          <View style={{ width, height }}>
            <Slide
              item={first}
              width={width}
              height={height}
              active={visible}
              muted={muted}
            />
            {overlay}
          </View>
        </GestureDetector>
        {first.kind === "video" ? expand : null}
      </View>
    );
  }

  return (
    <View style={frame}>
      <GestureDetector gesture={gesture}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={(e) => {
            const next = Math.round(e.nativeEvent.contentOffset.x / width);
            pageRef.current = next;
            if (next !== page) setPage(next);
          }}
          scrollEventThrottle={16}
        >
          {media.map((item, index) => (
            <Slide
              key={item.id}
              item={item}
              width={width}
              height={height}
              // Only the page under your thumb plays — its neighbours in
              // the carousel are loaded but paused.
              active={visible && index === page}
              muted={muted}
            />
          ))}
        </ScrollView>
      </GestureDetector>
      {overlay}
      {/* Dots, not a counter: at four slides the position is easier to read
          as a shape than as "2/4". */}
      <View style={styles.dots} pointerEvents="none">
        {media.map((item, index) => (
          <View
            key={item.id}
            style={[
              styles.dot,
              {
                backgroundColor: index === page ? "#fff" : "rgba(255,255,255,0.45)",
                width: index === page ? 7 : 5,
                height: index === page ? 7 : 5,
              },
            ]}
          />
        ))}
      </View>
      {media[page]?.kind === "video" ? expand : null}
    </View>
  );
}

function Slide({
  item,
  width,
  height,
  active,
  muted,
}: {
  item: PostMediaWire;
  width: number;
  height: number;
  active: boolean;
  muted: boolean;
}) {
  if (item.kind === "video") {
    return (
      <VideoSlide
        item={item}
        width={width}
        height={height}
        active={active}
        muted={muted}
      />
    );
  }
  return (
    <Image
      source={{ uri: absolutize(item.url) ?? undefined }}
      style={{ width, height }}
      contentFit="cover"
      transition={140}
      accessibilityIgnoresInvertColors
    />
  );
}

/**
 * A video slide.
 *
 * **Autoplays muted, looping, in place** — the feed convention. Playback is
 * driven entirely by `active` (the feed's viewability tracker + carousel
 * page), so a clip starts the moment it scrolls into view and stops the
 * moment it leaves — never four clips decoding at once off screen, and
 * never a feed that makes noise unasked. Taps are handled by the PARENT
 * media gesture (tap = mute toggle, double tap = like); this component
 * only renders.
 *
 * Its own component so the player is only created for slides that actually
 * are video — hoisting it into `Slide` would spin one up for every photo
 * in the feed.
 */
function VideoSlide({
  item,
  width,
  height,
  active,
  muted,
}: {
  item: PostMediaWire;
  width: number;
  height: number;
  active: boolean;
  muted: boolean;
}) {
  const uri = absolutize(item.url);

  // No URL, no player. `useVideoPlayer("")` spins up a native player on a
  // nonsense source — render the empty frame instead.
  if (!uri) {
    return <View style={{ width, height }} />;
  }

  return (
    <View style={{ width, height }}>
      <Video
        uri={uri}
        style={{ width, height }}
        loop
        muted={muted}
        paused={!active}
        contentFit="cover"
      />
      {!active ? (
        // Paused = mostly scrolled away (or a carousel neighbour). The
        // badge marks the frame as a clip, not a broken photo.
        <View style={styles.playOverlay} pointerEvents="none">
          <View style={styles.playBadge}>
            <Play size={26} color="#fff" fill="#fff" />
          </View>
        </View>
      ) : (
        <View style={styles.muteBadge} pointerEvents="none">
          {muted ? (
            <VolumeX size={14} color="#fff" />
          ) : (
            <Volume2 size={14} color="#fff" />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  playBadge: {
    width: 62,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 31,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  muteBadge: {
    position: "absolute",
    right: 12,
    bottom: 12,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  expand: {
    position: "absolute",
    right: 10,
    top: 10,
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  burst: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    // The white heart needs to survive a white card border underneath it.
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  dots: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
  },
  dot: { borderRadius: 999 },
});
