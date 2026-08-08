/**
 * Pull-to-refresh spins for the GESTURE, never for a background fetch.
 *
 * Five screens bound `RefreshControl`'s `refreshing` to a query's
 * `isFetching`, so navigating to a tab yanked the spinner down and pushed
 * the page with it — the screen looked like it reloaded every time you
 * glanced at it. These pin the contract that replaced that.
 */
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { usePullToRefresh } from "../usePullToRefresh";

describe("usePullToRefresh", () => {
  it("starts idle — a mounted screen shows no spinner", () => {
    const { result } = renderHook(() => usePullToRefresh(() => Promise.resolve()));
    expect(result.current.refreshing).toBe(false);
  });

  it("spins while the gesture's work is in flight, then stops", async () => {
    let release!: () => void;
    const pending = new Promise<void>((r) => {
      release = r;
    });
    const { result } = renderHook(() => usePullToRefresh(() => pending));

    act(() => {
      void result.current.onRefresh();
    });
    await waitFor(() => expect(result.current.refreshing).toBe(true));

    await act(async () => {
      release();
      await pending;
    });
    await waitFor(() => expect(result.current.refreshing).toBe(false));
  });

  it("stops spinning even when the refresh throws", async () => {
    const { result } = renderHook(() =>
      usePullToRefresh(() => Promise.reject(new Error("offline"))),
    );
    await act(async () => {
      await result.current.onRefresh().catch(() => {});
    });
    await waitFor(() => expect(result.current.refreshing).toBe(false));
  });

  it("holds the spinner briefly so an instant refresh is still acknowledged", async () => {
    const { result } = renderHook(() => usePullToRefresh(() => undefined));
    const started = Date.now();
    await act(async () => {
      await result.current.onRefresh();
    });
    // A spinner that appears and vanishes in one frame reads as "nothing
    // happened" — the gesture deserves an acknowledgement.
    expect(Date.now() - started).toBeGreaterThanOrEqual(300);
    expect(result.current.refreshing).toBe(false);
  });
});
