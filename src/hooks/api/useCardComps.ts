/**
 * useCardComps — recent sold-comp sales for a card.
 * Server endpoint: `GET /v1/cards/{id}/comps`.
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";
import type { CompsResponseWire } from "@/api/types";

export interface UseCardCompsOptions {
  days?: number;
  grade?: number;
  house?: string;
  limit?: number;
}

export function useCardComps(
  id: string | null | undefined,
  opts: UseCardCompsOptions = {},
) {
  const days = opts.days ?? 90;
  const { grade, house, limit } = opts;
  return useQuery<CompsResponseWire>({
    queryKey: ["cards", "comps", id, days, grade ?? null, house ?? null, limit ?? null],
    queryFn: () => {
      const qs = new URLSearchParams({ days: String(days) });
      if (grade !== undefined) qs.set("grade", String(grade));
      if (house) qs.set("house", house);
      if (limit !== undefined) qs.set("limit", String(limit));
      return apiFetch<CompsResponseWire>(
        `${ENDPOINTS.cards.comps(id as string)}?${qs.toString()}`,
        { skipAuth: true },
      );
    },
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}
