/**
 * Recent searches — last N user queries from the catalog search screen.
 *
 * Persisted to AsyncStorage so the list survives app restarts; capped at
 * MAX_ITEMS to keep storage and render cost trivial. We dedupe on insert
 * (most-recent-first) so repeat searches just move to the top.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

const MAX_ITEMS = 8;

interface RecentSearchesState {
  items: string[];
  push: (q: string) => void;
  remove: (q: string) => void;
  clear: () => void;
}

export const useRecentSearches = create<RecentSearchesState>()(
  persist(
    (set) => ({
      items: [],
      push: (q) => {
        const trimmed = q.trim();
        if (trimmed.length < 2) return;
        set((s) => ({
          items: [trimmed, ...s.items.filter((r) => r.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_ITEMS),
        }));
      },
      remove: (q) =>
        set((s) => ({ items: s.items.filter((r) => r !== q) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: "loupe.recentSearches.v1",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
