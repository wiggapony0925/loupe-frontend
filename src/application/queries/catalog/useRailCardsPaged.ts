/**
 * useRailCardsPaged — the FULL contents behind one discovery carousel,
 * truly paginated (`/v1/public/carousels/rail`).
 *
 * This is what the search page's rail-filter tag renders: the backend re-runs
 * the carousel's recipe lens (price band / rarity / sort) over the deep pool —
 * or the real catalog for `kind:"catalog"` rails — so "view more" shows every
 * match, not the rail's ~20-card teaser. `total` is the honest match count and
 * `fetchNextPage` appends the next slice. A 404 (e.g. yesterday's expired AI
 * shelf) surfaces as `isError`, which the UI treats as "this shelf is gone".
 */
import { useEffect } from "react";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import { prefetchCardImages } from "@/shared/cardImage";
import type { CarouselRailPageWire, TcgKey } from "@/infrastructure/http";
import { queryKeys } from "../queryKeys";

interface Options {
  game: TcgKey | "all";
  railId: string;
  pageSize?: number;
  enabled?: boolean;
}

export function useRailCardsPaged({
  game,
  railId,
  pageSize = 24,
  enabled = true,
}: Options) {
  const query = useInfiniteQuery({
    queryKey: queryKeys.cards.railPage(game, railId, pageSize),
    queryFn: ({ pageParam }) =>
      apiFetch<CarouselRailPageWire>(ENDPOINTS.publicCatalog.carouselRail, {
        query: {
          id: railId,
          game,
          page: pageParam,
          page_size: pageSize,
        },
        skipAuth: true,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((n, p) => n + (p.cards?.length ?? 0), 0);
      const hasRoom = loaded < (lastPage.total ?? 0);
      const lastNonEmpty = (lastPage.cards?.length ?? 0) > 0;
      return hasRoom && lastNonEmpty ? allPages.length + 1 : undefined;
    },
    enabled: enabled && railId.length > 0,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });

  // Warm the thumbnail disk cache for the newest page so tiles paint instantly.
  useEffect(() => {
    const pages = query.data?.pages;
    const last = pages?.[pages.length - 1];
    if (last?.cards) prefetchCardImages(last.cards);
  }, [query.data]);

  return query;
}
