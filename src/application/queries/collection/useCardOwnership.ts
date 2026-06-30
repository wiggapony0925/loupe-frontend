/**
 * useCardOwnership — the signed-in user's copies of one card
 * (`GET /v1/cards/{id}/ownership`, auth-required).
 *
 * Composed server-side: every owned copy (a `GradedCard`) with grade/scan
 * data + per-holding and rolled-up cost basis, holding value, and unrealized
 * P/L. Gated on auth so a signed-out cold boot never fires a 401.
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type { CardOwnershipWire } from "@/infrastructure/http";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { queryKeys } from "../queryKeys";

export function useCardOwnership(id: string | null | undefined) {
  const { isAuthenticated } = useAuth();
  return useQuery<CardOwnershipWire>({
    queryKey: queryKeys.cards.ownership(id ?? ""),
    queryFn: () =>
      apiFetch<CardOwnershipWire>(ENDPOINTS.cards.ownership(id as string)),
    enabled: isAuthenticated && !!id,
    staleTime: 60_000,
  });
}
