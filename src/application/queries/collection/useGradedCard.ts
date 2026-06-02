/**
 * Single graded-card query — backs the forensic scan report (`/scan/[id]`).
 *
 * The scan flow's terminal WebSocket frame hands the UI a `graded_card_id`,
 * which is exactly the id this hook fetches. `GET /v1/grades/{id}` returns
 * the persisted grade, subgrades, house, value, and joined card metadata —
 * everything the report renders. No mocks: if the backend has no subgrades
 * for a row (manually entered holdings, third-party slabs), the report
 * degrades to the headline grade + value.
 */

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type { GradedCard } from "@/infrastructure/http";
import { queryKeys } from "../queryKeys";

export function useGradedCard(id: string | undefined) {
  return useQuery<GradedCard>({
    queryKey: queryKeys.grades.item(id ?? ""),
    queryFn: () => apiFetch<GradedCard>(ENDPOINTS.grades.item(id as string)),
    enabled: !!id,
    staleTime: 60_000,
  });
}
