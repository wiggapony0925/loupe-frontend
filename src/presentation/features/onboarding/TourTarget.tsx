/**
 * TourTarget — invisible measuring wrapper for a home-tour highlight.
 *
 * Wrap any section the tour should point at; on layout it records the
 * child's WINDOW-coordinate rect into `tourAnchors`. Zero visual or
 * layout impact (`collapsable={false}` only forces a real native view
 * so `measureInWindow` has something to measure).
 */
import { useCallback, useRef } from "react";
import { View, type ViewProps } from "react-native";
import { useTourAnchors } from "./tourAnchors";

export function TourTarget({
  id,
  children,
  ...rest
}: ViewProps & { id: string }) {
  const ref = useRef<View>(null);
  const setRect = useTourAnchors((s) => s.setRect);

  const measure = useCallback(() => {
    // measureInWindow (not onLayout coords) — the overlay is window-
    // absolute, so anchors must be too.
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) setRect(id, { x, y, width, height });
    });
  }, [id, setRect]);

  return (
    <View ref={ref} collapsable={false} onLayout={measure} {...rest}>
      {children}
    </View>
  );
}
