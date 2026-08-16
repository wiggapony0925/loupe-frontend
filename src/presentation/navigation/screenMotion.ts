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
import { Platform } from "react-native";
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import {
  Easing,
  ReduceMotion,
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
 * iOS: the SYSTEM push. The previous `slide_from_right` + custom duration
 * ran as a flat card sliding over a frozen page — no parallax, no depth,
 * and it read exactly that cheap. `default` hands the transition back to
 * UINavigationController: the outgoing page slides away underneath with a
 * dimming layer, the spring curve is Apple's, and the edge back-swipe
 * tracks the finger natively. You cannot beat it from JS, so don't try.
 *
 * Android: the platform default is a crossfade that makes "deeper" and
 * "back" look identical, so it keeps the directional slide instead.
 */
export const SCREEN_TRANSITION: NativeStackNavigationOptions =
  Platform.OS === "ios"
    ? { animation: "default", gestureEnabled: true }
    : {
        animation: "slide_from_right",
        animationDuration: SCREEN_MOTION_MS,
        gestureEnabled: true,
      };

/**
 * Sideways moves between PEERS — destinations at the same level, the kind a
 * tab bar or a segmented control switches between.
 *
 * A push says "you went deeper, and back is where you came from". Peers have
 * no deeper and no back: the whole point is that any one can follow any
 * other. Sliding one over another gives that move a direction it does not
 * have, and the direction then has to be undone — which is how the same
 * control ends up animating left on the way out and right on the way home.
 *
 * A fade has no direction, so it reads identically in both, and this is the
 * rule the rest of the app already follows: the root stack and the tab
 * navigator both set `animation: "fade"` for exactly this case.
 *
 * WHAT WENT WRONG WITHOUT IT. The community island is a segmented control
 * over four destinations. Two of them — notifications and a profile — live in
 * the tab group and faded. The other two — the feed and collectors — live in
 * the community Stack, which spread `SCREEN_TRANSITION` over every route it
 * owns, so they pushed. One control, one kind of move, two different
 * animations depending on which segment you tapped, and the pair that pushed
 * also reversed direction on the way back.
 *
 * Use this for a route the user reaches SIDEWAYS. Keep `SCREEN_TRANSITION`
 * for a route they reach by going deeper — a post, a tag, a composer.
 */
export const PEER_TRANSITION: NativeStackNavigationOptions = {
  animation: "fade",
  animationDuration: SCREEN_MOTION_MS,
  // Still swipeable. A fade cannot track a finger the way a card can, but
  // taking the gesture away entirely would be a real loss on a screen people
  // reach from a floating control and expect to back out of.
  gestureEnabled: true,
};

/**
 * Content-swap motion for a view that changes in place — the fade-through.
 *
 * Pass anything that identifies the current content — a tab key, an id.
 * When it changes, the incoming content fades in while rising a touch and
 * settling from 98.5% scale: Material's fade-through, tuned down to feel
 * at home beside iOS's own transitions. The scale is what makes it read
 * as NEW CONTENT ARRIVING rather than the same view blinking.
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
      reduceMotion: ReduceMotion.System,
    });
  }, [key, progress]);

  return useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      // 12pt is enough to read as "this is new" without looking like a jump.
      { translateY: (1 - progress.value) * 12 },
      { scale: 0.985 + progress.value * 0.015 },
    ],
  }));
}
