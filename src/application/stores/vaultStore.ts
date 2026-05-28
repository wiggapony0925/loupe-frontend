import { create } from "zustand";
import type { CardSet } from "@/domain";

/**
 * Type filter buckets. "Raw" is special-cased: the backend models raw
 * cards as `house == loupe` + a `condition` value, so we still send
 * `house=loupe` to the API but additionally filter client-side for
 * `condition != null` (and vice-versa for the Loupe-graded bucket).
 */
export type VaultType = "All" | "loupe" | "raw" | "psa" | "bgs" | "cgc" | "sgc";

interface VaultFiltersState {
  set: CardSet | "All";
  minGrade: number;
  /** Grading-house / raw bucket — see `VaultType`. */
  type: VaultType;
  /** Free-text query — substring-matched against title/set/year/grade. */
  query: string;
  setSet: (s: CardSet | "All") => void;
  setMinGrade: (g: number) => void;
  setType: (t: VaultType) => void;
  setQuery: (q: string) => void;
  reset: () => void;
}

export const useVaultFilters = create<VaultFiltersState>((set) => ({
  set: "All",
  minGrade: 1,
  type: "All",
  query: "",
  setSet: (s) => set({ set: s }),
  setMinGrade: (g) => set({ minGrade: g }),
  setType: (t) => set({ type: t }),
  setQuery: (q) => set({ query: q }),
  reset: () => set({ set: "All", minGrade: 1, type: "All", query: "" }),
}));
