/**
 * Hold-to-select's reliability rests entirely on one property: the gesture
 * object must keep its identity across re-renders.
 *
 * Call sites build the handler inline per row (`() => enterSelection(id)`), so
 * its identity changes every render, and the vault re-renders constantly as
 * sparkline data streams in. When the gesture was rebuilt on each of those
 * renders, GestureDetector re-registered the native handler and any hold in
 * flight was silently discarded — the "works sometimes" bug.
 *
 * So these tests assert identity stability directly, and that a stable
 * gesture still calls the LATEST callback (the trap with the ref fix is
 * capturing a stale closure instead).
 */
import { renderHook } from "@testing-library/react-native";
import { useHoldGesture } from "../useHoldGesture";

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Medium: "medium" },
}));

/** Reach the handler RNGH would invoke on activation. */
function fireHold(gesture: ReturnType<typeof useHoldGesture>): void {
  // `onStart` is stored on the gesture's handler config.
  const onStart = (gesture as unknown as { handlers: { onStart?: () => void } })
    .handlers.onStart;
  onStart?.();
}

describe("useHoldGesture", () => {
  it("keeps ONE gesture object across renders with a fresh callback each time", () => {
    const { result, rerender } = renderHook(
      ({ cb }: { cb: () => void }) => useHoldGesture(cb),
      // A brand-new closure per render, exactly like the vault's row callbacks.
      { initialProps: { cb: () => {} } },
    );
    const first = result.current;

    rerender({ cb: () => {} });
    rerender({ cb: () => {} });

    // If this fails, holds die whenever the list re-renders mid-press.
    expect(result.current).toBe(first);
  });

  it("invokes the newest callback, not the one captured at mount", () => {
    const stale = jest.fn();
    const fresh = jest.fn();
    const { result, rerender } = renderHook(
      ({ cb }: { cb: () => void }) => useHoldGesture(cb),
      { initialProps: { cb: stale } },
    );

    rerender({ cb: fresh });
    fireHold(result.current);

    expect(fresh).toHaveBeenCalledTimes(1);
    expect(stale).not.toHaveBeenCalled();
  });

  it("rebuilds only when a handler appears or disappears", () => {
    const { result, rerender } = renderHook(
      ({ cb }: { cb?: () => void }) => useHoldGesture(cb),
      { initialProps: { cb: undefined as (() => void) | undefined } },
    );
    const disabled = result.current;

    rerender({ cb: () => {} });
    // Enabling is a real state change — a new object here is correct, and it
    // happens at most once per mode switch rather than per render.
    expect(result.current).not.toBe(disabled);

    const enabled = result.current;
    rerender({ cb: () => {} });
    expect(result.current).toBe(enabled);
  });

  it("does nothing when there is no handler", () => {
    const { result } = renderHook(() => useHoldGesture(undefined));
    expect(() => fireHold(result.current)).not.toThrow();
  });
});
