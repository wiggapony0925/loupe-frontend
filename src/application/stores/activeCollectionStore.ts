/**
 * activeCollectionStore — which portfolio (collection) the session is viewing,
 * mirroring how `settingsStore` owns the display currency.
 *
 * `activeCollectionId === null` is the derived **All** view (everything owned).
 * Persisted to AsyncStorage so the choice survives restarts. The backend does
 * all the scoping — every value surface (dashboard, analytics, vault) just
 * passes this id, so switching here re-scopes the whole app.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface ActiveCollectionState {
  /** null ⇒ the "All" portfolio (everything owned). */
  activeCollectionId: string | null;
  setActiveCollection: (id: string | null) => void;
}

export const useActiveCollectionStore = create<ActiveCollectionState>()(
  persist(
    (set) => ({
      activeCollectionId: null,
      setActiveCollection: (id) => set({ activeCollectionId: id }),
    }),
    {
      name: "loupe.activeCollection.v1",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/** Read + change the active portfolio from anywhere. */
export function useActiveCollection() {
  const collectionId = useActiveCollectionStore((s) => s.activeCollectionId);
  const setCollectionId = useActiveCollectionStore((s) => s.setActiveCollection);
  return { collectionId, setCollectionId };
}
