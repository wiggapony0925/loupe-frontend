/**
 * Scan-session store — the rolling tray of captures on the native scanner,
 * lifted out of the screen so it PERSISTS. The user can leave the scanner
 * (open a matched card, jump to another tab) and come back to exactly where
 * they left off instead of an empty tray — a scanning "session" that stays
 * put until they clear it or add the batch to their vault.
 *
 * Persisted to AsyncStorage so it even survives an app restart, but only the
 * MATCHED tiles are written: a "scanning" tile is mid-flight and a "missed"
 * one is a dead end, and both point at a temporary local photo file that the
 * OS may have already reaped — so on reload we keep just the resolved cards
 * (their art is a durable remote URL) and the chosen game.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { IdentifyCandidate, IdentifyTcgHint } from "@/infrastructure/repositories/identifyRepository";
import type { ScanSessionItem } from "@/presentation/features/scan/overlay";

/** Cap the tray so a long stack-scan stays light (matches the overlay cap). */
const MAX_ITEMS = 8;

interface ScanSessionState {
  items: ScanSessionItem[];
  tcgHint: IdentifyTcgHint;
  /** Append a capture. With `resolved` it lands "matched" (pHash cache hit);
   *  otherwise a "scanning" placeholder a later identify patches in place.
   *  Returns the new item id. */
  add: (
    photoUri: string,
    resolved?: { candidate: IdentifyCandidate; confidence: number },
  ) => string;
  patch: (id: string, patch: Partial<Omit<ScanSessionItem, "id">>) => void;
  remove: (id: string) => void;
  clear: () => void;
  setTcgHint: (t: IdentifyTcgHint) => void;
}

let seq = 0;

export const useScanSession = create<ScanSessionState>()(
  persist(
    (set) => ({
      items: [],
      tcgHint: null,
      add: (photoUri, resolved) => {
        const id = `${Date.now()}-${seq++}`;
        set((s) => ({
          items: [
            ...s.items,
            {
              id,
              photoUri,
              candidate: resolved?.candidate ?? null,
              identificationId: null,
              confidence: resolved?.confidence ?? null,
              status: resolved ? ("matched" as const) : ("scanning" as const),
            },
          ].slice(-MAX_ITEMS),
        }));
        return id;
      },
      patch: (id, patch) =>
        set((s) => ({
          items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
        })),
      remove: (id) => set((s) => ({ items: s.items.filter((it) => it.id !== id) })),
      clear: () => set({ items: [] }),
      setTcgHint: (tcgHint) => set({ tcgHint }),
    }),
    {
      name: "loupe.scanSession.v1",
      storage: createJSONStorage(() => AsyncStorage),
      // Only durable, resolved cards survive a reload (see file header).
      partialize: (s) => ({
        items: s.items.filter((it) => it.status === "matched" && it.candidate != null),
        tcgHint: s.tcgHint,
      }),
    },
  ),
);
