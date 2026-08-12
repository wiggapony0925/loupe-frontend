/**
 * Biometric unlock — the thin wrapper over expo-local-authentication.
 *
 * Two calls, no state: what CAN this device do, and one yes/no prompt.
 * Everything about whether the user WANTS it lives in biometricStore; the
 * lock screen and the setup page are the only real callers.
 *
 * `disableDeviceFallback` stays false on purpose: when Face ID misses
 * three times, iOS offers the device passcode — which is exactly what a
 * bank app does, and far better than stranding someone at a lock screen
 * because they're wearing a mask.
 */
import * as LocalAuthentication from "expo-local-authentication";
import { Platform } from "react-native";

export interface BiometricCapability {
  /** Hardware exists AND the user enrolled a face/finger in iOS Settings. */
  available: boolean;
  /** True when the primary method is Face ID (drives copy + iconography). */
  faceId: boolean;
  /** What to call it in UI: "Face ID" / "Touch ID" / "Biometric unlock". */
  label: string;
}

export async function getBiometricCapability(): Promise<BiometricCapability> {
  try {
    const [hasHardware, enrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    const faceId = types.includes(
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
    );
    const label =
      Platform.OS === "ios"
        ? faceId
          ? "Face ID"
          : "Touch ID"
        : "Biometric unlock";
    return { available: hasHardware && enrolled, faceId, label };
  } catch {
    return { available: false, faceId: false, label: "Biometric unlock" };
  }
}

/** One prompt. Resolves true only on a successful authentication. */
export async function authenticateBiometric(reason: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}
