/**
 * FeedSkeleton — the feed's first-load placeholder.
 *
 * Ghost post cards that pulse gently, shaped like the real thing (avatar,
 * byline, media block, action row) so the page's structure is on screen
 * before its content is. A lone spinner told you nothing about what was
 * coming and made the wait feel longer; a skeleton is the app saying "this
 * exact thing is seconds away".
 *
 * One shared pulse drives every card — staggered shimmers look busy on a
 * surface this large — and Reduce Motion collapses it to a static tint.
 */
import React, { useEffect } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

const GUTTER = 20;

export function FeedSkeleton({ rows = 3 }: { rows?: number }) {
  const p = useThemedPalette();
  const { width } = useWindowDimensions();
  const pulse = useSharedValue(0.55);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 720, reduceMotion: ReduceMotion.System }),
      -1,
      true,
    );
  }, [pulse]);

  const glow = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const tone = { backgroundColor: withAlpha(p.ink.dim, 0.14) };

  return (
    <View accessibilityLabel="Loading posts" accessibilityRole="progressbar">
      {Array.from({ length: rows }, (_, index) => (
        <Animated.View
          key={index}
          style={[styles.card, { borderBottomColor: p.line.default }, glow]}
        >
          <View style={styles.head}>
            <View style={[styles.avatar, tone]} />
            <View style={styles.ident}>
              <View style={[styles.line, { width: 128 }, tone]} />
              <View style={[styles.line, styles.thin, { width: 84 }, tone]} />
            </View>
          </View>
          {/* Square like the median card photo, capped so one ghost never
              owns the whole viewport. */}
          <View style={[styles.media, { height: Math.min(width, 360) }, tone]} />
          <View style={styles.foot}>
            <View style={[styles.line, { width: 76 }, tone]} />
            <View style={[styles.line, { width: 44 }, tone]} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: GUTTER,
  },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  ident: { gap: 7 },
  line: { height: 11, borderRadius: 6 },
  thin: { height: 9 },
  media: { marginTop: 12 },
  foot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    paddingHorizontal: GUTTER,
    marginTop: 12,
  },
});
