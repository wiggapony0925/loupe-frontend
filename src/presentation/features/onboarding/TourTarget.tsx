/**
 * TourTarget — invisible measuring wrapper for a home-tour highlight.
 *
 * Wrap any section the tour should point at; on layout it records the
 * child's WINDOW-coordinate rect into `tourAnchors`. Zero visual or
 * layout impact (`collapsable={false}` only forces a real native view
 * so `measureInWindow` has something to measure).
 */
import { useCallback, useEffect, useRef } from "react";
import { View, type ViewProps } from "react-native";
import { useTourAnchors } from "./tourAnchors";

export function TourTarget({
  id,
  children,
  ...rest
}: ViewProps & { id: string }) {
  const ref = useRef<View>(null);
  const setRect = useTourAnchors((s) => s.setRect);
  const remeasure = useTourAnchors((s) => s.remeasure);

  const measure = useCallback(() => {
    // measureInWindow (not onLayout coords) — the overlay is window-
    // absolute, so anchors must be too.
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) setRect(id, { x, y, width, height });
    });
  }, [id, setRect]);

  // Re-measure after programmatic scrolls (the tour scrolls each step's
  // section into view, which moves every window-coordinate rect).
  useEffect(() => {
    if (remeasure > 0) {
      const t = setTimeout(measure, 60);
      return () => clearTimeout(t);
    }
  }, [remeasure, measure]);

  return (
    <View ref={ref} collapsable={false} onLayout={measure} {...rest}>
      {children}
    </View>
  );
}
