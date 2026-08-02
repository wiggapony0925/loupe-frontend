/**
 * AppLoadingScreen — what the app shows while it's working, not ready yet.
 *
 * The brand splash runs on a fixed hold, so when boot work outlasts it (cold
 * start on a slow network, a token refresh, a migration) the user was left
 * looking at an empty canvas. This fills that gap with something that reads as
 * "working" rather than "broken".
 *
 * The motion is a loupe sweeping over the mark: an arc orbiting the lens, a
 * reticle that breathes, and an indeterminate hairline underneath. All three
 * are `transform`/opacity on Reanimated shared values, so they run on the UI
 * thread and keep moving smoothly even while the JS thread is busy doing the
 * very work being waited on — which is the whole point of a boot spinner.
 *
 * Honors the system "Reduce Motion" setting by rendering at rest.
 */
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { LoupeMark } from "@/presentation/brand/LoupeMark";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

const ORBIT = 80;
const R = 34;
const CIRCUMFERENCE = 2 * Math.PI * R;
/** Roughly a 75° arc — long enough to read as a sweep, short enough to chase. */
const ARC = CIRCUMFERENCE * (75 / 360);

const TRACK_W = 132;
const SEGMENT_W = 46;

export function AppLoadingScreen({
  /** Optional line under the mark. Keep it short and factual. */
  message,
}: {
  message?: string;
}) {
  const p = useThemedPalette();
  const reduced = useReducedMotion();

  const spin = useSharedValue(0);
  const breathe = useSharedValue(0);
  const slide = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    spin.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.linear }),
      -1,
      false,
    );
    breathe.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    slide.value = withRepeat(
      withTiming(1, { duration: 1150, easing: Easing.inOut(Easing.cubic) }),
      -1,
      true,
    );
  }, [spin, breathe, slide, reduced]);

  const orbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  const markStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breathe.value, [0, 1], [0.72, 1]),
    transform: [{ scale: interpolate(breathe.value, [0, 1], [0.97, 1.02]) }],
  }));

  const segmentStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(slide.value, [0, 1], [0, TRACK_W - SEGMENT_W]) },
    ],
  }));

  return (
    <View
      style={[styles.root, { backgroundColor: p.bg.base }]}
      accessibilityRole="progressbar"
      accessibilityLabel={message ?? "Loading"}
    >
      <View style={styles.markWrap}>
        <Animated.View style={[styles.orbit, orbitStyle]}>
          <Svg width={ORBIT} height={ORBIT}>
            <Circle
              cx={ORBIT / 2}
              cy={ORBIT / 2}
              r={R}
              stroke={p.accent.mint}
              strokeWidth={2}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${ARC} ${CIRCUMFERENCE}`}
            />
          </Svg>
        </Animated.View>

        <Animated.View style={markStyle}>
          <LoupeMark size={40} color={p.ink.default} />
        </Animated.View>
      </View>

      <View
        style={[
          styles.track,
          { backgroundColor: withAlpha(p.ink.default, 0.08) },
        ]}
      >
        <Animated.View
          style={[
            styles.segment,
            { backgroundColor: p.accent.mint },
            segmentStyle,
          ]}
        />
      </View>

      {message ? (
        <Text style={[styles.message, { color: p.ink.dim }]}>{message}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center" },
  markWrap: {
    width: ORBIT,
    height: ORBIT,
    alignItems: "center",
    justifyContent: "center",
  },
  orbit: { position: "absolute" },
  track: {
    width: TRACK_W,
    height: 2,
    borderRadius: 1,
    marginTop: 30,
    overflow: "hidden",
  },
  segment: { width: SEGMENT_W, height: 2, borderRadius: 1 },
  message: {
    marginTop: 14,
    fontSize: 12,
    letterSpacing: 0.2,
  },
});
