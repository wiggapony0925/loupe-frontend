import { create } from "zustand";

/**
 * Multi-select state for the Vault tab. A long-press on any holding
 * flips `mode` to `"select"` and stages that card's id in `selected`;
 * subsequent taps toggle membership instead of navigating to the card
 * detail. `clear()` exits selection mode entirely.
 *
 * Chrome actions (organize / remove) are registered by the Vault screen
 * so the floating island navbar can fire them without prop-drilling
 * through the tabs layout.
 *
 * Lives in its own store (rather than as fields on `vaultStore`) so
 * filter-only re-renders (search keystrokes, chip taps) don't
 * invalidate the selection state and vice-versa.
 */
type ChromeHandlers = {
  onOrganize: () => void;
  onRemove: () => void;
  /** Toggle select-all over the currently visible (filtered) holdings. */
  onSelectAll?: () => void;
};

interface VaultSelectionState {
  mode: "idle" | "select";
  /** Graded-card ids (NOT canonical card ids) staged for bulk action. */
  selected: Set<string>;
  /** True while a bulk remove mutation is in flight. */
  busy: boolean;
  /** Enter selection mode with a single seed id (the long-pressed card). */
  beginWith: (id: string) => void;
  /** Add or remove a single id; no-op when idle. */
  toggle: (id: string) => void;
  /** Replace the staged set wholesale (select-all). Empty array exits. */
  selectMany: (ids: string[]) => void;
  /** Exit selection mode and drop all selections. */
  clear: () => void;
  setBusy: (busy: boolean) => void;
  /** Vault screen registers sheet openers; pass null on unmount. */
  registerChrome: (handlers: ChromeHandlers | null) => void;
  requestOrganize: () => void;
  requestRemove: () => void;
  requestSelectAll: () => void;
}

let chromeHandlers: ChromeHandlers | null = null;

export const useVaultSelection = create<VaultSelectionState>((set, get) => ({
  mode: "idle",
  selected: new Set<string>(),
  busy: false,
  beginWith: (id) => set({ mode: "select", selected: new Set([id]), busy: false }),
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
      set({ mode: "idle", selected: next, busy: false });
    } else {
      set({ selected: next });
    }
  },
  selectMany: (ids) => {
    // Deselect-all (select-all toggled off) KEEPS the session open with an
    // empty set — X is the only explicit exit. Auto-exit stays reserved
    // for individually deselecting the last card (see `toggle`).
    set({ mode: "select", selected: new Set(ids) });
  },
  clear: () => set({ mode: "idle", selected: new Set(), busy: false }),
  setBusy: (busy) => set({ busy }),
  registerChrome: (handlers) => {
    chromeHandlers = handlers;
  },
  requestOrganize: () => {
    if (get().busy || get().selected.size === 0) return;
    chromeHandlers?.onOrganize();
  },
  requestRemove: () => {
    if (get().busy || get().selected.size === 0) return;
    chromeHandlers?.onRemove();
  },
  requestSelectAll: () => {
    if (get().busy) return;
    chromeHandlers?.onSelectAll?.();
  },
}));
