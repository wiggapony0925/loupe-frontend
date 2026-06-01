/**
 * `useCanonicalCard` — fetches the unified `CanonicalCard` document
 * for a given card id.
 *
 * The canonical endpoint composes data from every provider we know
 * about for the card's TCG (pokemontcg.io / Scryfall / YGOPRODeck,
 * plus internal pricing, population, listings, comps, certs) into a
 * single provider-agnostic shape. Mirror lives in
 * `loupe-backend/app/schemas/canonical_card.py`.
 *
 * The lightweight `useCard` still backs hero/header rendering — it's
 * a single-table read. This hook is for downstream panels that want
 * cross-TCG attributes (Pokédex / MTG oracle / YGO stats) and
 * provider-aware pricing without branching on `tcg` themselves.
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import type { CanonicalCard } from "@/infrastructure/http/wire/canonicalCard";
import { queryKeys } from "../queryKeys";

const FIVE_MINUTES = 5 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

export function useCanonicalCard(id: string | null | undefined) {
  return useQuery<CanonicalCard>({
    queryKey: queryKeys.cards.canonical(id ?? ""),
    queryFn: () =>
      apiFetch<CanonicalCard>(ENDPOINTS.cards.canonical(id as string), {
        skipAuth: true,
      }),
    enabled: !!id,
    // Identity + attributes rarely change; pricing within canonical is
    // a snapshot at compose time. Backend cache controls freshness.
    staleTime: FIVE_MINUTES,
    gcTime: ONE_HOUR,
  });
}
