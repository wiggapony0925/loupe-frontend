/**
 * The contract every publish surface relies on.
 *
 * The important one is the third test: a refusal must NOT wipe the draft.
 * Most refused posts are one word away from fine, and throwing away what
 * someone wrote is punitive — so the hook reports the reason and leaves the
 * caller's state entirely alone.
 */
import { act, renderHook } from "@testing-library/react-native";
import { refusalFrom, useModeratedSubmit } from "../useModeratedSubmit";

type Handlers = {
  onSuccess?: (data: unknown) => void;
  onError?: (err: Error) => void;
};

/** A stand-in for a React-Query mutation, so the hook is tested alone. */
function fakeMutation(behaviour: "ok" | Error) {
  return {
    isPending: false,
    mutate: (_vars: unknown, handlers?: Handlers) => {
      if (behaviour === "ok") handlers?.onSuccess?.({});
      else handlers?.onError?.(behaviour);
    },
  } as never;
}

function refused(message: string) {
  return Object.assign(new Error(message), { status: 422 });
}

describe("refusalFrom", () => {
  it("recognises a 422 as a moderation refusal", () => {
    expect(refusalFrom(refused("Keep it about the cards."))).toBe(
      "Keep it about the cards.",
    );
  });

  it("matches on STATUS, not on message text", () => {
    // The copy is the backend's to change — each surface words it
    // differently — so only the status is a stable contract.
    const weird = Object.assign(new Error("anything at all"), { status: 422 });
    expect(refusalFrom(weird)).toBe("anything at all");
  });

  it("leaves ordinary failures alone", () => {
    expect(refusalFrom(Object.assign(new Error("offline"), { status: 500 }))).toBeNull();
    expect(refusalFrom(new Error("no status"))).toBeNull();
  });

  it("falls back to a usable line when the server sends no message", () => {
    expect(refusalFrom(Object.assign(new Error(""), { status: 422 }))).toContain(
      "community rules",
    );
  });
});

describe("useModeratedSubmit", () => {
  it("surfaces the server's own explanation on a refusal", () => {
    const onBlocked = jest.fn();
    const { result } = renderHook(() =>
      useModeratedSubmit(fakeMutation(refused("Keep it about the cards.")), {
        onBlocked,
      }),
    );

    act(() => result.current.submit({}));

    expect(result.current.refusal).toBe("Keep it about the cards.");
    expect(onBlocked).toHaveBeenCalledWith("Keep it about the cards.");
    // A refusal is NOT an error state — the request worked, the answer was no.
    expect(result.current.error).toBeNull();
  });

  it("reports a network failure as an error, not a refusal", () => {
    const { result } = renderHook(() =>
      useModeratedSubmit(fakeMutation(new Error("offline"))),
    );
    act(() => result.current.submit({}));
    expect(result.current.refusal).toBeNull();
    expect(result.current.error?.message).toBe("offline");
  });

  it("clears the refusal when the user edits", () => {
    const { result } = renderHook(() =>
      useModeratedSubmit(fakeMutation(refused("no"))),
    );
    act(() => result.current.submit({}));
    expect(result.current.refusal).toBe("no");

    act(() => result.current.dismiss());
    expect(result.current.refusal).toBeNull();
  });

  it("calls onDone when it publishes, and never onBlocked", () => {
    const onDone = jest.fn();
    const onBlocked = jest.fn();
    const { result } = renderHook(() =>
      useModeratedSubmit(fakeMutation("ok"), { onDone, onBlocked }),
    );
    act(() => result.current.submit({}));
    expect(onDone).toHaveBeenCalled();
    expect(onBlocked).not.toHaveBeenCalled();
    // Queued-for-review is invisible to the author on purpose: the post is
    // live, and "under review" for something that published would be untrue.
    expect(result.current.refusal).toBeNull();
  });
});
