/**
 * Shared island navbar motion — the glass pill shell stays opaque; only
 * inner content crossfades so the bar never flashes transparent.
 */
import { Easing, FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";

const easeOut = Easing.out(Easing.cubic);

/** Width / layout morph on the persistent pill shell. */
export const islandShellLayout = LinearTransition.duration(220).easing(easeOut);

/** Inner content swap (tab dial ↔ selection actions). */
export const islandContentIn = FadeIn.duration(220)
  .easing(easeOut)
  .withInitialValues({
    opacity: 0,
    transform: [{ scale: 0.94 }],
  });

export const islandContentOut = FadeOut.duration(150).easing(Easing.in(Easing.quad));

export const islandBadgeIn = FadeIn.duration(120)
  .easing(Easing.out(Easing.quad))
  .withInitialValues({
    opacity: 0,
    transform: [{ scale: 0.9 }],
  });
