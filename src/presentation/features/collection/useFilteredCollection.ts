import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  fetchCollection,
  fetchCollectionSummary,
  type CollectionQueryParams,
} from "@/infrastructure/repositories/forensicRepository";
import { queryKeys } from "@/application/queries/queryKeys";
import {
  GRADE_MAX,
  GRADE_MIN,
  useVaultFilters,
  type VaultType,
} from "@/application/stores/vaultStore";
import { useActiveCollection } from "@/application/stores/activeCollectionStore";
import { useAuth } from "@/presentation/providers/AuthProvider";

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
  const searchTerm = useVaultFilters((s) => s.query);
  const houses = useVaultFilters((s) => s.houses);
  const sets = useVaultFilters((s) => s.sets);
  const tags = useVaultFilters((s) => s.tags);
  const gradeRange = useVaultFilters((s) => s.gradeRange);
  const minValue = useVaultFilters((s) => s.minValue);
  const maxValue = useVaultFilters((s) => s.maxValue);
  const sort = useVaultFilters((s) => s.sort);
  // The active collection scopes the vault list too — same seam as the
  // dashboard/analytics; the backend filters server-side.
  const { collectionId } = useActiveCollection();

  // Debounce the free-text query so every keystroke doesn't fire a new
  // request. The other filters apply immediately — deliberate taps.
  const [debouncedQuery, setDebouncedQuery] = useState(searchTerm);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchTerm), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // "Raw" and "Loupe" both live under `house=loupe` server-side; collapse +
  // dedupe. The raw↔loupe split is narrowed client-side via `condition` below.
  const serverHouses = useMemo(() => {
    const out = new Set<string>();
    for (const h of houses) out.add(h === "raw" ? "loupe" : h);
    return [...out];
  }, [houses]);

  const params = useMemo<CollectionQueryParams>(
    () => ({
      q: debouncedQuery.trim() || undefined,
      houses: serverHouses.length ? serverHouses : undefined,
      // The slider's "show everything" bounds (1 / 10) are dropped — no wasted
      // predicate.
      minGrade: gradeRange[0] > GRADE_MIN ? gradeRange[0] : undefined,
      maxGrade: gradeRange[1] < GRADE_MAX ? gradeRange[1] : undefined,
      minValue: minValue ?? undefined,
      maxValue: maxValue ?? undefined,
      tags: tags.length ? tags : undefined,
      sort,
      collectionId: collectionId ?? undefined,
    }),
    [debouncedQuery, serverHouses, gradeRange, minValue, maxValue, tags, sort, collectionId],
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

  // The header aggregates (hero total, pills, available sets/tags) reflect
  // the WHOLE vault regardless of the house/grade/search filters — but they
  // DO follow the active collection, so "viewing Umbreon" shows Umbreon's
  // total. Scope by collection only (a distinct key per collection); "All"
  // keeps the shared key so it stays in sync with the command center.
  const summaryQuery = useQuery({
    queryKey: collectionId
      ? [...queryKeys.collection.summary(), collectionId]
      : queryKeys.collection.summary(),
    queryFn: () => fetchCollectionSummary(collectionId),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  // Per-card copy counts — currently we only have the *filtered* page
  // available client-side, so this badge can under-count when a sibling
  // copy is hidden by the active filter. Backend `copies_owned` is
  // already correct for each row; we leave the local map as a
  // best-effort fallback for any UI that wants O(1) lookup.
  // Client-side refinements the server can't do:
  //  • house buckets — the server can't tell a RAW card from a Loupe-graded
  //    slab (both are `house=loupe`); the `condition` column is the
  //    discriminator, so we split them here.
  //  • sets — the list endpoint takes a single set; multi-select is applied
  //    over the returned page (which covers the whole vault at limit 500).
  const cards = useMemo(() => {
    let rows = query.data ?? [];
    if (houses.length > 0) {
      const wanted = new Set<VaultType>(houses);
      rows = rows.filter((c) => {
        const bucket: VaultType =
          c.house !== "loupe" ? (c.house as VaultType) : c.condition != null ? "raw" : "loupe";
        return wanted.has(bucket);
      });
    }
    if (sets.length > 0) {
      const wantedSets = new Set(sets);
      rows = rows.filter((c) => wantedSets.has(c.set));
    }
    return rows;
  }, [query.data, houses, sets]);

  const copiesByCardId = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of cards) {
      map.set(c.cardId, (map.get(c.cardId) ?? 0) + 1);
    }
    return map;
  }, [cards]);

  /** Total unique catalog cards owned across the whole vault. */
  const uniqueCount = summaryQuery.data?.uniqueCardCount ?? copiesByCardId.size;

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

  // Distinct tags across the whole vault (server-computed) — powers the
  // filter sheet + the tag editor's suggestions.
  const availableTags = summaryQuery.data?.availableTags ?? [];

  return {
    ...query,
    cards,
    copiesByCardId,
    uniqueCount,
    loupeGradedCount,
    availableSets,
    availableTags,
    /** Whole-vault aggregates (value, P/L, etc.). May be undefined while loading. */
    summary: summaryQuery.data,
  };
}
