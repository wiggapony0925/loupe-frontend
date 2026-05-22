/**
 * usePressScale — tiny utility hook for "Robinhood-style" tap feedback.
 *
 * Returns a shared `Animated.Value` and the two press handlers that
 * spring it between 1 (idle) and `scaleTo` (held). Use it with a
 * `Pressable`/`Pressable` that owns the touch surface, and apply the
 * `scale` value to an `Animated.View` that wraps the visual content:
 *
 * ```tsx
 * const { scale, onPressIn, onPressOut } = usePressScale();
 * <Pressable onPressIn={onPressIn} onPressOut={onPressOut}>
 *   <Animated.View style={{ transform: [{ scale }] }}>…</Animated.View>
 * </Pressable>
 * ```
 *
 * Uses the native driver so the spring runs off the JS thread and
 * stays smooth even while the row's parent list is scrolling.
 */
import { useCallback, useRef } from "react";
import { Animated } from "react-native";

export function usePressScale(scaleTo = 0.97) {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = useCallback(
    (to: number) => {
      Animated.spring(scale, {
        toValue: to,
        useNativeDriver: true,
        speed: 50,
        bounciness: 0,
      }).start();
    },
    [scale],
  );
  const onPressIn = useCallback(() => animate(scaleTo), [animate, scaleTo]);
  const onPressOut = useCallback(() => animate(1), [animate]);
  return { scale, onPressIn, onPressOut };
}
