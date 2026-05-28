import React, { useEffect } from "react";
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { BlurView } from "expo-blur";
import { X } from "lucide-react-native";
import { CardImage } from "@/presentation/components/CardImage";
import { CardBackArt } from "@/presentation/components/CardBackArt";
import { BACK_VARIANT_LABEL, type BackVariant } from "@/shared/cardBacks";
import { withAlpha } from "@/presentation/theme/tokens";

interface Card3DModalProps {
  visible: boolean;
  onClose: () => void;
  /** Card art URL (large size preferred for a sharp zoomed view). */
  imageUri?: string | null;
  /** Optional blurhash placeholder while the large image loads. */
  blurhash?: string | null;
  /** Optional title / subtitle rendered below the card for context. */
  title?: string;
  subtitle?: string;
  /** Stable key for `recyclingKey` on the underlying image. */
  recyclingKey?: string;
  /**
   * Back-art variant. Drives which placeholder face renders when the
   * user taps to flip. See `@/shared/cardBacks` for inference rules.
   * Defaults to `"unknown"` — a quiet neutral back — so callers can
   * adopt the modal without wiring through their canonical card row.
   */
  backVariant?: BackVariant;
}

/**
 * Reusable "hold the card in your hand" modal. Drag anywhere over the
 * card to tilt it on its X/Y axes; a holographic gradient sweeps across
 * the front in sync, the way Pokemon TCG Live renders foil cards. Pinch
 * to zoom (1×–2.5×). Tap the backdrop or the X to dismiss.
 *
 * Intentionally NOT a full WebGL 3D renderer — that would mean shipping
 * a model file per card. Instead we use a CSS-style `rotateX` / `rotateY`
 * perspective on the 2D art, which is enough to sell the gesture as
 * three-dimensional without paying the bundle / asset cost.
 *
 * Usage:
 *   const [open, setOpen] = useState(false);
 *   <Pressable onPress={() => setOpen(true)}><CardImage … /></Pressable>
 *   <Card3DModal visible={open} onClose={() => setOpen(false)}
 *                imageUri={url} title={card.name} subtitle={card.set_name} />
 */
export function Card3DModal({
  visible,
  onClose,
  imageUri,
  blurhash,
  title,
  subtitle,
  recyclingKey,
  backVariant = "unknown",
}: Card3DModalProps) {
  const { width: screenW } = useWindowDimensions();

  // Target card size — capped so it always fits inside the safe view on
  // narrow phones AND on tablets without becoming gigantic.
  const cardW = Math.min(screenW * 0.78, 360);
  const cardH = cardW * (7 / 5); // standard 5:7 trading-card ratio

  // Shared values driving the tilt + zoom. Reset to neutral whenever the
  // modal closes so the next open animates from a known state.
  const rotX = useSharedValue(0); // -1..1 (top<->bottom)
  const rotY = useSharedValue(0); // -1..1 (left<->right)
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  // `flipDeg` is the *committed* face rotation: 0° (front) or 180°
  // (back). Spring-driven so the flip feels like a real card snapping
  // over rather than a CSS toggle. Kept as a raw degree value (not a
  // 0–1 progress) so the per-face render path can read it directly
  // and apply `pointerEvents="none"` on whichever face is currently
  // hidden — stops the back from eating taps while it's behind.
  const flipDeg = useSharedValue(0);
  const [showingBack, setShowingBack] = React.useState(false);

  useEffect(() => {
    if (!visible) {
      rotX.value = 0;
      rotY.value = 0;
      scale.value = 1;
      savedScale.value = 1;
      flipDeg.value = 0;
      setShowingBack(false);
    }
  }, [visible, rotX, rotY, scale, savedScale, flipDeg]);

  // Maximum rotation in degrees. ±14° sells the tilt without pushing
  // the perspective into the regime where iOS's 3D layer clipping
  // breaks down (which previously caused a hard diagonal where the
  // glare overlay leaked past `overflow: hidden`).
  const MAX_DEG = 14;

  const pan = Gesture.Pan()
    .onChange((e) => {
      // Normalise translation against the card's footprint. Dividing by
      // the half-width keeps the gesture responsive across screen sizes.
      const nx = Math.max(-1, Math.min(1, e.translationX / (cardW / 2)));
      const ny = Math.max(-1, Math.min(1, e.translationY / (cardH / 2)));
      // Drag right → tilt the right edge AWAY from the viewer (rotateY
      // negative in screen space). Drag down → tilt the bottom away.
      rotY.value = nx;
      rotX.value = -ny;
    })
    .onEnd(() => {
      // Snap back to flat with a soft spring so the card "settles" the
      // way a held card would after you let it go.
      rotX.value = withSpring(0, { damping: 14, stiffness: 90 });
      rotY.value = withSpring(0, { damping: 14, stiffness: 90 });
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onChange((e) => {
      const next = savedScale.value * e.scale;
      scale.value = Math.max(1, Math.min(2.5, next));
    })
    .onEnd(() => {
      // Springy ease back to 1× if the user lifts under the floor — feels
      // more alive than a hard clamp.
      if (scale.value < 1.05) {
        scale.value = withSpring(1, { damping: 16, stiffness: 120 });
      }
    });

  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(onClose)();
  });

  // Tap-on-card → flip. `maxDistance(10)` makes the tap fail as soon
  // as the finger moves more than 10pt, so a pan never accidentally
  // triggers a flip. The card-flip tap is composed Simultaneously with
  // pan + pinch so it doesn't have to wait for them to fail — the
  // maxDistance gate alone is enough disambiguation.
  const cardTap = Gesture.Tap()
    .maxDistance(10)
    .numberOfTaps(1)
    .onEnd(() => {
      const next = showingBack ? 0 : 180;
      flipDeg.value = withSpring(next, {
        damping: 16,
        stiffness: 120,
        mass: 0.9,
      });
      runOnJS(setShowingBack)(!showingBack);
    });

  // The card itself: perspective + rotate + scale. Perspective creates
  // the foreshortening that sells the depth — without it `rotateX/Y`
  // looks like a flat skew. Bumped to 1400 so the foreshortening is
  // subtle enough that the card never feels like it's clipping into
  // the screen plane during a strong tilt. The committed `flipDeg`
  // adds onto the live tilt so you can still nudge the card while
  // looking at the back.
  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1400 },
      { rotateX: `${rotX.value * MAX_DEG}deg` },
      { rotateY: `${flipDeg.value + rotY.value * MAX_DEG}deg` },
      { scale: scale.value },
    ],
  }));

  // Combine pan + pinch + flip-tap on the card; backdrop-tap (dismiss)
  // is scoped to the dimmed backdrop, not the card, so a card tap
  // never accidentally closes the modal.
  const cardGesture = Gesture.Simultaneous(pan, pinch, cardTap);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        {/* Backdrop — blurred + dimmed. Tap dismisses. We render two
            absolute layers so the card sits above the blur. */}
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(160)}
          style={StyleSheet.absoluteFill}
        >
          <GestureDetector gesture={tap}>
            <View style={StyleSheet.absoluteFill}>
              <BlurView
                intensity={40}
                tint="dark"
                style={StyleSheet.absoluteFill}
              />
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: "rgba(0,0,0,0.55)" },
                ]}
              />
            </View>
          </GestureDetector>

          {/* Close button — pinned to the top-right safe-ish area. */}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close card preview"
            hitSlop={12}
            style={({ pressed }) => ({
              position: "absolute",
              top: 56,
              right: 20,
              width: 40,
              height: 40,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.14)",
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <X size={20} color="#fff" strokeWidth={2.5} />
          </Pressable>

          {/* Stage — centers the card and catches the gesture. We use
              a flex container instead of absolute positioning so the
              hint copy below the card flows naturally. */}
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 20,
            }}
            pointerEvents="box-none"
          >
            <GestureDetector gesture={cardGesture}>
              {/* Outer wrapper carries the shadow ONLY. Keeping shadow
                  off the transformed layer avoids the iOS bug where a
                  shadow-casting 3D-rotated layer is clipped along a
                  diagonal plane (the "half the card disappears"
                  artefact). The transform + content sit on an inner
                  view that's rasterised to a single texture, so iOS
                  rotates the cached bitmap as one piece instead of
                  re-compositing each child against the perspective. */}
              <Animated.View
                entering={FadeIn.duration(220).easing(Easing.out(Easing.cubic))}
                style={{
                  width: cardW,
                  height: cardH,
                  borderRadius: 18,
                  shadowColor: "#000",
                  shadowOpacity: 0.5,
                  shadowRadius: 30,
                  shadowOffset: { width: 0, height: 18 },
                  elevation: 24,
                }}
              >
                <Animated.View
                  // Two faces sit inside this transformed wrapper. We
                  // intentionally do NOT rasterise here: rasterising
                  // flattens both faces into one 2D texture and breaks
                  // `backfaceVisibility`, which is what the flip
                  // depends on to hide whichever face is turned away
                  // from the camera. Each face owns its own
                  // `overflow:hidden` so the rounded corners survive
                  // the 3D rotate.
                  style={[
                    {
                      width: "100%",
                      height: "100%",
                      borderRadius: 18,
                    },
                    cardStyle,
                  ]}
                >
                  {/* FRONT FACE */}
                  <View
                    pointerEvents={showingBack ? "none" : "auto"}
                    style={{
                      ...StyleSheet.absoluteFillObject,
                      borderRadius: 18,
                      overflow: "hidden",
                      backfaceVisibility: "hidden",
                      backgroundColor: "#000",
                    }}
                  >
                    <CardImage
                      uri={imageUri ?? null}
                      blurhash={blurhash ?? undefined}
                      width="100%"
                      height="100%"
                      rounded={18}
                      contentFit="cover"
                      priority="high"
                      recyclingKey={recyclingKey ?? imageUri ?? "card-3d"}
                      alt={title ?? "Card preview"}
                    />
                    <View
                      pointerEvents="none"
                      style={{
                        ...StyleSheet.absoluteFillObject,
                        borderRadius: 18,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.12)",
                      }}
                    />
                  </View>
                  {/* BACK FACE \u2014 pre-rotated 180\u00b0 so it's the mirror
                      of the front. When the wrapper's rotateY hits
                      180\u00b0 the back ends up facing the camera. */}
                  <View
                    pointerEvents={showingBack ? "auto" : "none"}
                    style={{
                      ...StyleSheet.absoluteFillObject,
                      borderRadius: 18,
                      overflow: "hidden",
                      backfaceVisibility: "hidden",
                      backgroundColor: "#000",
                      transform: [{ rotateY: "180deg" }],
                    }}
                  >
                    <CardBackArt
                      variant={backVariant}
                      width="100%"
                      height="100%"
                      radius={18}
                    />
                    <View
                      pointerEvents="none"
                      style={{
                        ...StyleSheet.absoluteFillObject,
                        borderRadius: 18,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.12)",
                      }}
                    />
                  </View>
                </Animated.View>
              </Animated.View>
            </GestureDetector>

            {/* Caption + hint below the card. Kept tiny + uppercase so
                it reads as chrome, not a competing focal point. */}
            <Animated.View
              entering={FadeIn.delay(120).duration(220)}
              style={{ marginTop: 28, alignItems: "center", gap: 4 }}
              pointerEvents="none"
            >
              {title ? (
                <Text
                  numberOfLines={1}
                  style={{
                    color: "#fff",
                    fontSize: 16,
                    fontWeight: "700",
                    letterSpacing: -0.2,
                  }}
                >
                  {title}
                </Text>
              ) : null}
              {subtitle ? (
                <Text
                  numberOfLines={1}
                  style={{
                    color: withAlpha("#ffffff", 0.6),
                    fontSize: 12,
                  }}
                >
                  {subtitle}
                </Text>
              ) : null}
              {showingBack ? (
                <Text
                  numberOfLines={1}
                  style={{
                    color: withAlpha("#ffffff", 0.55),
                    fontSize: 11,
                    marginTop: 2,
                    fontWeight: "600",
                  }}
                >
                  {BACK_VARIANT_LABEL[backVariant]}
                </Text>
              ) : null}
              <Text
                style={{
                  marginTop: 10,
                  color: withAlpha("#ffffff", 0.45),
                  fontSize: 10,
                  fontWeight: "700",
                  letterSpacing: 2,
                }}
              >
                TAP TO FLIP · DRAG TO TILT · PINCH TO ZOOM
              </Text>
            </Animated.View>
          </View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}
