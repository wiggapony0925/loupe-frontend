import { useEffect } from "react";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import { prefetchCardImages } from "@/shared/cardImage";
import type { PublicSearchResponse, TcgKey } from "@/infrastructure/http";
import { queryKeys } from "../queryKeys";

type SearchTcg = TcgKey | "all";

interface Options {
  q: string;
  tcg?: SearchTcg;
  /** Rows per page. Must be > 12 for the backend's true-pagination path. */
  pageSize?: number;
  enabled?: boolean;
}

/**
 * Deep, TRUE-paginated catalog search — the "see every printing" companion to
 * {@link useCardSearch}. Hits `/v1/public/search`, which walks the provider's
 * own pagination, so a popular name (Pikachu = 177 printings, Charizard = 400+)
 * is fully reachable instead of capped at a top-N. `total` is the real count,
 * and `fetchNextPage` appends the next slice.
 */
export function useCardSearchPaged({
  q,
  tcg = "all",
  pageSize = 24,
  enabled = true,
}: Options) {
  const trimmed = q.trim();
  const isEnabled = enabled && trimmed.length >= 2;

  const query = useInfiniteQuery({
    queryKey: queryKeys.cards.searchPaged(tcg, trimmed, pageSize),
    queryFn: ({ pageParam }) =>
      apiFetch<PublicSearchResponse>(ENDPOINTS.publicCatalog.search, {
        query: {
          q: trimmed,
          tcg,
          page: pageParam,
          page_size: pageSize,
          sort: "best",
        },
        skipAuth: true,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce(
        (n, p) => n + (p.results?.length ?? 0),
        0,
      );
      // More to fetch only while we haven't reached the provider's real total
      // AND the last page actually returned rows (guards a bad `total`).
      const hasRoom = loaded < (lastPage.total ?? 0);
      const lastNonEmpty = (lastPage.results?.length ?? 0) > 0;
      return hasRoom && lastNonEmpty ? allPages.length + 1 : undefined;
    },
    enabled: isEnabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  // Warm the thumbnail disk cache for the newest page so tiles paint instantly.
  useEffect(() => {
    const pages = query.data?.pages;
    const last = pages?.[pages.length - 1];
    if (last?.results) prefetchCardImages(last.results);
  }, [query.data]);

  return query;
}
