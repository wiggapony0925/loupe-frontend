import { create } from "zustand";

/**
 * Multi-select state for the Vault tab. A long-press on any holding
 * flips `mode` to `"select"` and stages that card's id in `selected`;
 * subsequent taps toggle membership instead of navigating to the card
 * detail. `clear()` exits selection mode entirely.
 *
 * Lives in its own store (rather than as fields on `vaultStore`) so
 * filter-only re-renders (search keystrokes, chip taps) don't
 * invalidate the selection state and vice-versa.
 */
interface VaultSelectionState {
  mode: "idle" | "select";
  /** Graded-card ids (NOT canonical card ids) staged for bulk action. */
  selected: Set<string>;
  /** Enter selection mode with a single seed id (the long-pressed card). */
  beginWith: (id: string) => void;
  /** Add or remove a single id; no-op when idle. */
  toggle: (id: string) => void;
  /** Exit selection mode and drop all selections. */
  clear: () => void;
}

export const useVaultSelection = create<VaultSelectionState>((set, get) => ({
  mode: "idle",
  selected: new Set<string>(),
  beginWith: (id) => set({ mode: "select", selected: new Set([id]) }),
  toggle: (id) => {
    if (get().mode !== "select") return;
    const next = new Set(get().selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    // Auto-exit selection mode when the user deselects the last card
    // — keeps the toolbar from lingering with a 0-count Delete button.
    if (next.size === 0) {
      set({ mode: "idle", selected: next });
    } else {
      set({ selected: next });
    }
  },
  clear: () => set({ mode: "idle", selected: new Set() }),
}));
