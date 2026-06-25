import { create } from "zustand";
import type { SubGrades } from "@loupe/grade";

/**
 * Ephemeral state for the Loupe Grade playground. Lives in a store (not local
 * component state) so the camera "measure centering" screen can write the
 * measured centering sub-grade back without prop-drilling or fragile route
 * params — the playground just re-renders with the new value.
 */
interface GradePlaygroundState {
  subs: SubGrades;
  setSub: (key: keyof SubGrades, value: number) => void;
  reset: () => void;
}

export const DEFAULT_SUBS: SubGrades = {
  centering: 8,
  corners: 8,
  edges: 8,
  surface: 8,
};

export const useGradePlaygroundStore = create<GradePlaygroundState>((set) => ({
  subs: { ...DEFAULT_SUBS },
  setSub: (key, value) =>
    set((s) => ({ subs: { ...s.subs, [key]: value } })),
  reset: () => set({ subs: { ...DEFAULT_SUBS } }),
}));
