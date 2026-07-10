/**
 * vaultSelectionStore — multi-select session semantics.
 *
 * The regression this guards: toggling "select all" off used to exit the
 * whole selection session; it must now keep the session open with an
 * empty set (X is the only explicit exit — auto-exit stays reserved for
 * individually deselecting the last card).
 */
import { useVaultSelection } from "@/application/stores/vaultSelectionStore";

const store = useVaultSelection;

function reset() {
  store.getState().clear();
  store.getState().registerChrome(null);
}

describe("vaultSelectionStore", () => {
  beforeEach(reset);

  it("beginWith enters select mode seeded with one id", () => {
    store.getState().beginWith("a");
    expect(store.getState().mode).toBe("select");
    expect([...store.getState().selected]).toEqual(["a"]);
  });

  it("toggle adds and removes ids while in select mode", () => {
    store.getState().beginWith("a");
    store.getState().toggle("b");
    expect([...store.getState().selected].sort()).toEqual(["a", "b"]);
    store.getState().toggle("b");
    expect([...store.getState().selected]).toEqual(["a"]);
  });

  it("toggle is a no-op when idle", () => {
    store.getState().toggle("a");
    expect(store.getState().mode).toBe("idle");
    expect(store.getState().selected.size).toBe(0);
  });

  it("individually deselecting the last card auto-exits the session", () => {
    store.getState().beginWith("a");
    store.getState().toggle("a");
    expect(store.getState().mode).toBe("idle");
  });

  it("selectMany replaces the staged set and enters select mode", () => {
    store.getState().selectMany(["a", "b", "c"]);
    expect(store.getState().mode).toBe("select");
    expect(store.getState().selected.size).toBe(3);
  });

  it("selectMany([]) keeps the session OPEN with an empty set (select-all toggle-off)", () => {
    store.getState().selectMany(["a", "b"]);
    store.getState().selectMany([]);
    expect(store.getState().mode).toBe("select");
    expect(store.getState().selected.size).toBe(0);
  });

  it("clear exits the session and resets busy", () => {
    store.getState().selectMany(["a"]);
    store.getState().setBusy(true);
    store.getState().clear();
    expect(store.getState().mode).toBe("idle");
    expect(store.getState().selected.size).toBe(0);
    expect(store.getState().busy).toBe(false);
  });

  it("requestOrganize/requestRemove fire only with a non-empty, non-busy selection", () => {
    const onOrganize = jest.fn();
    const onRemove = jest.fn();
    store.getState().registerChrome({ onOrganize, onRemove });

    // Empty selection → guarded.
    store.getState().requestOrganize();
    store.getState().requestRemove();
    expect(onOrganize).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();

    store.getState().selectMany(["a"]);
    store.getState().requestOrganize();
    store.getState().requestRemove();
    expect(onOrganize).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledTimes(1);

    // Busy → guarded again.
    store.getState().setBusy(true);
    store.getState().requestOrganize();
    store.getState().requestRemove();
    expect(onOrganize).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("requestSelectAll fires the registered handler unless busy", () => {
    const onSelectAll = jest.fn();
    store.getState().registerChrome({
      onOrganize: jest.fn(),
      onRemove: jest.fn(),
      onSelectAll,
    });

    // Works even with an empty selection (that's how you select all).
    store.getState().requestSelectAll();
    expect(onSelectAll).toHaveBeenCalledTimes(1);

    store.getState().setBusy(true);
    store.getState().requestSelectAll();
    expect(onSelectAll).toHaveBeenCalledTimes(1);
  });

  it("select-all toggle flow: all → none → all keeps one continuous session", () => {
    const visible = ["a", "b", "c"];
    // User long-pressed "a", then hits select-all.
    store.getState().beginWith("a");
    store.getState().selectMany(visible);
    expect(store.getState().selected.size).toBe(3);
    // Second tap: deselect everything, session stays.
    store.getState().selectMany([]);
    expect(store.getState().mode).toBe("select");
    // Third tap: select all again.
    store.getState().selectMany(visible);
    expect(store.getState().mode).toBe("select");
    expect(store.getState().selected.size).toBe(3);
  });
});
