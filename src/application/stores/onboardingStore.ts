/**
 * onboardingStore — has THIS user seen the first-login home tour?
 *
 * Keyed by user id (not a device-wide boolean) so a shared device shows
 * the tour once per account, and signing back in never replays it.
 * Persisted to AsyncStorage; survives app restarts and app updates.
 *
 * `reset(userId)` re-arms the tour for one account — surfaced in
 * Settings as the admin-only "Replay login tutorial" row.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface OnboardingState {
  /** user id → true once the tour was completed OR skipped. */
  seenBy: Record<string, true>;
  hasSeen: (userId: string) => boolean;
  markSeen: (userId: string) => void;
  reset: (userId: string) => void;
}

export const useOnboarding = create<OnboardingState>()(
  persist(
    (set, get) => ({
      seenBy: {},
      hasSeen: (userId) => Boolean(get().seenBy[userId]),
      markSeen: (userId) =>
        set((s) => ({ seenBy: { ...s.seenBy, [userId]: true } })),
      reset: (userId) =>
        set((s) => {
          const next = { ...s.seenBy };
          delete next[userId];
          return { seenBy: next };
        }),
    }),
    {
      name: "loupe.onboarding.v1",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);
