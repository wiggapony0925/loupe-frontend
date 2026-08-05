/**
 * The 404 screen, mounted for real.
 *
 * `notFoundActions` already pins down *where* the buttons go; this pins down
 * that the screen renders them at all and that tapping one actually navigates.
 * A 404 is the least-exercised screen in the app — nobody opens it on purpose
 * — so a mount-time crash or a dead button could sit there for months.
 *
 * It also asserts the screen replaces rather than pushes: a dead end left in
 * the back stack means the system back gesture returns the user to the error.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { NOT_FOUND } from "@loupe/marketing";
import { NotFoundScreen } from "../NotFoundScreen";

/**
 * Reanimated 4 runs on a native worklets runtime that doesn't exist under
 * jest, so importing it fails the whole suite at load. Its shipped
 * `react-native-reanimated/mock` is no help — that file imports the real
 * module, and blows up the same way.
 *
 * So: a hand-stub of exactly the surface this tree touches (the screen's
 * entrance fade, and the aurora's drift). Animation is deliberately not what
 * these tests are about — structure and navigation are.
 */
jest.mock("react-native-reanimated", () => {
  // `require`, not `import` — jest hoists this factory above the import
  // block, so an ESM binding here would be in the temporal dead zone.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RN = require("react-native");
  const builder = { duration: () => builder, delay: () => builder };
  return {
    __esModule: true,
    default: { View: RN.View, Text: RN.Text, ScrollView: RN.ScrollView },
    FadeInDown: builder,
    useSharedValue: (v: number) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    // `true` also parks the aurora's infinite repeat loops, which would
    // otherwise leave timers running past the assertions.
    useReducedMotion: () => true,
    withRepeat: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    interpolate: () => 0,
    Easing: { inOut: () => () => 0, sin: () => 0 },
  };
});

// Reached via the theme palette's settings store. Same stub the store's own
// tests use — persistence isn't what's under test here.
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

// `mock`-prefixed so jest's hoisted factories may reference them.
const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
}));

const mockAuth = { isAuthenticated: true };
jest.mock("@/presentation/providers/AuthProvider", () => ({
  useAuth: () => mockAuth,
}));

beforeEach(() => {
  mockReplace.mockClear();
  mockPush.mockClear();
  mockAuth.isAuthenticated = true;
});

describe("NotFoundScreen — signed in", () => {
  it("explains itself with the copy shared with the website", () => {
    render(<NotFoundScreen />);
    expect(screen.getByText(NOT_FOUND.title)).toBeTruthy();
    expect(screen.getByText(NOT_FOUND.message)).toBeTruthy();
  });

  it("takes the user home, replacing the dead end", () => {
    render(<NotFoundScreen />);
    fireEvent.press(screen.getByText(NOT_FOUND.ctaHome));
    expect(mockReplace).toHaveBeenCalledWith("/");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("takes the user to browse", () => {
    render(<NotFoundScreen />);
    fireEvent.press(screen.getByText(NOT_FOUND.ctaBrowse));
    expect(mockReplace).toHaveBeenCalledWith("/search");
  });
});

describe("NotFoundScreen — signed out", () => {
  beforeEach(() => {
    mockAuth.isAuthenticated = false;
  });

  it("offers sign in instead of home", () => {
    render(<NotFoundScreen />);
    fireEvent.press(screen.getByText(NOT_FOUND.ctaSignedOut));
    expect(mockReplace).toHaveBeenCalledWith("/(auth)/welcome");
  });

  it("shows no button that the auth guard would bounce", () => {
    render(<NotFoundScreen />);
    expect(screen.queryByText(NOT_FOUND.ctaBrowse)).toBeNull();
    expect(screen.queryByText(NOT_FOUND.ctaHome)).toBeNull();
  });
});
