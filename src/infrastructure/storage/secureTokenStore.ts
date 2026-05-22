/**
 * Secure persistence for auth tokens.
 *
 * Uses `expo-secure-store` (iOS Keychain / Android Keystore) on native, with
 * a graceful AsyncStorage fallback on web (SecureStore isn't available
 * there) and in unit tests where the native module isn't linked.
 *
 * Keep this surface tiny: get / set / clear, no listeners. AuthProvider is
 * the only legitimate caller.
 */
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const TOKEN_KEY = "loupe.auth.token";
export const REFRESH_KEY = "loupe.auth.refresh";

// SecureStore keys must match /^[A-Za-z0-9._-]+$/. Our keys already do.
const useSecure = Platform.OS === "ios" || Platform.OS === "android";

async function secureAvailable(): Promise<boolean> {
  if (!useSecure) return false;
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function getSecureItem(key: string): Promise<string | null> {
  try {
    if (await secureAvailable()) {
      return await SecureStore.getItemAsync(key);
    }
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  try {
    if (await secureAvailable()) {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      });
      return;
    }
    await AsyncStorage.setItem(key, value);
  } catch {
    /* non-fatal — storage may be unavailable in some test envs */
  }
}

export async function deleteSecureItem(key: string): Promise<void> {
  try {
    if (await secureAvailable()) {
      await SecureStore.deleteItemAsync(key);
      // Also clear any legacy AsyncStorage copy from before the migration.
      await AsyncStorage.removeItem(key).catch(() => {});
      return;
    }
    await AsyncStorage.removeItem(key);
  } catch {
    /* non-fatal */
  }
}
