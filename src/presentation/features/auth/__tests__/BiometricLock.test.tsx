/**
 * The lock screen's layout, pinned.
 *
 * Reported as "the welcome jeffrey is on the same line, it all looks
 * terrible". It was: the greeting was one 29px string, `Welcome back,
 * ${name}`, in a container with NO horizontal padding, so it ran into both
 * screen edges and broke wherever the name happened to fall — a different,
 * equally bad wrap for every person who used it.
 *
 * The fix splits it into a quiet "Welcome back" eyebrow and the name on its
 * own line. These tests pin that split, because it is invisible to a
 * typecheck and to every other test in the suite: the screen had no coverage
 * at all before this file, which is how it shipped twice.
 */
import React from "react";
import { render, screen } from "@testing-library/react-native";
import { BiometricLock } from "../BiometricLock";

const mockAuth = {
  user: {
    id: "u1",
    email: "owner@example.test",
    display_name: "Jeffrey",
    avatar_url: null as string | null,
  },
  isAuthenticated: true,
  signOut: jest.fn(),
};

jest.mock("@/presentation/providers/AuthProvider", () => ({
  useAuth: () => mockAuth,
}));

// SafeAreaProvider renders NOTHING until it has measured insets, and in jest
// there is no native module to measure with — so without this the tree is an
// empty <Modal> and every assertion below fails for the wrong reason. The app
// solves the same problem with initialWindowMetrics, which is null here.
jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native");
  return {
    initialWindowMetrics: {
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 47, left: 0, right: 0, bottom: 34 },
    },
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    SafeAreaView: ({ children, style }: any) => <View style={style}>{children}</View>,
    useSafeAreaInsets: () => ({ top: 47, left: 0, right: 0, bottom: 34 }),
  };
});

jest.mock("@/infrastructure/biometrics", () => ({
  authenticateBiometric: jest.fn(async () => false),
  getBiometricCapability: jest.fn(async () => ({
    available: true,
    faceId: true,
    label: "Face ID",
  })),
}));

// The store is armed for this user so the lock actually renders.
jest.mock("@/application/stores/biometricStore", () => {
  const state = {
    deviceArmed: true,
    enabledBy: { u1: true } as Record<string, boolean>,
  };
  const useBiometrics = (sel: (s: typeof state) => unknown) => sel(state);
  useBiometrics.persist = {
    hasHydrated: () => true,
    onFinishHydration: () => () => {},
  };
  return { useBiometrics };
});

describe("BiometricLock greeting", () => {
  it("puts the name on its own line, not glued to the greeting", () => {
    render(<BiometricLock />);

    // The regression: a single node reading "Welcome back, Jeffrey".
    expect(screen.queryByText(/Welcome back,\s*Jeffrey/)).toBeNull();

    // Two separate nodes instead.
    expect(screen.getByText("Welcome back")).toBeTruthy();
    expect(screen.getByText("Jeffrey")).toBeTruthy();
  });

  it("shows a status the moment it appears", () => {
    render(<BiometricLock />);
    // "Looking…" rather than "Loupe is locked": the screen fires Face ID on
    // mount, so by the time it has painted it is already scanning. That is the
    // intended behaviour — a lock that waits to be asked is a lock people turn
    // off — and this assertion exists to say so rather than to be lenient.
    expect(screen.getByText("Looking…")).toBeTruthy();
  });

  it("offers a way in and a way out", () => {
    render(<BiometricLock />);
    expect(screen.getByLabelText("Unlock with Face ID")).toBeTruthy();
    expect(screen.getByLabelText("Sign out and use another account")).toBeTruthy();
  });
});
