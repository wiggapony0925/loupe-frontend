/**
 * FaceScan — the Face ID motif, in four states.
 *
 * One graphic used on all three biometric surfaces (setup page, the offer
 * sheet, the lock screen) so the feature has a face of its own rather than
 * three unrelated icons. It is a camera-focus frame: four corner brackets
 * around whatever you put inside it — a glyph on the setup page, the user's
 * avatar on the lock.
 *
 *   idle      brackets breathe, barely. The screen is waiting for you.
 *   scanning  a mint line sweeps the frame and the brackets tighten.
 *   success   the sweep resolves into a ring that flares once and settles.
 *   failed    the frame pulses rose, once. No shake — a lock that flinches
 *             reads as broken rather than as unconvinced.
 *
 * Motion is the whole point here, so `useReducedMotion` is honoured
 * properly: every animation collapses to its resting frame rather than
 * being merely faster, and the state is still legible from colour alone.
 */
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

export type FaceScanState = "idle" | "scanning" | "success" | "failed";

export function FaceScan({
  state = "idle",
  size = 132,
  children,
}: {
  state?: FaceScanState;
  size?: number;
  children?: React.ReactNode;
}) {
  const p = useThemedPalette();
  const reduced = useReducedMotion();

  // 0 → resting, 1 → tightened. Drives bracket inset + opacity together so
  // the frame reads as one object rather than four independent corners.
  const tighten = useSharedValue(0);
  // The sweep's vertical position, 0 → 1 across the frame.
  const sweep = useSharedValue(0);
  const flare = useSharedValue(0);
  const fail = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(sweep);
    cancelAnimation(tighten);

    if (state === "scanning") {
      tighten.value = withTiming(1, { duration: 260 });
      if (!reduced) {
        sweep.value = 0;
        sweep.value = withRepeat(
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          -1,
          true,
        );
      } else {
        sweep.value = 0.5;
      }
      return;
    }

    if (state === "success") {
      tighten.value = withTiming(1, { duration: 180 });
      sweep.value = withTiming(1, { duration: 200 });
      flare.value = reduced
        ? 1
        : withSequence(
            withSpring(1, { damping: 12, stiffness: 220 }),
            withTiming(0.55, { duration: 420 }),
          );
      return;
    }

    if (state === "failed") {
      tighten.value = withTiming(0, { duration: 200 });
      fail.value = reduced
        ? 1
        : withSequence(
            withTiming(1, { duration: 140 }),
            withTiming(0, { duration: 520 }),
          );
      return;
    }

    // idle
    flare.value = withTiming(0, { duration: 200 });
    tighten.value = reduced
      ? 0
      : withRepeat(
          withTiming(0.35, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
          -1,
          true,
        );
  }, [state, reduced, sweep, tighten, flare, fail]);

  // Corners pull in as the frame tightens — 10% of the box at rest, 6% when
  // scanning. Small numbers; the effect should be felt, not watched.
  const inset = useAnimatedStyle(() => ({
    margin: interpolate(tighten.value, [0, 1], [size * 0.1, size * 0.06]),
  }));

  const sweepStyle = useAnimatedStyle(() => ({
    opacity: state === "scanning" ? interpolate(sweep.value, [0, 0.5, 1], [0, 1, 0]) : 0,
    transform: [{ translateY: interpolate(sweep.value, [0, 1], [-size / 2.6, size / 2.6]) }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: flare.value,
    transform: [{ scale: interpolate(flare.value, [0, 1], [0.86, 1]) }],
  }));

  const failStyle = useAnimatedStyle(() => ({ opacity: fail.value }));

  const tint =
    state === "failed"
      ? p.accent.rose
      : state === "success"
        ? p.accent.mint
        : p.accent.mint;
  const bracketOpacity = state === "idle" ? 0.5 : 1;

  const corner = (key: string, style: object) => (
    <Animated.View
      key={key}
      pointerEvents="none"
      style={[
        styles.corner,
        style,
        { borderColor: withAlpha(tint, bracketOpacity), width: size * 0.26, height: size * 0.26 },
      ]}
    />
  );

  return (
    <View style={{ width: size, height: size }}>
      {/* The soft field behind everything — the same "there is light here"
          language as AuroraField, scoped to one object. */}
      <View
        style={[
          styles.glow,
          { backgroundColor: withAlpha(tint, state === "idle" ? 0.07 : 0.12), borderRadius: size },
        ]}
      />

      <Animated.View style={[StyleSheet.absoluteFill, inset]}>
        {corner("tl", { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 14 })}
        {corner("tr", { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 14 })}
        {corner("bl", { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 14 })}
        {corner("br", { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 14 })}
      </Animated.View>

      {/* Success ring — drawn OUTSIDE the brackets so the flare reads as the
          frame confirming, not as another element arriving. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          ringStyle,
          { borderColor: withAlpha(p.accent.mint, 0.55), borderRadius: size },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          failStyle,
          { borderColor: withAlpha(p.accent.rose, 0.6), borderRadius: size },
        ]}
      />

      <View style={styles.center}>{children}</View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.sweep,
          sweepStyle,
          { backgroundColor: withAlpha(p.accent.mint, 0.9), shadowColor: p.accent.mint },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  glow: { ...StyleSheet.absoluteFillObject },
  corner: { position: "absolute" },
  ring: { ...StyleSheet.absoluteFillObject, borderWidth: 1.5 },
  center: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  sweep: {
    position: "absolute",
    left: "16%",
    right: "16%",
    top: "50%",
    height: 2,
    borderRadius: 2,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
});
