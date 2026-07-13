/**
 * Recent rails — the last few carousel "view more" filters the user opened.
 *
 * Rendered as replayable filter tags beside recent searches on the search
 * page, so a shelf someone dug into ("Grails & chase cards · Pokémon") is one
 * tap away later. Local-only on purpose: the recent-SEARCHES list is a plain
 * string array synced cross-device with the web (`useRecentSearches.hydrate`),
 * and structured rail entries must never ride — or wipe — that contract.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

const MAX_ITEMS = 4;

export interface RecentRail {
  /** Rail id, e.g. `grails` or the structural `trending` / `explore`. */
  id: string;
  /** Game scope — a TcgKey, or `all` (mixed trending only). */
  game: string;
  /** Interpolated display title, e.g. "Grails & chase cards". */
  title: string;
}

interface RecentRailsState {
  items: RecentRail[];
  push: (rail: RecentRail) => void;
  remove: (rail: RecentRail) => void;
  clear: () => void;
}

const sameRail = (a: RecentRail, b: RecentRail) =>
  a.id === b.id && a.game === b.game;

export const useRecentRails = create<RecentRailsState>()(
  persist(
    (set) => ({
      items: [],
      push: (rail) => {
        if (!rail.id || !rail.title) return;
        set((s) => ({
          items: [rail, ...s.items.filter((r) => !sameRail(r, rail))].slice(
            0,
            MAX_ITEMS,
          ),
        }));
      },
      remove: (rail) =>
        set((s) => ({ items: s.items.filter((r) => !sameRail(r, rail)) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: "loupe.recentRails.v1",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
