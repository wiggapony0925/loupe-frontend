import { create } from "zustand";
import type { CardSet } from "@/domain";

interface VaultFiltersState {
  set: CardSet | "All";
  minGrade: number;
  /** Free-text query — substring-matched against title/set/year/grade. */
  query: string;
  setSet: (s: CardSet | "All") => void;
  setMinGrade: (g: number) => void;
  setQuery: (q: string) => void;
  reset: () => void;
}

export const useVaultFilters = create<VaultFiltersState>((set) => ({
  set: "All",
  minGrade: 1,
  query: "",
  setSet: (s) => set({ set: s }),
  setMinGrade: (g) => set({ minGrade: g }),
  setQuery: (q) => set({ query: q }),
  reset: () => set({ set: "All", minGrade: 1, query: "" }),
}));
