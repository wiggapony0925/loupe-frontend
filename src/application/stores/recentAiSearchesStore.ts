/**
 * Recent AI searches — the last few descriptions Loupe AI answered.
 *
 * Rendered as sparkle-tagged chips beside recent searches (truncated — the
 * tag hints the question, never the whole essay); tapping one re-enters AI
 * mode and asks again (which is instant: answers are cached server-side).
 * Local-only on purpose: the recent-SEARCHES list is a plain string array
 * synced cross-device with the web, and AI entries must not ride — or wipe —
 * that contract.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

const MAX_ITEMS = 5;

interface RecentAiSearchesState {
  items: string[];
  push: (q: string) => void;
  remove: (q: string) => void;
  clear: () => void;
}

export const useRecentAiSearches = create<RecentAiSearchesState>()(
  persist(
    (set) => ({
      items: [],
      push: (q) => {
        const trimmed = q.trim();
        if (trimmed.length < 3) return;
        set((s) => ({
          items: [
            trimmed,
            ...s.items.filter(
              (r) => r.toLowerCase() !== trimmed.toLowerCase(),
            ),
          ].slice(0, MAX_ITEMS),
        }));
      },
      remove: (q) => set((s) => ({ items: s.items.filter((r) => r !== q) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: "loupe.recentAiSearches.v1",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
