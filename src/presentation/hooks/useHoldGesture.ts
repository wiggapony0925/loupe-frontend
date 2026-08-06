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
import { useMemo, useRef } from "react";
import * as Haptics from "expo-haptics";
import { Gesture } from "react-native-gesture-handler";

/** How long a touch must hold before it counts (ms). */
const HOLD_MS = 280;
/** How far the finger may drift while holding (dp) — deliberately generous. */
const HOLD_SLOP = 28;

export function useHoldGesture(onHold?: () => void) {
  // The callback is read through a ref, NOT captured in the gesture's deps.
  //
  // This is the whole reason hold-to-select was unreliable. Call sites build
  // the handler inline per row (`() => enterSelection(item.id)`), so its
  // identity changes on every render — and the vault re-renders constantly as
  // sparkline data streams in. With `onHold` in the dep array the gesture
  // object was rebuilt each time, GestureDetector tore down the native
  // handler and re-registered a fresh one, and any hold IN FLIGHT was
  // discarded. You'd hold a row, a sparkline would resolve, and your press
  // silently died — which is exactly why it worked "sometimes".
  //
  // Keeping the object identity stable means the native handler is registered
  // once and a hold can actually run to completion.
  const latest = useRef(onHold);
  latest.current = onHold;

  // Only the PRESENCE of a handler may rebuild the gesture (it flips at most
  // once per mode change), never the handler's identity.
  const enabled = !!onHold;

  return useMemo(
    () =>
      Gesture.LongPress()
        .enabled(enabled)
        .minDuration(HOLD_MS)
        .maxDistance(HOLD_SLOP)
        // Drifting past the row's own bounds mid-hold is a thumb roll, not an
        // abandoned press; without this the row edge cancels it.
        .shouldCancelWhenOutside(false)
        .runOnJS(true)
        .onStart(() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          latest.current?.();
        }),
    [enabled],
  );
}
