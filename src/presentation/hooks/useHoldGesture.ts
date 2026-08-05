/**
 * useHoldGesture — a reliable long-press for rows inside scrollables.
 *
 * RN's `Pressable.onLongPress` cancels the moment the touch drifts past the
 * ~10dp responder slop, because the surrounding FlatList claims the gesture
 * as a scroll. A thumb holding a row almost always drifts a few points, so
 * hold-to-select only fired "sometimes" — the classic flaky long-press.
 *
 * This wraps the row in a gesture-handler LongPress instead: `maxDistance`
 * gives the finger honest wiggle room, and once the hold activates RNGH
 * cancels the scroll rather than the other way round. Pair it with a
 * `GestureDetector` around the existing Pressable and REMOVE the Pressable's
 * own `onLongPress` (otherwise both can fire).
 *
 *   const hold = useHoldGesture(onLongPress);
 *   return (
 *     <GestureDetector gesture={hold}>
 *       <Pressable onPress={...}>…</Pressable>
 *     </GestureDetector>
 *   );
 */
import { useMemo } from "react";
import * as Haptics from "expo-haptics";
import { Gesture } from "react-native-gesture-handler";

/** How long a touch must hold before it counts (ms). */
const HOLD_MS = 280;
/** How far the finger may drift while holding (dp) — deliberately generous. */
const HOLD_SLOP = 28;

export function useHoldGesture(onHold?: () => void) {
  return useMemo(
    () =>
      Gesture.LongPress()
        .enabled(!!onHold)
        .minDuration(HOLD_MS)
        .maxDistance(HOLD_SLOP)
        .runOnJS(true)
        .onStart(() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          onHold?.();
        }),
    [onHold],
  );
}
