/**
 * tourAnchors — window-coordinate rects for the home-tour highlights.
 *
 * `TourTarget` wrappers measure their child into this (non-persisted)
 * store; the `HomeTour` overlay reads them to draw the highlight ring
 * next to real UI instead of hardcoded offsets — so the tour stays
 * correct across device sizes and layout changes.
 */
import { create } from "zustand";

export interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TourAnchorsState {
  rects: Record<string, AnchorRect>;
  /** First rect ever recorded per id — captured at scroll offset 0, so
   *  step N's scroll target is `initial[N].y - initial[first].y`. */
  initialRects: Record<string, AnchorRect>;
  /** Bump to make every TourTarget re-measure (after a programmatic scroll). */
  remeasure: number;
  setRect: (id: string, rect: AnchorRect) => void;
  bumpRemeasure: () => void;
}

export const useTourAnchors = create<TourAnchorsState>()((set) => ({
  rects: {},
  initialRects: {},
  remeasure: 0,
  bumpRemeasure: () => set((s) => ({ remeasure: s.remeasure + 1 })),
  setRect: (id, rect) =>
    set((s) => {
      const prev = s.rects[id];
      // Layout callbacks fire often — only write on real movement so the
      // overlay doesn't re-render on every scroll-adjacent reflow.
      if (
        prev &&
        Math.abs(prev.x - rect.x) < 1 &&
        Math.abs(prev.y - rect.y) < 1 &&
        Math.abs(prev.width - rect.width) < 1 &&
        Math.abs(prev.height - rect.height) < 1
      ) {
        return s;
      }
      return {
        rects: { ...s.rects, [id]: rect },
        initialRects: s.initialRects[id]
          ? s.initialRects
          : { ...s.initialRects, [id]: rect },
      };
    }),
}));
