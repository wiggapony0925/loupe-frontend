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
 * answer that.
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
import React, { useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { Heart } from "lucide-react-native";
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
  /** Single tap — opens the full-screen viewer at this slide. */
  onPress?: (index: number) => void;
  /** Double tap. Only ever likes; never un-likes. */
  onDoubleTapLike?: () => void;
}

export function PostMedia({
  media,
  bleed = 0,
  onPress,
  onDoubleTapLike,
}: PostMediaProps) {
  const p = useThemedPalette();
  const { width: screenWidth } = useWindowDimensions();
  const [page, setPage] = useState(0);

  // The burst heart. Scale and opacity are driven together so it punches
  // in, holds for a beat, then leaves.
  const burst = useSharedValue(0);
  const burstStyle = useAnimatedStyle(() => ({
    opacity: burst.value,
    transform: [{ scale: 0.6 + burst.value * 0.6 }],
  }));

  const first = media[0];
  if (!first) return null;

  const width = screenWidth;
  const height = Math.round(width / mediaAspectRatio(media));

  const celebrate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onDoubleTapLike?.();
  };

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(260)
    .onEnd(() => {
      burst.value = withSequence(
        withSpring(1, { damping: 12, stiffness: 320 }),
        withTiming(1, { duration: 320 }),
        withTiming(0, { duration: 220 }),
      );
      runOnJS(celebrate)();
    });

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    // Must wait for the double-tap to fail, or every like also opens the
    // viewer — the bug that makes a double-tap feel like it "did two things".
    .requireExternalGestureToFail(doubleTap)
    .onEnd(() => {
      if (onPress) runOnJS(onPress)(page);
    });

  const gesture = Gesture.Exclusive(doubleTap, singleTap);

  const frame = {
    width,
    height,
    marginHorizontal: -bleed / 2,
    backgroundColor: p.bg.sunken,
  };

  const overlay = (
    <Animated.View style={[styles.burst, burstStyle]} pointerEvents="none">
      <Heart size={96} color="#fff" fill="#fff" strokeWidth={1.5} />
    </Animated.View>
  );

  if (media.length === 1) {
    return (
      <GestureDetector gesture={gesture}>
        <View style={frame}>
          <Slide item={first} width={width} height={height} />
          {overlay}
        </View>
      </GestureDetector>
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
            if (next !== page) setPage(next);
          }}
          scrollEventThrottle={16}
        >
          {media.map((item) => (
            <Slide key={item.id} item={item} width={width} height={height} />
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
    </View>
  );
}

function Slide({
  item,
  width,
  height,
}: {
  item: PostMediaWire;
  width: number;
  height: number;
}) {
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

const styles = StyleSheet.create({
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
