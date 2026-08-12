/**
 * The lock's bookkeeping.
 *
 * The rules under test: enabling is per-ACCOUNT (a shared device locks
 * for the account that asked, not the roommate's), `deviceArmed` mirrors
 * "anyone on this device wants the lock" so a cold start can lock before
 * /me resolves, and disabling the last account disarms the device.
 */
import { useBiometrics } from "../biometricStore";

const reset = () =>
  useBiometrics.setState({ enabledBy: {}, promptSeenBy: {}, deviceArmed: false });

beforeEach(reset);

describe("biometricStore", () => {
  it("arms the device when any account enables", () => {
    useBiometrics.getState().setEnabled("user-a", true);
    expect(useBiometrics.getState().isEnabled("user-a")).toBe(true);
    expect(useBiometrics.getState().isEnabled("user-b")).toBe(false);
    expect(useBiometrics.getState().deviceArmed).toBe(true);
  });

  it("disarms only when the LAST account disables", () => {
    const s = useBiometrics.getState();
    s.setEnabled("user-a", true);
    s.setEnabled("user-b", true);
    useBiometrics.getState().setEnabled("user-a", false);
    expect(useBiometrics.getState().deviceArmed).toBe(true);
    useBiometrics.getState().setEnabled("user-b", false);
    expect(useBiometrics.getState().deviceArmed).toBe(false);
  });

  it("remembers the prompt was answered, per account", () => {
    useBiometrics.getState().markPromptSeen("user-a");
    expect(useBiometrics.getState().hasSeenPrompt("user-a")).toBe(true);
    expect(useBiometrics.getState().hasSeenPrompt("user-b")).toBe(false);
  });
});
