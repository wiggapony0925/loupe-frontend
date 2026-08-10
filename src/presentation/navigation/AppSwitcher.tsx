/**
 * AppSwitcher — the control that moves between Loupe and Loupe Community.
 *
 * A floating segmented capsule (iOS segmented control × Material 3
 * "connected button group"), replacing the emoji-glyph underline rail that
 * read as a plain hyperlink row. The two lanes are two PRODUCTS sharing an
 * account, so the control has to look deliberate: one capsule, two
 * segments, and a mint thumb that slides — the same active-state language
 * as the island dial at the bottom of the screen.
 *
 * Motion, all of it driven by shared values (no entering/exiting layout
 * animations — those run through the snapshot machinery that has burned us
 * at tab-switch time before):
 *
 *   • The thumb SLIDES between lanes on a snappy spring and morphs to the
 *     destination segment's width. Measured, not computed — label widths
 *     differ per platform font metrics, so any guess is wrong somewhere.
 *   • The incoming lane's icon gives a small pop (0.8 → 1 spring) the
 *     moment it becomes active. Enough to feel alive, small enough to
 *     stay out of the way.
 *   • Press-in squishes the segment to 97% and settles back on release —
 *     the standard iOS "this is a button" acknowledgement.
 *   • Every spring honors the system Reduce Motion setting.
 *
 * The first thumb placement never animates: the underline's slide-in on
 * mount read as the page still loading, and the capsule inherits the rule.
 */
import React, { useCallback, useEffect, useRef } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { router, usePathname } from "expo-router";
import * as Haptics from "expo-haptics";
import { Map as MapIcon, Search, Users, type LucideIcon } from "lucide-react-native";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { routes } from "@/shared/routes";

export type Lane = "loupe" | "community" | "map";

interface LaneSpec {
  key: Lane;
  label: string;
  /** Proper vector glyph — the emoji it replaces rendered at whatever
   *  weight the OS felt like and matched nothing else in the app. */
  Icon: LucideIcon;
  go: () => void;
}

const LANES: LaneSpec[] = [
  {
    key: "loupe",
    label: "Loupe",
    Icon: Search,
    go: () => router.navigate(routes.home()),
  },
  {
    key: "community",
    label: "Community",
    Icon: Users,
    go: () => router.navigate(routes.community()),
  },
  {
    key: "map",
    label: "Map",
    Icon: MapIcon,
    // A PUSH, not a tab move: the Map is a full-bleed screen over the
    // shell, and back returns to the lane you left. The lane itself
    // dresses like its siblings — the GREEN lives in the wordmark, which
    // reads "Loupe Map" on the map page the way Community's does.
    go: () => router.push(routes.stores()),
  },
];

/** One spring for every move the capsule makes, so slide, pop and squish
 *  feel like the same material. Snappy but never overshooting the pill. */
const SPRING = {
  damping: 20,
  stiffness: 320,
  mass: 0.65,
  reduceMotion: ReduceMotion.System,
} as const;

/**
 * Cross-instance lane memory.
 *
 * Each screen mounts its own capsule, so without shared memory a freshly
 * mounted instance would render with the thumb already parked and the
 * slide would only ever play on the OUTGOING screen — mostly hidden under
 * the navigator's transition. `routeLane` is where the route says the
 * thumb IS; `cameFrom` is where it was before the last change — captured
 * at the change itself, so a mounting instance can seed its thumb at the
 * origin lane and spring home even though every already-mounted instance
 * has long since caught up. Module scope on purpose: presentation
 * continuity, not app state.
 */
let routeLane: Lane | null = null;
let cameFrom: Lane | null = null;

function noteLane(next: Lane): void {
  if (routeLane !== next) {
    cameFrom = routeLane;
    routeLane = next;
  }
}

export function AppSwitcher({ active }: { active?: Lane }) {
  const p = useThemedPalette();
  // The active lane comes from the PATHNAME, not from a per-screen prop.
  // Both screens keep their switcher mounted (tabs don't unmount), so a
  // static prop meant no instance ever saw the lane CHANGE — and the thumb
  // never actually slid. Deriving it from the route makes every switch
  // animate on whichever instance is on screen, and the two instances can
  // never disagree with the route. The prop remains as an override for
  // tests and previews.
  const fromPath = useActiveLane();
  const lane = active ?? fromPath;
  noteLane(lane);
  // Thumb position + width in the capsule's coordinate space. Measured from
  // each segment's onLayout because font metrics differ per platform.
  const x = useSharedValue(0);
  const w = useSharedValue(0);
  const placed = useRef(false);
  const measured = useRef<Record<string, { x: number; width: number }>>({});

  const placeThumb = useCallback(
    (key: Lane, animated: boolean) => {
      const l = measured.current[key];
      if (!l) return;
      if (animated) {
        x.value = withSpring(l.x, SPRING);
        w.value = withSpring(l.width, SPRING);
      } else {
        x.value = l.x;
        w.value = l.width;
      }
    },
    [x, w],
  );

  const onLaneLayout = (key: Lane) => (event: LayoutChangeEvent) => {
    const { x: lx, width } = event.nativeEvent.layout;
    measured.current[key] = { x: lx, width };
    if (placed.current) return;
    const active = measured.current[lane];
    if (!active) return;
    // A mount while the app is already running is a navigation ARRIVAL:
    // seed the thumb at the lane the route just LEFT and spring it home,
    // so the incoming screen plays the slide. A cold start (no previous
    // lane) snaps — a thumb sliding in on first mount reads as the page
    // loading, not as a control at rest.
    const from =
      cameFrom && cameFrom !== lane ? measured.current[cameFrom] : null;
    if (from) {
      x.value = from.x;
      w.value = from.width;
      x.value = withSpring(active.x, SPRING);
      w.value = withSpring(active.width, SPRING);
      placed.current = true;
    } else if (key === lane) {
      placeThumb(key, false);
      placed.current = true;
    }
  };

  // Re-run the slide when the active lane changes after mount (the layout
  // handler only fires on size changes, not on re-renders).
  useEffect(() => {
    if (placed.current) placeThumb(lane, true);
  }, [lane, placeThumb]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
    width: w.value,
  }));

  return (
    <View style={styles.wrap}>
      <View
        accessibilityRole="tablist"
        style={[
          styles.capsule,
          {
            backgroundColor: p.bg.elevated,
            borderColor: p.line.default,
          },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              backgroundColor: withAlpha(p.accent.mint, 0.16),
              borderColor: withAlpha(p.accent.mint, 0.45),
            },
            thumbStyle,
          ]}
        />
        {LANES.map((spec) => (
          <LaneButton
            key={spec.key}
            lane={spec}
            on={spec.key === lane}
            onLayout={onLaneLayout(spec.key)}
            palette={p}
          />
        ))}
      </View>
    </View>
  );
}

/** One segment: icon + label, with the press squish and the activation pop. */
function LaneButton({
  lane,
  on,
  onLayout,
  palette: p,
}: {
  lane: LaneSpec;
  on: boolean;
  onLayout: (event: LayoutChangeEvent) => void;
  palette: ReturnType<typeof useThemedPalette>;
}) {
  const { Icon } = lane;
  const press = useSharedValue(1);
  const pop = useSharedValue(1);
  const wasOn = useRef(on);

  // Pop the icon when this lane BECOMES active — not on mount, or both
  // icons bounce on first render.
  useEffect(() => {
    if (on && !wasOn.current) {
      pop.value = 0.8;
      pop.value = withSpring(1, { ...SPRING, damping: 14 });
    }
    wasOn.current = on;
  }, [on, pop]);

  const squish = useAnimatedStyle(() => ({
    transform: [{ scale: press.value }],
  }));
  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
  }));

  const tint = on ? p.accent.mint : p.ink.dim;

  return (
    <Pressable
      onLayout={onLayout}
      onPressIn={() => {
        press.value = withSpring(0.96, SPRING);
      }}
      onPressOut={() => {
        press.value = withSpring(1, SPRING);
      }}
      onPress={() => {
        if (on) return;
        Haptics.selectionAsync().catch(() => {});
        lane.go();
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      accessibilityLabel={
        lane.key === "community"
          ? "Loupe Community"
          : lane.key === "map"
            ? "Loupe Map"
            : "Loupe"
      }
      style={styles.lane}
    >
      <Animated.View style={[styles.laneInner, squish]}>
        <Animated.View style={popStyle}>
          <Icon size={14} color={tint} strokeWidth={on ? 2.6 : 2.1} />
        </Animated.View>
        <Text
          style={[
            styles.label,
            { color: on ? p.ink.default : p.ink.dim },
            on && styles.labelOn,
          ]}
        >
          {lane.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/**
 * The wordmark beside the brand mark.
 *
 * "Loupe" everywhere; "Loupe **Community**" and "Loupe **Map**" carry the
 * second word in the app's green. One component so the spellings can't
 * drift, and so the green is applied in exactly one place.
 */
export function AppWordmark({ lane }: { lane: Lane }) {
  const p = useThemedPalette();
  const suffix =
    lane === "community" ? " Community" : lane === "map" ? " Map" : null;
  return (
    <Text style={[styles.wordmark, { color: p.ink.default }]} numberOfLines={1}>
      Loupe
      {suffix ? <Text style={{ color: p.accent.mint }}>{suffix}</Text> : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  wrap: {
    // 20 = the screens' shared gutter, so the capsule's edge sits flush
    // with the brand mark above it.
    paddingHorizontal: 20,
    paddingTop: 2,
    paddingBottom: 10,
    flexDirection: "row",
  },
  capsule: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
  },
  thumb: {
    position: "absolute",
    top: 3,
    bottom: 3,
    left: 0,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  lane: { borderRadius: 999 },
  laneInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
    height: 30,
  },
  label: { fontSize: 13, fontWeight: "600", letterSpacing: -0.1 },
  labelOn: { fontWeight: "800" },
  wordmark: { fontSize: 17, fontWeight: "700", letterSpacing: -0.3 },
});

export { LANES };
export type { LaneSpec };

/** Which lane a path belongs to. Used where the rail can't be told directly. */
export function laneFor(pathname: string): Lane {
  if (pathname.startsWith("/community")) return "community";
  if (pathname.startsWith("/stores")) return "map";
  return "loupe";
}

/** Convenience for screens that just want the current lane. */
export function useActiveLane(): Lane {
  return laneFor(usePathname());
}
