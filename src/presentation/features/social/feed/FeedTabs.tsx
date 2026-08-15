/**
 * FeedTabs — For You · Following.
 *
 * An underline that SLIDES between the labels — one bar in motion, not two
 * bars blinking — on the same spring the AppSwitcher's thumb rides, so the
 * page's two segmented controls feel like the same material. Measured from
 * each tab's layout (font metrics differ per platform), first placement
 * snaps (a slide-in on mount reads as loading), and the spring honors the
 * system Reduce Motion setting.
 *
 * The labels are fixed and few, so they're laid out by flex rather than in a
 * scroller — a tab strip you can accidentally scroll past is a tab strip
 * that hides tabs.
 *
 * Re-pressing the tab you're on is Instagram's "take me back to the top":
 * it fires `onReselect` instead of being swallowed.
 */
import React, { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import type { FeedTab } from "@/infrastructure/http";
import { useThemedPalette } from "@/presentation/theme/tokens";

/** Two, not three. "Your Posts" moved to your PROFILE, where the rest of
 *  your stuff already lives — a feed is for other people's posts, and a tab
 *  showing only your own was a filter pretending to be a feed. The `mine`
 *  tab still exists on the API; the profile grid is what reads it now.
 *
 *  For You leads: it's the tab the app OPENS on, and a fresh account's
 *  Following feed is empty — leading with the tab that always has
 *  something is what every feed app converged on. */
export const FEED_TABS: { key: FeedTab; label: string }[] = [
  { key: "foryou", label: "For You" },
  { key: "following", label: "Following" },
];

/** The AppSwitcher's spring, so the two controls move as one material. */
const SLIDE_SPRING = {
  damping: 20,
  stiffness: 320,
  mass: 0.65,
  reduceMotion: ReduceMotion.System,
} as const;

/** How far the underline sits in from the tab's edges. */
const UNDERLINE_INSET = 14;

export function FeedTabs({
  value,
  onChange,
  onReselect,
}: {
  value: FeedTab;
  onChange: (tab: FeedTab) => void;
  /** Fired when the ACTIVE tab is pressed again — scroll-to-top, etc. */
  onReselect?: () => void;
}) {
  const p = useThemedPalette();
  const x = useSharedValue(0);
  const w = useSharedValue(0);
  const placed = useRef(false);
  const measured = useRef<Record<string, { x: number; width: number }>>({});

  const place = (key: FeedTab, animated: boolean) => {
    const l = measured.current[key];
    if (!l) return;
    const tx = l.x + UNDERLINE_INSET;
    const tw = Math.max(0, l.width - UNDERLINE_INSET * 2);
    if (animated) {
      x.value = withSpring(tx, SLIDE_SPRING);
      w.value = withSpring(tw, SLIDE_SPRING);
    } else {
      x.value = tx;
      w.value = tw;
    }
  };

  const onTabLayout = (key: FeedTab) => (event: LayoutChangeEvent) => {
    const { x: lx, width } = event.nativeEvent.layout;
    measured.current[key] = { x: lx, width };
    if (key !== value) return;
    // Snap, never slide, from a layout event: on first mount an underline
    // sliding in reads as the page loading (the switcher's standing rule),
    // and later layout events are RESIZES (rotation, font scale) where the
    // bar should simply stay under the label.
    place(key, false);
    placed.current = true;
  };

  // Slide on changes after mount; layout handlers only fire on size changes.
  useEffect(() => {
    if (placed.current) place(value, true);
    // place() reads refs and shared values only — stable by construction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const slider = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
    width: w.value,
  }));

  return (
    // tablist, so VoiceOver announces "tab 1 of 2" — the children are
    // already role="tab" and need a container that says what they are in.
    <View accessibilityRole="tablist" style={[styles.row, { borderBottomColor: p.line.default }]}>
      {FEED_TABS.map((tab) => {
        const active = tab.key === value;
        return (
          <Pressable
            key={tab.key}
            onLayout={onTabLayout(tab.key)}
            onPress={() => {
              if (active) {
                onReselect?.();
                return;
              }
              Haptics.selectionAsync().catch(() => {});
              onChange(tab.key);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
            style={styles.tab}
          >
            <Text
              style={[
                styles.label,
                {
                  color: active ? p.ink.default : p.ink.dim,
                  fontWeight: active ? "800" : "600",
                },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
      <Animated.View
        pointerEvents="none"
        style={[styles.slider, { backgroundColor: p.accent.mint }, slider]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 11,
  },
  label: { fontSize: 15, letterSpacing: -0.2 },
  slider: {
    position: "absolute",
    bottom: 0,
    left: 0,
    height: 3,
    borderRadius: 2,
  },
});
