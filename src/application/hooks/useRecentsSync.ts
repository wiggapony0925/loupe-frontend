/**
 * Cross-device sync for recent searches (+ preserve recently-viewed). On
 * sign-in we pull the server copy, merge it with the device-local searches,
 * and push the merged list back; while signed in, local changes debounce up.
 * `viewed` is preserved verbatim (the web populates it) so a mobile PUT never
 * wipes it. Best-effort — failures stay silent.
 */
import { useEffect, useRef } from "react";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import { useAuth } from "@/presentation/providers/AuthProvider";
import {
  useRecentSearches,
  type RecentViewed,
} from "@/application/stores/recentSearchesStore";

const MAX_SEARCHES = 8;

interface RecentsWire {
  searches: string[];
  viewed: RecentViewed[];
}

function mergeSearches(local: string[], server: string[]): string[] {
  const out: string[] = [];
  for (const s of [...local, ...server]) {
    if (s && !out.some((x) => x.toLowerCase() === s.toLowerCase())) out.push(s);
    if (out.length >= MAX_SEARCHES) break;
  }
  return out;
}

export function useRecentsSync(): void {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const pulledFor = useRef<string | null>(null);

  // Pull + merge on sign-in (once per user).
  useEffect(() => {
    if (!userId) {
      pulledFor.current = null;
      return;
    }
    if (pulledFor.current === userId) return;
    pulledFor.current = userId;
    let cancelled = false;
    void (async () => {
      try {
        const server = await apiFetch<RecentsWire>(ENDPOINTS.me.recents);
        if (cancelled) return;
        const local = useRecentSearches.getState();
        const searches = mergeSearches(local.items, server.searches ?? []);
        const viewed = server.viewed ?? local.viewed ?? [];
        useRecentSearches.getState().hydrate(searches, viewed);
        await apiFetch(ENDPOINTS.me.recents, {
          method: "PUT",
          json: { searches, viewed },
        });
      } catch {
        /* offline / not authed yet — keep device-local */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Debounced push of local changes while signed in.
  useEffect(() => {
    if (!userId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = useRecentSearches.subscribe((state) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void apiFetch(ENDPOINTS.me.recents, {
          method: "PUT",
          json: { searches: state.items, viewed: state.viewed },
        }).catch(() => {});
      }, 1500);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, [userId]);
}
