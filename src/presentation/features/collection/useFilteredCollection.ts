import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { fetchCollection, fetchCollectionSummary } from "@/infrastructure/repositories/forensicRepository";
import { queryKeys } from "@/application/queries/queryKeys";
import { useVaultFilters } from "@/application/stores/vaultStore";
import { useAuth } from "@/presentation/providers/AuthProvider";
import type { CardSet } from "@/domain";

/**
 * Server-driven Vault list.
 *
 * Sends the active (debounced) filters to `/v1/grades` and lets the
 * backend do the SQL — keeps mobile snappy on 5k-card vaults where
 * client-side `.filter()` over the entire collection stalls the JS
 * thread for a noticeable beat.
 *
 * Aggregates that drive the header chips (unique-card count, loupe-
 * graded count, the Category chip row) are read from
 * `/v1/grades/summary` so they reflect the *whole* vault, not whatever
 * the current filter happens to expose.
 *
 * The hook degrades gracefully against a backend that hasn't deployed
 * the summary aggregates yet — it falls back to client-side derivation
 * over the (filtered) list so nothing crashes during the rollout
 * window.
 */
const DEBOUNCE_MS = 250;

export function useFilteredCollection() {
  const { isAuthenticated } = useAuth();
  const { set, minGrade, type, query: searchTerm } = useVaultFilters();
  const setSet = useVaultFilters((s) => s.setSet);

  // Debounce the free-text query so every keystroke doesn't fire a new
  // request. Set & grade filters apply immediately — they're rare,
  // intentional taps.
  const [debouncedQuery, setDebouncedQuery] = useState(searchTerm);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchTerm), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Map the Type filter to a backend `house` slug. "Raw" and "Loupe" both
  // live under `house=loupe` server-side — we narrow client-side using the
  // row's `condition` column (see post-fetch refinement below).
  const serverHouse =
    type === "All"
      ? undefined
      : type === "raw" || type === "loupe"
        ? "loupe"
        : type;

  const params = useMemo(
    () => ({
      q: debouncedQuery.trim() || undefined,
      set: set === "All" ? undefined : (set as string),
      house: serverHouse,
      // The Vault grade slider's "show everything" sentinel is 1 — sending
      // min_grade=1 to the backend would still match every grade ≥ 1,
      // which is correct but a wasted predicate. Drop it.
      minGrade: minGrade > 1 ? minGrade : undefined,
      sort: "recent" as const,
    }),
    [debouncedQuery, set, serverHouse, minGrade],
  );

  const query = useQuery({
    queryKey: queryKeys.collection.list(params),
    queryFn: () => fetchCollection(params),
    // Gate on auth so it doesn't fire before the stored token is attached on
    // cold boot (that race returned an empty vault until a pull-to-refresh).
    enabled: isAuthenticated,
    // Keep previous data visible while a new filter is in flight so the
    // list doesn't blank to a skeleton on every keystroke — feels much
    // closer to "instant" even on a slow network.
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  const summaryQuery = useQuery({
    queryKey: queryKeys.collection.summary(),
    queryFn: fetchCollectionSummary,
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  // Per-card copy counts — currently we only have the *filtered* page
  // available client-side, so this badge can under-count when a sibling
  // copy is hidden by the active filter. Backend `copies_owned` is
  // already correct for each row; we leave the local map as a
  // best-effort fallback for any UI that wants O(1) lookup.
  // Apply the Raw/Loupe client-side refinement on top of whatever the
  // backend returned. The server can't tell raw apart from a Loupe-graded
  // slab (both have `house=loupe`); the `condition` column is the
  // discriminator.
  const cards = useMemo(() => {
    const rows = query.data ?? [];
    if (type === "raw") return rows.filter((c) => c.condition != null);
    if (type === "loupe") return rows.filter((c) => c.condition == null);
    return rows;
  }, [query.data, type]);

  const copiesByCardId = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of cards) {
      map.set(c.cardId, (map.get(c.cardId) ?? 0) + 1);
    }
    return map;
  }, [cards]);

  /** Total unique catalog cards owned across the whole vault. */
  const uniqueCount =
    summaryQuery.data?.uniqueCardCount ?? copiesByCardId.size;

  /** Loupe-graded count across the whole vault. */
  const loupeGradedCount = summaryQuery.data?.loupeGradedCount ?? 0;

  // Set names the user actually owns. Prefer the server-computed list
  // (covers the whole vault) and fall back to deriving from whatever
  // page we have loaded so the chip row never disappears entirely on
  // older backends.
  const availableSets = useMemo<string[]>(() => {
    if (summaryQuery.data?.availableSets) {
      return summaryQuery.data.availableSets;
    }
    const seen = new Set<string>();
    for (const c of query.data ?? []) seen.add(c.set);
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [summaryQuery.data, query.data]);

  // If the active set filter no longer corresponds to anything the user
  // owns (e.g. they just deleted their last Topps copy), silently reset
  // it to "All" so the list never appears empty for an invisible reason.
  // Guarded on `summaryQuery.data` so we don't clobber the filter while
  // the truth table is still loading.
  useEffect(() => {
    if (!summaryQuery.data?.availableSets || set === "All") return;
    if (!summaryQuery.data.availableSets.includes(set as string)) {
      setSet("All" as CardSet | "All");
    }
  }, [summaryQuery.data, set, setSet]);

  return {
    ...query,
    cards,
    copiesByCardId,
    uniqueCount,
    loupeGradedCount,
    availableSets,
    /** Whole-vault aggregates (value, P/L, etc.). May be undefined while loading. */
    summary: summaryQuery.data,
  };
}
