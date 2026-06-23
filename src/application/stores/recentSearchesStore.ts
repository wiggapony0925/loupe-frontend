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

/** A card/sealed product the user opened — synced from the web's "recently
 *  viewed" rail. Stored (not yet shown on mobile) so a sync PUT never wipes it. */
export interface RecentViewed {
  id: string;
  name: string;
  imageUrl?: string | null;
  setName?: string | null;
  kind: "card" | "sealed";
}

interface RecentSearchesState {
  items: string[];
  /** Cross-device recently-viewed (preserved through sync; web populates it). */
  viewed: RecentViewed[];
  push: (q: string) => void;
  remove: (q: string) => void;
  clear: () => void;
  /** Replace both lists from the sync layer (server-merged). */
  hydrate: (items: string[], viewed: RecentViewed[]) => void;
}

export const useRecentSearches = create<RecentSearchesState>()(
  persist(
    (set) => ({
      items: [],
      viewed: [],
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
      hydrate: (items, viewed) => set({ items, viewed }),
    }),
    {
      name: "loupe.recentSearches.v1",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
