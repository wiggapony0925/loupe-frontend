/**
 * Island navbar state machine — presence stacking rules.
 *
 * These rules are what every island face relies on: last-present wins,
 * dismiss only removes your own face, and re-presenting an existing key
 * promotes it instead of duplicating it.
 */
import { useIslandNav, type IslandPresentation } from "../islandNavStore";

const face = (key: string): IslandPresentation => ({
  key,
  Content: () => null,
});

const top = () => {
  const { stack } = useIslandNav.getState();
  return stack[stack.length - 1] ?? null;
};

beforeEach(() => {
  useIslandNav.setState({ stack: [] });
});

test("empty stack means the default tab dial", () => {
  expect(top()).toBeNull();
});

test("last present wins; dismissing it reveals the one underneath", () => {
  const a = face("vault-selection");
  const b = face("community");
  useIslandNav.getState().present(a);
  useIslandNav.getState().present(b);
  expect(top()?.key).toBe("community");

  useIslandNav.getState().dismiss("community");
  expect(top()?.key).toBe("vault-selection");

  useIslandNav.getState().dismiss("vault-selection");
  expect(top()).toBeNull();
});

test("dismissing a covered face leaves the top face showing", () => {
  useIslandNav.getState().present(face("community"));
  useIslandNav.getState().present(face("vault-selection"));
  useIslandNav.getState().dismiss("community");
  expect(top()?.key).toBe("vault-selection");
});

test("re-presenting a key promotes it without duplicating", () => {
  useIslandNav.getState().present(face("community"));
  useIslandNav.getState().present(face("vault-selection"));
  useIslandNav.getState().present(face("community"));
  expect(top()?.key).toBe("community");
  expect(useIslandNav.getState().stack).toHaveLength(2);
});

test("dismissing an unknown key is a no-op", () => {
  useIslandNav.getState().present(face("community"));
  useIslandNav.getState().dismiss("nope");
  expect(top()?.key).toBe("community");
});
