/**
 * AppSwitcher — the rail that moves between Loupe and Loupe Community.
 *
 * Modelled on Uber's top rail (Uber · Eats · Courier · Shops), because it
 * solves the same problem: two products that share an account and a bottom
 * bar, where the bottom bar is already full of the CURRENT product's own
 * destinations. Hanging Community off an icon in the header made it feel
 * like a page inside the wallet app rather than a place you go.
 *
 * Why a rail and not a tab: switching here changes what the whole bottom
 * bar means. Tabs promise siblings — the same shell with different content —
 * and these two have different shells, different navbars and different
 * accent behaviour. The rail sits ABOVE the shell to say so.
 *
 * The active lane is drawn with a moving underline rather than a
 * per-lane border, so the mark slides between lanes instead of blinking
 * on and off.
 */
import React, { useRef } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { router, usePathname } from "expo-router";
import * as Haptics from "expo-haptics";
import { useThemedPalette } from "@/presentation/theme/tokens";
import { routes } from "@/shared/routes";

export type Lane = "loupe" | "community";

interface LaneSpec {
  key: Lane;
  label: string;
  /** The glyph. Emoji, matching the reference rail — a monochrome icon set
   *  at this size reads as a toolbar, and this is meant to read as a
   *  choice between two products. */
  glyph: string;
  go: () => void;
}

const LANES: LaneSpec[] = [
  {
    key: "loupe",
    label: "Loupe",
    glyph: "🔍",
    go: () => router.navigate(routes.home()),
  },
  {
    key: "community",
    label: "Community",
    glyph: "👥",
    go: () => router.navigate(routes.community()),
  },
];

export function AppSwitcher({ active }: { active: Lane }) {
  const p = useThemedPalette();
  // Where the underline sits and how wide it is. Measured rather than
  // computed: the labels are different lengths and the font metrics differ
  // per platform, so any guess is wrong on one of them.
  const x = useSharedValue(0);
  const w = useSharedValue(0);
  const measured = useRef<Record<string, { x: number; width: number }>>({});

  const onLaneLayout = (key: Lane) => (event: LayoutChangeEvent) => {
    const { x: lx, width } = event.nativeEvent.layout;
    measured.current[key] = { x: lx, width };
    if (key === active) {
      // The FIRST measurement must not animate — the underline would slide
      // in from zero on every mount, which reads as the page loading.
      const first = w.value === 0;
      const inset = 4;
      if (first) {
        x.value = lx + inset;
        w.value = Math.max(0, width - inset * 2);
      } else {
        x.value = withTiming(lx + inset, { duration: 220 });
        w.value = withTiming(Math.max(0, width - inset * 2), { duration: 220 });
      }
    }
  };

  const underline = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
    width: w.value,
  }));

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // Bleeds past the gutter so a third lane would sit half-visible at
        // the edge and read as scrollable — the standing rule for every
        // horizontal surface in the app.
        contentContainerStyle={styles.row}
      >
        {LANES.map((lane) => {
          const on = lane.key === active;
          return (
            <Pressable
              key={lane.key}
              onLayout={onLaneLayout(lane.key)}
              onPress={() => {
                if (on) return;
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                  () => {},
                );
                lane.go();
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={
                lane.key === "community" ? "Loupe Community" : "Loupe"
              }
              style={({ pressed }) => [styles.lane, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.glyph}>{lane.glyph}</Text>
              <Text
                style={[
                  styles.label,
                  { color: on ? p.ink.default : p.ink.dim },
                  on && styles.labelOn,
                ]}
              >
                {lane.label}
              </Text>
            </Pressable>
          );
        })}

        <Animated.View
          style={[
            styles.underline,
            { backgroundColor: p.ink.default },
            underline,
          ]}
          pointerEvents="none"
        />
      </ScrollView>
      <View style={[styles.hairline, { backgroundColor: p.line.default }]} />
    </View>
  );
}

/**
 * The wordmark under the rail.
 *
 * "Loupe" everywhere, "Loupe **Community**" in the community lane with the
 * second word in the app's green. One component so the two spellings can't
 * drift, and so the green is applied in exactly one place.
 */
export function AppWordmark({ lane }: { lane: Lane }) {
  const p = useThemedPalette();
  return (
    <Text style={[styles.wordmark, { color: p.ink.default }]} numberOfLines={1}>
      Loupe
      {lane === "community" ? (
        <Text style={{ color: p.accent.mint }}> Community</Text>
      ) : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    paddingHorizontal: 14,
    paddingTop: 2,
  },
  lane: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 4,
    paddingVertical: 8,
    // Room for the underline to sit under the text without touching it.
    paddingBottom: 12,
  },
  glyph: { fontSize: 21 },
  label: { fontSize: 21, fontWeight: "600", letterSpacing: -0.4 },
  labelOn: { fontWeight: "800" },
  underline: {
    position: "absolute",
    bottom: 0,
    left: 0,
    height: 2.5,
    borderRadius: 2,
  },
  hairline: { height: StyleSheet.hairlineWidth, opacity: 0.6 },
  wordmark: { fontSize: 17, fontWeight: "700", letterSpacing: -0.3 },
});

export { LANES };
export type { LaneSpec };

/** Which lane a path belongs to. Used where the rail can't be told directly. */
export function laneFor(pathname: string): Lane {
  return pathname.startsWith("/community") ? "community" : "loupe";
}

/** Convenience for screens that just want the current lane. */
export function useActiveLane(): Lane {
  return laneFor(usePathname());
}
