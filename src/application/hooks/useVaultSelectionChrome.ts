/**
 * useVaultSelectionChrome — vault multi-select + island-navbar actions.
 *
 * Keeps the Vault screen and LoupeTabBar on one API without each
 * re-subscribing to half a dozen store fields by hand.
 */
import { useCallback, useEffect } from "react";
import { useVaultSelection } from "@/application/stores/vaultSelectionStore";

export function useVaultSelectionChrome() {
  const mode = useVaultSelection((s) => s.mode);
  const selected = useVaultSelection((s) => s.selected);
  const busy = useVaultSelection((s) => s.busy);
  const beginWith = useVaultSelection((s) => s.beginWith);
  const toggle = useVaultSelection((s) => s.toggle);
  const selectMany = useVaultSelection((s) => s.selectMany);
  const clear = useVaultSelection((s) => s.clear);
  const setBusy = useVaultSelection((s) => s.setBusy);
  const registerChrome = useVaultSelection((s) => s.registerChrome);
  const requestOrganize = useVaultSelection((s) => s.requestOrganize);
  const requestRemove = useVaultSelection((s) => s.requestRemove);
  const requestSelectAll = useVaultSelection((s) => s.requestSelectAll);

  const selecting = mode === "select";
  const count = selected.size;
  const canAct = selecting && count > 0 && !busy;

  return {
    selecting,
    selected,
    count,
    busy,
    canAct,
    beginWith,
    toggle,
    selectMany,
    clear,
    setBusy,
    registerChrome,
    requestOrganize,
    requestRemove,
    requestSelectAll,
  };
}

/**
 * Register organize/remove/select-all openers for the island navbar. Clears
 * on unmount so a stale Vault screen can't open sheets after navigate-away.
 */
export function useRegisterVaultSelectionChrome(handlers: {
  onOrganize: () => void;
  onRemove: () => void;
  onSelectAll?: () => void;
}) {
  const registerChrome = useVaultSelection((s) => s.registerChrome);
  const { onOrganize, onRemove, onSelectAll } = handlers;

  useEffect(() => {
    registerChrome({ onOrganize, onRemove, onSelectAll });
    return () => registerChrome(null);
  }, [registerChrome, onOrganize, onRemove, onSelectAll]);
}

/** Stable helpers for long-press / tap wiring on vault rows. */
export function useVaultSelectionGestures() {
  const beginWith = useVaultSelection((s) => s.beginWith);
  const toggle = useVaultSelection((s) => s.toggle);
  const selecting = useVaultSelection((s) => s.mode === "select");

  const enterSelection = useCallback(
    (id: string) => {
      beginWith(id);
    },
    [beginWith],
  );

  const tapToggle = useCallback(
    (id: string) => {
      toggle(id);
    },
    [toggle],
  );

  return { selecting, enterSelection, tapToggle };
}
