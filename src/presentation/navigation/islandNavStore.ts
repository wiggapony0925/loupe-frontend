/**
 * Island navbar state machine.
 *
 * The floating glass pill at the bottom of the tab group is ONE control with
 * many faces: the tab dial by default, the vault multi-select toolbar while
 * holding cards, the community rail on the Community tab — and whatever comes
 * next. This store is the single authority on which face is showing, so the
 * tabs layout never needs to know about individual features.
 *
 * A feature declares its face ONCE as a module-level {@link IslandPresentation}
 * (stable identity, components — not elements — so the pill always renders
 * live state), then its screen drives visibility with the listening hook:
 *
 *   const COMMUNITY_ISLAND: IslandPresentation = {
 *     key: "community",
 *     Content: CommunityIslandContent,
 *   };
 *   // inside the screen:
 *   useIslandPresence(isFocused, COMMUNITY_ISLAND);
 *
 * Presences stack: the most recent `present()` wins, and dismissing a covered
 * presence just removes it from the stack. That makes overlapping modes (e.g.
 * entering vault-select while a page-level face is registered) resolve without
 * any feature knowing about another.
 */
import type React from "react";
import { useEffect } from "react";
import { create } from "zustand";

export interface IslandPresentation {
  /** Stable unique id for the face (also keys the crossfade animation). */
  key: string;
  /** Row rendered inside the glass pill in place of the tab dial. */
  Content: React.ComponentType;
  /** Optional bubble overlapping the pill's top-right corner (e.g. a count). */
  Badge?: React.ComponentType;
}

interface IslandNavState {
  /** Registered faces, oldest → newest; the last entry is showing. */
  stack: IslandPresentation[];
  /** Show a face (replaces a same-key entry, then moves it to the top). */
  present: (p: IslandPresentation) => void;
  /** Remove a face by key (no-op when absent). */
  dismiss: (key: string) => void;
}

export const useIslandNav = create<IslandNavState>((set) => ({
  stack: [],
  present: (p) =>
    set((s) => ({ stack: [...s.stack.filter((x) => x.key !== p.key), p] })),
  dismiss: (key) =>
    set((s) =>
      s.stack.some((x) => x.key === key)
        ? { stack: s.stack.filter((x) => x.key !== key) }
        : s,
    ),
}));

/** The face currently showing, or null → the default tab dial. */
export function useActiveIsland(): IslandPresentation | null {
  return useIslandNav((s) => s.stack[s.stack.length - 1] ?? null);
}

/**
 * The listening hook — keeps a face registered exactly while `active` is
 * true, and guarantees cleanup on unmount. Screens own their `active`
 * condition (focus, selection mode, anything); the pill just follows.
 */
export function useIslandPresence(
  active: boolean,
  presentation: IslandPresentation,
): void {
  const present = useIslandNav((s) => s.present);
  const dismiss = useIslandNav((s) => s.dismiss);
  useEffect(() => {
    if (!active) return undefined;
    present(presentation);
    return () => dismiss(presentation.key);
  }, [active, presentation, present, dismiss]);
}
