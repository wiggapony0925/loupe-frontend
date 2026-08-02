/**
 * AuroraField — the drifting brand backdrop behind the pre-auth hero.
 *
 * The native counterpart to loupe-web's `<AuroraField>`: three soft accent
 * blobs, a faint market grid, and a slow ticker line. Same composition, so
 * the app's first screen and the marketing site read as one product.
 *
 * Every animation is a `transform` on a Reanimated shared value, so the drift
 * runs entirely on the UI thread — no per-frame JS work, and the hero's live
 * price queries can resolve without the background stuttering. Honors the
 * system "Reduce Motion" setting by rendering the composition at rest.
 */
import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  Path,
  RadialGradient,
  Stop,
} from "react-native-svg";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

/** One drifting blob. `phase` staggers the three so they never move in lockstep. */
function Blob({
  color,
  size,
  style,
  phase,
  reduced,
}: {
  color: string;
  size: number;
  style: ViewStyle;
  phase: number;
  reduced: boolean;
}) {
  const t = useSharedValue(phase);

  React.useEffect(() => {
    if (reduced) return;
    // 14–20s per leg, reversing — slow enough to read as ambience, not motion.
    t.value = withRepeat(
      withTiming(phase + 1, {
        duration: 14000 + phase * 6000,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
  }, [t, phase, reduced]);

  const animated = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(t.value % 1, [0, 0.5, 1], [-18, 22, -18]) },
      { translateY: interpolate(t.value % 1, [0, 0.5, 1], [12, -20, 12]) },
      { scale: interpolate(t.value % 1, [0, 0.5, 1], [1, 1.12, 1]) },
    ],
  }));

  // Gradient ids share one namespace across every mounted <Svg>. Two aurora
  // fields are on screen at once during an auth transition, so a stable id
  // built from the color would collide between them — `useId` keeps each
  // instance's gradient its own (colons stripped; they're invalid in a url()).
  const gradientId = `aurora-${React.useId().replace(/:/g, "")}`;

  return (
    <Animated.View
      style={[styles.blob, style, { width: size, height: size }, animated]}
      pointerEvents="none"
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={0.55} />
            <Stop offset="0.55" stopColor={color} stopOpacity={0.18} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2}
          fill={`url(#${gradientId})`}
        />
      </Svg>
    </Animated.View>
  );
}

export interface AuroraFieldProps {
  /** "hero" = vivid (welcome screen); "subtle" = quiet wash behind a form. */
  variant?: "hero" | "subtle";
  /** Height of the field. Defaults to a tall hero band. */
  height?: number;
}

export function AuroraField({
  variant = "hero",
  height = 460,
}: AuroraFieldProps) {
  const p = useThemedPalette();
  const reduced = useReducedMotion();
  const vivid = variant === "hero";
  // Kept low on purpose. At full strength the blobs read as the subject of the
  // screen rather than the light behind it, and they wash out the headline in
  // light mode — the card art is the only thing here allowed to be loud.
  const opacity = vivid ? 0.5 : 0.28;
  const blob = vivid ? 340 : 260;

  return (
    <View
      style={[styles.field, { height, opacity }]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Blob
        color={p.accent.mint}
        size={blob}
        phase={0}
        reduced={reduced}
        style={{ top: -60, left: -80 }}
      />
      <Blob
        color={p.accent.blue}
        size={blob * 1.05}
        phase={1}
        reduced={reduced}
        style={{ top: 40, right: -110 }}
      />
      <Blob
        color={p.accent.purple}
        size={blob * 0.9}
        phase={2}
        reduced={reduced}
        style={{ bottom: -40, left: 40 }}
      />

      {/* A single ticker line — static, and deliberately near-invisible; it
          should register as texture, never as a chart the user can read. The
          ruled market grid that used to sit under it added a second competing
          pattern behind the headline, so it's gone. */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height={height}>
        <Path
          d={`M0 ${height * 0.72} C 60 ${height * 0.6} 110 ${height * 0.78} 170 ${height * 0.66} S 280 ${height * 0.42} 360 ${height * 0.56} S 460 ${height * 0.38} 560 ${height * 0.49}`}
          stroke={withAlpha(p.accent.mint, 0.18)}
          strokeWidth={1.25}
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
  },
  blob: { position: "absolute" },
});
