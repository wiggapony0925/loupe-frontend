import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { fetchCollection } from "@/infrastructure/repositories/forensicRepository";
import { queryKeys } from "@/application/queries/queryKeys";
import { useVaultFilters } from "@/application/stores/vaultStore";

export function useFilteredCollection() {
  const { set, minGrade } = useVaultFilters();
  const query = useQuery({ queryKey: queryKeys.collection.list(), queryFn: fetchCollection });

  const cards = useMemo(() => {
    if (!query.data) return [];
    return query.data.filter((c) => {
      if (set !== "All" && c.set !== set) return false;
      if (c.grade < minGrade) return false;
      return true;
    });
  }, [query.data, set, minGrade]);

  return { ...query, cards };
}
