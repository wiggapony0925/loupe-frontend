import { create } from "zustand";
import type { CardSet } from "@/types/domain";

interface VaultFiltersState {
  set: CardSet | "All";
  minGrade: number;
  setSet: (s: CardSet | "All") => void;
  setMinGrade: (g: number) => void;
  reset: () => void;
}

export const useVaultFilters = create<VaultFiltersState>((set) => ({
  set: "All",
  minGrade: 1,
  setSet: (s) => set({ set: s }),
  setMinGrade: (g) => set({ minGrade: g }),
  reset: () => set({ set: "All", minGrade: 1 }),
}));
