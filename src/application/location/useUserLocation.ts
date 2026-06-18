/**
 * useUserLocation — foreground device location for the "Near You" carousel.
 *
 * Privacy-first: we NEVER request permission automatically. The hook reports
 * the current permission status and exposes a `request()` action the UI calls
 * only after the user taps "Enable Location". Coordinates live in component
 * state (never persisted) and are passed to the backend over HTTPS only.
 *
 * States surfaced to the UI:
 *   - status: "undetermined" | "granted" | "denied"
 *   - coords:  { lat, lng } | null
 *   - loading: true while a permission/position request is in flight
 *   - request(): prompts (or, if previously denied, deep-links to Settings)
 */
import { useCallback, useEffect, useState } from "react";
import { Linking, Platform } from "react-native";
import * as Location from "expo-location";

export type LocationStatus = "undetermined" | "granted" | "denied";

export interface UserCoords {
  lat: number;
  lng: number;
}

export interface UseUserLocationResult {
  status: LocationStatus;
  coords: UserCoords | null;
  loading: boolean;
  /** True once a permission decision is denied and cannot be re-prompted. */
  canOpenSettings: boolean;
  request: () => Promise<void>;
}

function toStatus(
  perm: Location.PermissionResponse | null,
): LocationStatus {
  if (!perm) return "undetermined";
  if (perm.granted) return "granted";
  if (perm.status === Location.PermissionStatus.UNDETERMINED) {
    return "undetermined";
  }
  return "denied";
}

export function useUserLocation(): UseUserLocationResult {
  const [status, setStatus] = useState<LocationStatus>("undetermined");
  const [coords, setCoords] = useState<UserCoords | null>(null);
  const [loading, setLoading] = useState(false);
  const [canAskAgain, setCanAskAgain] = useState(true);

  // Read the current permission state on mount WITHOUT prompting.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (cancelled) return;
        setStatus(toStatus(perm));
        setCanAskAgain(perm.canAskAgain);
        if (perm.granted) {
          await readPosition(cancelled);
        }
      } catch {
        // Leave as "undetermined"; the CTA will offer to enable.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const readPosition = useCallback(async (cancelled = false) => {
    try {
      // Last-known is instant and avoids a hang on the simulator / cold GPS;
      // fall through to a live fix only when there's no cached position. The
      // live read is raced against a timeout so a simulator with no set
      // location can never leave the UI stuck on a forever spinner.
      let pos = await Location.getLastKnownPositionAsync();
      if (!pos) {
        pos = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 12_000)),
        ]);
      }
      if (cancelled || !pos) return;
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      // Permission is granted but we couldn't read a fix right now (e.g. no
      // simulated location). Leave status as-is — never downgrade a granted
      // permission to "denied" just because the position read failed.
    }
  }, []);

  const request = useCallback(async () => {
    setLoading(true);
    try {
      // If iOS/Android already hard-denied and won't re-prompt, deep-link
      // the user to the OS settings instead of silently no-op'ing.
      const existing = await Location.getForegroundPermissionsAsync();
      if (!existing.granted && !existing.canAskAgain) {
        setStatus("denied");
        setCanAskAgain(false);
        if (Platform.OS === "ios") {
          await Linking.openURL("app-settings:");
        } else {
          await Linking.openSettings();
        }
        return;
      }

      const perm = await Location.requestForegroundPermissionsAsync();
      setStatus(toStatus(perm));
      setCanAskAgain(perm.canAskAgain);
      if (perm.granted) {
        await readPosition();
      }
    } catch {
      setStatus("denied");
    } finally {
      setLoading(false);
    }
  }, [readPosition]);

  return {
    status,
    coords,
    loading,
    canOpenSettings: status === "denied" && !canAskAgain,
    request,
  };
}
