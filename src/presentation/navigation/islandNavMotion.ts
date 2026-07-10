/**
 * Shared island navbar morph — subtle scale + lift, no spring bounce.
 * Used when swapping between the tab dial and vault selection chrome.
 */
import { Easing, FadeIn, Keyframe } from "react-native-reanimated";

const easeOut = Easing.out(Easing.cubic);

export const islandMorphIn = FadeIn.duration(210)
  .easing(easeOut)
  .withInitialValues({
    opacity: 0,
    transform: [{ scale: 0.975 }, { translateY: 3 }],
  });

export const islandMorphOut = new Keyframe({
  from: {
    opacity: 1,
    transform: [{ scale: 1 }, { translateY: 0 }],
  },
  to: {
    opacity: 0,
    transform: [{ scale: 0.985 }, { translateY: 2 }],
  },
}).duration(140);

export const islandBadgeIn = FadeIn.duration(120)
  .easing(Easing.out(Easing.quad))
  .withInitialValues({
    opacity: 0,
    transform: [{ scale: 0.9 }],
  });
