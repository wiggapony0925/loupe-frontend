import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { fetchCollection } from "@/infrastructure/repositories/forensicRepository";
import { queryKeys } from "@/application/queries/queryKeys";
import { useVaultFilters } from "@/application/stores/vaultStore";

export function useFilteredCollection() {
  const { set, minGrade, query: searchTerm } = useVaultFilters();
  const setSet = useVaultFilters((s) => s.setSet);
  const query = useQuery({ queryKey: queryKeys.collection.list(), queryFn: fetchCollection });

  // Tokenise once; each token must hit somewhere in the haystack (AND match).
  // Empty/whitespace-only input short-circuits the text filter entirely so
  // typing then clearing the input restores the full set instantly.
  const tokens = useMemo(
    () =>
      searchTerm
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 0),
    [searchTerm],
  );

  // Copies are counted across the **unfiltered** collection so the "×2"
  // badge tells the truth even when one of the duplicates is hidden by
  // the active filter. cardId is the catalog FK — every graded copy of
  // the same printing shares it.
  const copiesByCardId = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of query.data ?? []) {
      map.set(c.cardId, (map.get(c.cardId) ?? 0) + 1);
    }
    return map;
  }, [query.data]);

  const cards = useMemo(() => {
    if (!query.data) return [];
    return query.data.filter((c) => {
      if (set !== "All" && c.set !== set) return false;
      if (c.grade < minGrade) return false;
      if (tokens.length > 0) {
        const haystack = `${c.title} ${c.set} ${c.year} psa ${c.grade.toFixed(1)}`.toLowerCase();
        for (const t of tokens) {
          if (!haystack.includes(t)) return false;
        }
      }
      return true;
    });
  }, [query.data, set, minGrade, tokens]);

  /** Total unique catalog cards owned (cardId-distinct). */
  const uniqueCount = copiesByCardId.size;

  // Set names the user actually owns — derived from the **unfiltered**
  // collection so tapping a Category chip never causes the chip row to
  // collapse to a single option (which would make the filter look like
  // it had wiped every other tag away).
  const availableSets = useMemo(() => {
    const seen = new Set<string>();
    for (const c of query.data ?? []) seen.add(c.set);
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [query.data]);

  // If the active set filter no longer corresponds to anything the user
  // owns (e.g. they just deleted their last Topps copy), silently reset
  // it to "All" so the list never appears empty for an invisible reason.
  // Runs after collection data loads — guarded on `query.data` so we don't
  // clobber the filter while the query is still pending.
  useEffect(() => {
    if (!query.data || set === "All") return;
    const owned = query.data.some((c) => c.set === set);
    if (!owned) setSet("All");
  }, [query.data, set, setSet]);

  return { ...query, cards, copiesByCardId, uniqueCount, availableSets };
}
