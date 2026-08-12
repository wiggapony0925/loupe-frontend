/**
 * biometricStore — who wants the Face ID lock, and have we asked?
 *
 * Keyed by user id like onboardingStore, so a shared device locks for the
 * account that enabled it and not for the one that didn't. `deviceArmed`
 * is the one deliberate denormalization: on a cold start the lock screen
 * must decide BEFORE `/me` has resolved a user id, so it mirrors "any
 * account on this device has the lock on". Worst case it shows the lock
 * to a co-user for the moment it takes `/me` to land — the lock then
 * stands down on its own. Locking a beat too eagerly is the right failure
 * direction for a lock.
 *
 * This gates the UI. The tokens themselves stay where they've always
 * lived — the iOS Keychain via expo-secure-store.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface BiometricState {
  /** user id → true when that account turned the lock on. */
  enabledBy: Record<string, true>;
  /** user id → true once the post-login "set up Face ID?" sheet was answered. */
  promptSeenBy: Record<string, true>;
  /** Any account on this device has the lock on — see header comment. */
  deviceArmed: boolean;
  isEnabled: (userId: string) => boolean;
  hasSeenPrompt: (userId: string) => boolean;
  setEnabled: (userId: string, on: boolean) => void;
  markPromptSeen: (userId: string) => void;
}

export const useBiometrics = create<BiometricState>()(
  persist(
    (set, get) => ({
      enabledBy: {},
      promptSeenBy: {},
      deviceArmed: false,
      isEnabled: (userId) => Boolean(get().enabledBy[userId]),
      hasSeenPrompt: (userId) => Boolean(get().promptSeenBy[userId]),
      setEnabled: (userId, on) =>
        set((s) => {
          const enabledBy = { ...s.enabledBy };
          if (on) enabledBy[userId] = true;
          else delete enabledBy[userId];
          return { enabledBy, deviceArmed: Object.keys(enabledBy).length > 0 };
        }),
      markPromptSeen: (userId) =>
        set((s) => ({
          promptSeenBy: { ...s.promptSeenBy, [userId]: true },
        })),
    }),
    {
      name: "loupe.biometrics.v1",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);
