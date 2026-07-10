import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  fetchCollection,
  fetchCollectionCount,
  fetchCollectionSummary,
  type CollectionQueryParams,
} from "@/infrastructure/repositories/forensicRepository";
import { queryKeys } from "@/application/queries/queryKeys";
import {
  GRADE_MAX,
  GRADE_MIN,
  useVaultFilters,
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
 */
const DEBOUNCE_MS = 150;
const VAULT_PAGE_LIMIT = 300;

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
  const { collectionId } = useActiveCollection();

  const [debouncedQuery, setDebouncedQuery] = useState(searchTerm);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchTerm), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const params = useMemo<CollectionQueryParams>(
    () => ({
      q: debouncedQuery.trim() || undefined,
      houses: houses.length ? houses : undefined,
      sets: sets.length ? sets : undefined,
      minGrade: gradeRange[0] > GRADE_MIN ? gradeRange[0] : undefined,
      maxGrade: gradeRange[1] < GRADE_MAX ? gradeRange[1] : undefined,
      minValue: minValue ?? undefined,
      maxValue: maxValue ?? undefined,
      tags: tags.length ? tags : undefined,
      sort,
      collectionId: collectionId ?? undefined,
      limit: VAULT_PAGE_LIMIT,
    }),
    [debouncedQuery, houses, sets, gradeRange, minValue, maxValue, tags, sort, collectionId],
  );

  const countParams = useMemo(
    () => ({
      q: params.q,
      houses: params.houses,
      sets: params.sets,
      minGrade: params.minGrade,
      maxGrade: params.maxGrade,
      minValue: params.minValue,
      maxValue: params.maxValue,
      tags: params.tags,
      collectionId: params.collectionId,
    }),
    [params],
  );

  const query = useQuery({
    queryKey: queryKeys.collection.list(params),
    queryFn: () => fetchCollection(params),
    enabled: isAuthenticated,
    placeholderData: (prev) => prev,
    staleTime: 45_000,
  });

  const countQuery = useQuery({
    queryKey: queryKeys.collection.count(countParams),
    queryFn: () => fetchCollectionCount(countParams),
    enabled: isAuthenticated,
    placeholderData: (prev) => prev,
    staleTime: 45_000,
  });

  const summaryQuery = useQuery({
    queryKey: collectionId
      ? [...queryKeys.collection.summary(), collectionId]
      : queryKeys.collection.summary(),
    queryFn: () => fetchCollectionSummary(collectionId),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const cards = useMemo(() => query.data ?? [], [query.data]);

  const copiesByCardId = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of cards) {
      map.set(c.cardId, (map.get(c.cardId) ?? 0) + 1);
    }
    return map;
  }, [cards]);

  const uniqueCount = summaryQuery.data?.uniqueCardCount ?? copiesByCardId.size;
  const loupeGradedCount = summaryQuery.data?.loupeGradedCount ?? 0;

  const availableSets = useMemo<string[]>(() => {
    if (summaryQuery.data?.availableSets) {
      return summaryQuery.data.availableSets;
    }
    const seen = new Set<string>();
    for (const c of query.data ?? []) seen.add(c.set);
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [summaryQuery.data, query.data]);

  const availableTags = summaryQuery.data?.availableTags ?? [];
  const filteredCount = countQuery.data ?? cards.length;

  return {
    ...query,
    cards,
    copiesByCardId,
    uniqueCount,
    loupeGradedCount,
    availableSets,
    availableTags,
    filteredCount,
    isCountFetching: countQuery.isFetching,
    summary: summaryQuery.data,
  };
}
