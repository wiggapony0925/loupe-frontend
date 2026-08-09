/**
 * Shared island navbar motion — the glass pill shell stays opaque; only
 * inner content crossfades so the bar never flashes transparent.
 *
 * The content swap itself lives in `IslandFaceSwap` (shared-value fades,
 * no entering/exiting snapshots — see that file for why). What remains
 * here is the shell's width morph and the badge pop, both on subtrees
 * that never contain gesture handlers.
 */
import { Easing, FadeIn, LinearTransition } from "react-native-reanimated";

const easeOut = Easing.out(Easing.cubic);

/** Width / layout morph on the persistent pill shell. */
export const islandShellLayout = LinearTransition.duration(220).easing(easeOut);

export const islandBadgeIn = FadeIn.duration(120)
  .easing(Easing.out(Easing.quad))
  .withInitialValues({
    opacity: 0,
    transform: [{ scale: 0.9 }],
  });
