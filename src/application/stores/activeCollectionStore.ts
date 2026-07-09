/**
 * activeCollectionStore — which portfolio (collection) the session is viewing,
 * mirroring how the display currency is owned (local store + server profile).
 *
 * `activeCollectionId === null` is the derived **All** view (everything owned).
 *
 * Two sources of truth, on purpose (same split as `useDisplayCurrency`):
 *   • the local zustand store (instant, offline-safe, drives every scoped query)
 *   • the user's server profile (`PATCH /v1/me/settings { active_collection_id }`)
 *     so the choice follows them to the webapp and their other devices.
 *
 * `useActiveCollectionProfileSync()` closes the loop: mounted once at the root,
 * it adopts the server's saved collection into the local store whenever they
 * drift (sign-in on a new device, or a switch made on the web).
 */
import { useCallback, useEffect } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  useUpdateUserSettings,
  useUserSettings,
} from "@/application/queries/auth/useUserSettings";
import { useAuth } from "@/presentation/providers/AuthProvider";

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

/**
 * Read + change the active portfolio from anywhere. Writing updates the local
 * store instantly AND persists to the profile (fire-and-forget) so the webapp
 * and other devices follow — exactly like `useDisplayCurrency`.
 */
export function useActiveCollection() {
  const collectionId = useActiveCollectionStore((s) => s.activeCollectionId);
  const setLocal = useActiveCollectionStore((s) => s.setActiveCollection);
  const { isAuthenticated } = useAuth();
  const updateSettings = useUpdateUserSettings();

  const setCollectionId = useCallback(
    (id: string | null) => {
      setLocal(id);
      // Persist to the profile so the webapp + other devices pick it up. The
      // local store already updated; the sync hook reconciles if this fails.
      if (isAuthenticated) {
        updateSettings.mutate({ active_collection_id: id });
      }
    },
    [setLocal, isAuthenticated, updateSettings],
  );

  return { collectionId, setCollectionId };
}

/**
 * One-way server → local adoption. The local store is the render source of
 * truth (scoped queries never wait on the network); the profile is durable.
 * Whenever the server reports a different saved collection (fresh sign-in,
 * webapp change), the local store follows it. Local changes don't bounce —
 * `setCollectionId` writes the server cache optimistically, so by the time this
 * re-runs the two already agree.
 */
export function useActiveCollectionProfileSync(): void {
  const { data: serverSettings } = useUserSettings();
  const localId = useActiveCollectionStore((s) => s.activeCollectionId);
  const setLocal = useActiveCollectionStore((s) => s.setActiveCollection);

  useEffect(() => {
    // `undefined` = not loaded yet; `null` = the server's "All". Only adopt
    // once the settings query has resolved, and only when they actually differ.
    if (serverSettings === undefined) return;
    const server = serverSettings.active_collection_id ?? null;
    if (server === localId) return;
    setLocal(server);
  }, [serverSettings, localId, setLocal]);
}
