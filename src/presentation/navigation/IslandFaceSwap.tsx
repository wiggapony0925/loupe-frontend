/**
 * IslandFaceSwap — the island pill's content crossfade, rebuilt on shared
 * values instead of `entering`/`exiting` layout animations.
 *
 * Why not layout animations: the old swap keyed an Animated.View by face
 * and let reanimated snapshot the outgoing subtree while a
 * `LinearTransition` ran on the shell — which meant a subtree containing a
 * live `GestureDetector` (the tab dial, the community rail) was unmounted
 * MID-ANIMATION through the snapshot machinery, at the exact moment the
 * navigator was also running its own native transition. That stack of
 * native machinery is where "switching to Community kills the app" class
 * crashes live, and none of it is reachable by an error boundary.
 *
 * Here both faces stay ordinarily mounted for the 220ms of the swap — the
 * outgoing one absolutely positioned, non-interactive, fading out — and
 * the old face is removed AFTER its fade completes, as a plain React
 * unmount with no animation attached. Same visual (fade + slight scale,
 * the timings from `islandNavMotion`), none of the snapshotting.
 *
 * The swap also carries a render-error boundary: the island floats OUTSIDE
 * the per-feature CrashGuards, so a throw inside a face used to take the
 * whole app down. Now it logs, falls back to `fallback` (the tab dial),
 * and the rest of the app keeps working.
 */
import React, {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const IN_MS = 220;
const OUT_MS = 150;
const easeOut = Easing.out(Easing.cubic);
const easeIn = Easing.in(Easing.quad);

export function IslandFaceSwap({
  faceKey,
  children,
}: {
  /** Identity of the current face; a change runs the crossfade. */
  faceKey: string;
  children: ReactNode;
}) {
  // Snapshot of the previous face while it fades out. `null` at rest.
  const [leaving, setLeaving] = useState<{
    key: string;
    node: ReactNode;
  } | null>(null);
  const prev = useRef<{ key: string; node: ReactNode }>({
    key: faceKey,
    node: children,
  });

  const inP = useSharedValue(1);
  const outP = useSharedValue(0);

  // Derived-state-during-render (the sanctioned pattern): catch the key
  // change *before* paint so the old face never flashes unmounted.
  if (prev.current.key !== faceKey) {
    setLeaving(prev.current);
  }
  prev.current = { key: faceKey, node: children };

  // Layout effect, not effect: the values must land in the same UI batch as
  // the commit that first shows the overlay, or the old face blinks out for
  // a frame before its fade starts.
  useLayoutEffect(() => {
    if (!leaving) return;
    inP.value = 0;
    inP.value = withTiming(1, { duration: IN_MS, easing: easeOut });
    outP.value = 1;
    const clear = () => setLeaving(null);
    outP.value = withTiming(0, { duration: OUT_MS, easing: easeIn }, (done) => {
      if (done) runOnJS(clear)();
    });
    // Keyed on the leaving face's identity: a second swap mid-fade replaces
    // `leaving` and simply restarts the pair of timings.
  }, [leaving?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const inStyle = useAnimatedStyle(() => ({
    opacity: inP.value,
    transform: [{ scale: 0.94 + 0.06 * inP.value }],
  }));
  const outStyle = useAnimatedStyle(() => ({
    opacity: outP.value,
    transform: [{ scale: 0.94 + 0.06 * outP.value }],
  }));

  return (
    <View style={styles.row}>
      <Animated.View style={[styles.row, inStyle]}>{children}</Animated.View>
      {leaving ? (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.overlay, outStyle]}
        >
          {leaving.node}
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * Render-error boundary for island faces. The fallback should be something
 * that cannot itself throw — the plain tab dial, or null.
 */
interface BoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

export class IslandFaceBoundary extends React.Component<
  BoundaryProps,
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error("[IslandFace]", error);
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  overlay: { justifyContent: "center" },
});
