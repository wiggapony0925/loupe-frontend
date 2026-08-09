/**
 * How pages move. Defined ONCE, referenced everywhere.
 *
 * Before this, each navigator picked its own: the tab group used `shift`,
 * the community stack took React Navigation's default slide, and
 * notifications used `slide_from_right`. Three different feelings inside
 * one micro-app, and no single place to change any of them — so a
 * consistency fix meant editing every layout and hoping none were missed.
 *
 * Two exports, for the two genuinely different situations:
 *
 * `SCREEN_TRANSITION`
 *     Navigator `screenOptions`. Use it when the page actually changes —
 *     a push, or a tab swap. React Navigation drives the animation on the
 *     native side, which is smoother than anything JS can do and survives
 *     an interrupted gesture.
 *
 * `useScreenTransition()`
 *     For content that changes WITHOUT navigating: a segmented switch, a
 *     tab strip inside one screen. There's no navigation event to hook,
 *     so the hook watches whatever key you hand it and re-runs the same
 *     motion. Same curve and duration as the navigator, so a swap inside a
 *     page and a move between pages feel like one system.
 *
 * The shared curve is a short ease-out with a small upward drift. Long
 * enough to read as motion, short enough that a fast tapper never waits —
 * and it matches `islandNavMotion`, so the navbar's own morph and the page
 * behind it move together instead of arguing.
 */
import { useEffect } from "react";
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

/** Matches `islandNavMotion`'s content swap, so the two move as one. */
export const SCREEN_MOTION_MS = 220;
export const SCREEN_MOTION_EASING = Easing.out(Easing.cubic);

/**
 * Navigator-level options. Spread into `screenOptions` on every Stack that
 * belongs to a micro-app:
 *
 * ```tsx
 * <Stack screenOptions={{ headerShown: false, ...SCREEN_TRANSITION }} />
 * ```
 *
 * `slide_from_right` rather than `fade`: inside a section, a push has a
 * direction, and the back-swipe reads as reversing it. A crossfade makes
 * "deeper" and "back" look identical.
 */
export const SCREEN_TRANSITION: NativeStackNavigationOptions = {
  animation: "slide_from_right",
  animationDuration: SCREEN_MOTION_MS,
  gestureEnabled: true,
};

/**
 * Content-swap motion for a view that changes in place.
 *
 * Pass anything that identifies the current content — a tab key, an id.
 * When it changes the content fades out and back with a small rise.
 *
 * ```tsx
 * const style = useScreenTransition(tab);
 * return <Animated.View style={style}>{body}</Animated.View>;
 * ```
 */
export function useScreenTransition(key: string | number) {
  const progress = useSharedValue(1);

  useEffect(() => {
    // Straight to 0 then back: a cross-dissolve between two states would
    // need both mounted at once, which doubles the work for a 220ms effect
    // nobody is looking closely at.
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: SCREEN_MOTION_MS,
      easing: SCREEN_MOTION_EASING,
    });
  }, [key, progress]);

  return useAnimatedStyle(() => ({
    opacity: progress.value,
    // 10pt is enough to read as "this is new" without looking like a jump.
    transform: [{ translateY: (1 - progress.value) * 10 }],
  }));
}
