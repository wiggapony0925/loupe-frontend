import { create } from "zustand";

/**
 * Vault filter state — now multi-select, driving the filter sheet + the active-
 * filter chips above the holdings list. Empty arrays / default ranges mean "no
 * filter" (show everything). All filtering is applied server-side by
 * `useFilteredCollection` → `/v1/grades`.
 *
 * "Raw" is special-cased: the backend models raw cards as `house == loupe` +
 * a `condition`, so the hook sends `house=loupe` and narrows client-side.
 */
export type VaultType = "loupe" | "raw" | "psa" | "bgs" | "cgc" | "sgc";

export type VaultSort =
  | "recent"
  | "oldest"
  | "value_desc"
  | "value_asc"
  | "grade_desc"
  | "grade_asc";

export const GRADE_MIN = 1;
export const GRADE_MAX = 10;

const DEFAULTS = {
  houses: [] as VaultType[],
  sets: [] as string[],
  tags: [] as string[],
  gradeRange: [GRADE_MIN, GRADE_MAX] as [number, number],
  minValue: null as number | null,
  maxValue: null as number | null,
  sort: "recent" as VaultSort,
};

interface VaultFiltersState {
  /** Free-text query — substring-matched against title/set server-side. */
  query: string;
  /** Selected grading-house / raw buckets. Empty = all. */
  houses: VaultType[];
  /** Selected set names. Empty = all. */
  sets: string[];
  /** Selected user tags (ANY match). Empty = all. */
  tags: string[];
  /** Inclusive grade window; `[1, 10]` = unfiltered. */
  gradeRange: [number, number];
  minValue: number | null;
  maxValue: number | null;
  sort: VaultSort;

  setQuery: (q: string) => void;
  toggleHouse: (h: VaultType) => void;
  toggleSet: (s: string) => void;
  toggleTag: (t: string) => void;
  setGradeRange: (r: [number, number]) => void;
  setValueRange: (min: number | null, max: number | null) => void;
  setSort: (s: VaultSort) => void;
  /** Clear every filter (and the search query). */
  clearAll: () => void;
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

export const useVaultFilters = create<VaultFiltersState>((set) => ({
  query: "",
  ...DEFAULTS,
  setQuery: (q) => set({ query: q }),
  toggleHouse: (h) => set((s) => ({ houses: toggle(s.houses, h) })),
  toggleSet: (name) => set((s) => ({ sets: toggle(s.sets, name) })),
  toggleTag: (t) => set((s) => ({ tags: toggle(s.tags, t) })),
  setGradeRange: (r) => set({ gradeRange: r }),
  setValueRange: (minValue, maxValue) => set({ minValue, maxValue }),
  setSort: (sort) => set({ sort }),
  clearAll: () => set({ query: "", ...DEFAULTS }),
}));

/**
 * The number the "Filters" badge shows — how many distinct filter facets are
 * active. Grade window and value range each count once; the search query has
 * its own clear affordance, so it's excluded.
 */
export function activeFilterCount(s: VaultFiltersState): number {
  let n = s.houses.length + s.sets.length + s.tags.length;
  if (s.gradeRange[0] > GRADE_MIN || s.gradeRange[1] < GRADE_MAX) n += 1;
  if (s.minValue != null || s.maxValue != null) n += 1;
  return n;
}
