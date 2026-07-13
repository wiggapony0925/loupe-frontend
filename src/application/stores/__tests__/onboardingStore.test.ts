/**
 * onboardingStore — the "seen the home tour" flag is per ACCOUNT.
 *
 * Completing/skipping marks only the signed-in user; another account on
 * the same device still gets its first-login tour; the admin "Replay
 * login tutorial" reset re-arms exactly one account.
 */
import { useOnboarding } from "@/application/stores/onboardingStore";

// AsyncStorage's node shim references `window`; the persistence layer is
// not under test here — the per-account logic is. (jest.mock is hoisted
// above imports at runtime.)
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

describe("onboardingStore", () => {
  beforeEach(() => {
    useOnboarding.setState({ seenBy: {} });
  });

  it("marks seen per user, not per device", () => {
    const s = useOnboarding.getState();
    expect(s.hasSeen("alice")).toBe(false);

    s.markSeen("alice");
    expect(useOnboarding.getState().hasSeen("alice")).toBe(true);
    // Bob on the same device still gets his tour.
    expect(useOnboarding.getState().hasSeen("bob")).toBe(false);
  });

  it("reset re-arms one account only", () => {
    const s = useOnboarding.getState();
    s.markSeen("alice");
    s.markSeen("bob");

    useOnboarding.getState().reset("alice");
    expect(useOnboarding.getState().hasSeen("alice")).toBe(false);
    expect(useOnboarding.getState().hasSeen("bob")).toBe(true);
  });

  it("marking seen twice is idempotent", () => {
    const s = useOnboarding.getState();
    s.markSeen("alice");
    s.markSeen("alice");
    expect(Object.keys(useOnboarding.getState().seenBy)).toEqual(["alice"]);
  });
});
