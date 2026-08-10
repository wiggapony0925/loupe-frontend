/**
 * ImageLightbox — a post's media, full screen.
 *
 * Opened from feed media. Black backdrop, no chrome but a close button and
 * (for a carousel) dots: the picture is the point, and every pixel of UI on
 * top of it is a pixel of card art you can't see.
 *
 * Pinch to zoom and drag to pan, because the whole reason someone opens a
 * card photo full screen is to look at an edge, a corner or a surface
 * scratch. Swipe down to dismiss, which is the gesture every photo viewer
 * on the platform has trained people to expect.
 *
 * Video slides play here too — full screen is where the sound lives (the
 * feed autoplays muted), and only the CURRENT page plays so a carousel
 * can't talk over itself from off screen.
 */
import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { Gesture, GestureDetector, ScrollView } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { PostMediaWire } from "@/infrastructure/http";
import { absolutize } from "@/presentation/features/social/SocialAvatar";
import { Video } from "@/presentation/features/social/Video";

/** Past this, a downward drag dismisses instead of springing back. */
const DISMISS_DISTANCE = 130;
const MAX_SCALE = 4;

export function ImageLightbox({
  media,
  initialIndex = 0,
  onClose,
}: {
  media: PostMediaWire[] | null;
  initialIndex?: number;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  // The top inset via the HOOK, not <SafeAreaView>: the native safe-area
  // view can report ZERO inside a Modal (it measures its own window before
  // attachment), which parked the close button under the Dynamic Island —
  // unreachable, so the only way out of the viewer was force-quitting. The
  // hook reads the provider at the app root, whose inset is always the
  // real one; the floor keeps a sane tap target on inset-less devices.
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(initialIndex);

  const open = !!media && media.length > 0;

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <View
          style={[styles.bar, { paddingTop: Math.max(insets.top, 14) }]}
          pointerEvents="box-none"
        >
          <Pressable
            onPress={onClose}
            hitSlop={14}
            accessibilityRole="button"
            accessibilityLabel="Close photo"
            style={styles.close}
          >
            <X size={20} color="#fff" strokeWidth={2.4} />
          </Pressable>
          {open && media.length > 1 ? (
            <Text style={styles.counter}>
              {page + 1} / {media.length}
            </Text>
          ) : null}
        </View>

        {open ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: initialIndex * width, y: 0 }}
            onMomentumScrollEnd={(e) =>
              setPage(Math.round(e.nativeEvent.contentOffset.x / width))
            }
          >
            {media.map((item, index) => (
              <ZoomableSlide
                key={item.id}
                item={item}
                width={width}
                height={height}
                active={index === page}
                onDismiss={onClose}
              />
            ))}
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
}

function ZoomableSlide({
  item,
  width,
  height,
  active,
  onDismiss,
}: {
  item: PostMediaWire;
  width: number;
  height: number;
  /** Is this the carousel's current page? Off-page videos stay paused. */
  active: boolean;
  onDismiss: () => void;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(MAX_SCALE, Math.max(1, savedScale.value * e.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1.02) {
        // Snap back to fit and re-centre: a barely-zoomed image that stays
        // slightly off-centre reads as broken.
        scale.value = withSpring(1, { damping: 20 });
        savedScale.value = 1;
        x.value = withSpring(0);
        y.value = withSpring(0);
        savedX.value = 0;
        savedY.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        // Zoomed in: drag pans the image.
        x.value = savedX.value + e.translationX;
        y.value = savedY.value + e.translationY;
      } else if (e.translationY > 0) {
        // At fit: a downward drag is a dismissal in progress.
        y.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (scale.value > 1) {
        savedX.value = x.value;
        savedY.value = y.value;
        return;
      }
      if (e.translationY > DISMISS_DISTANCE || e.velocityY > 900) {
        y.value = withTiming(height, { duration: 180 }, (done) => {
          if (done) runOnJS(onDismiss)();
        });
      } else {
        y.value = withSpring(0, { damping: 20 });
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      // Toggle between fit and 2x, centred — the standard photo-viewer
      // shortcut for "let me see that corner".
      const next = scale.value > 1 ? 1 : 2;
      scale.value = withSpring(next, { damping: 20 });
      savedScale.value = next;
      if (next === 1) {
        x.value = withSpring(0);
        y.value = withSpring(0);
        savedX.value = 0;
        savedY.value = 0;
      }
    });

  const gesture = Gesture.Simultaneous(pinch, Gesture.Exclusive(doubleTap, pan));

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: scale.value },
    ],
    // Fading the backdrop with the drag makes the dismissal feel like the
    // photo is being put away rather than thrown off screen.
    opacity: scale.value > 1 ? 1 : Math.max(0.35, 1 - Math.abs(y.value) / 420),
  }));

  const uri = absolutize(item.url) ?? undefined;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ width, height }, styles.slide, style]}>
        {item.kind === "video" && uri ? (
          // Sound ON: expanding a clip is the "let me actually watch this"
          // gesture, and the feed underneath already covered muted. All the
          // photo gestures still apply — the player sits inside the same
          // animated frame.
          <Video
            uri={uri}
            style={{ width, height: height * 0.8 }}
            loop
            muted={false}
            paused={!active}
            contentFit="contain"
          />
        ) : (
          <Image
            source={{ uri }}
            style={{ width, height: height * 0.8 }}
            contentFit="contain"
            transition={120}
            accessibilityIgnoresInvertColors
          />
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  bar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  counter: { color: "#fff", fontSize: 13, fontWeight: "700" },
  slide: { alignItems: "center", justifyContent: "center" },
});
