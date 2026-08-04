/**
 * Which notifications this account has already seen.
 *
 * The backend has no read receipts, so "unread" is a local judgement. That's
 * fine for a badge — its job is to stop nagging once you've looked — but it
 * means the list has to be pruned: keeping every id forever would grow without
 * bound, and ids for items that have aged out of the feed are dead weight.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

/** Comfortably more than a feed ever shows, small enough to stay cheap. */
const MAX_REMEMBERED = 300;

interface NotificationsReadState {
  readIds: string[];
  markRead: (ids: string[]) => void;
  markAllRead: (ids: string[]) => void;
  reset: () => void;
}

export const useNotificationsRead = create<NotificationsReadState>()(
  persist(
    (set) => ({
      readIds: [],
      markRead: (ids) =>
        set((s) => ({
          // Newest-first, de-duped, capped. Order matters: the tail is what
          // gets dropped, so recently-read ids survive longest.
          readIds: [...ids, ...s.readIds]
            .filter((id, i, arr) => id && arr.indexOf(id) === i)
            .slice(0, MAX_REMEMBERED),
        })),
      markAllRead: (ids) =>
        set((s) => ({
          readIds: [...ids, ...s.readIds]
            .filter((id, i, arr) => id && arr.indexOf(id) === i)
            .slice(0, MAX_REMEMBERED),
        })),
      reset: () => set({ readIds: [] }),
    }),
    {
      name: "loupe.notificationsRead.v1",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
