/**
 * TanStack hooks for the public Pokémon TCG API (pokemontcg.io).
 *
 * Long staleTime — set & card data rarely changes, and prices update
 * once a day upstream. We use 10 min here so a user re-opening the
 * identify screen doesn't refetch unnecessarily.
 *
 * The card hook accepts an `upstream_id` (e.g. `pokemontcg:base1-4`)
 * or a bare ID and silently skips when the prefix doesn't match.
 */

import { useQuery } from "@tanstack/react-query";
import {
  fetchPokemonTcgCard,
  fetchPokemonTcgSets,
  parsePokemonTcgId,
  type PokemonTcgCard,
  type PokemonTcgSet,
} from "@/infrastructure/http/pokemonTcgClient";
import { queryKeys } from "../queryKeys";

const TEN_MINUTES = 10 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;

/**
 * Fetch a single Pokémon TCG card by upstream identifier.
 *
 * Pass the raw `upstream_id` from an `IdentifyCandidate` — this hook
 * extracts the bare ID and only fires the request when the prefix is
 * `pokemontcg:` (or a bare `setcode-number`). Returns `data: undefined`
 * otherwise — no error, no spinner.
 */
export function usePokemonTcgCard(upstreamId: string | null | undefined) {
  const id = parsePokemonTcgId(upstreamId ?? null);
  return useQuery<PokemonTcgCard>({
    queryKey: queryKeys.pokemonTcg.card(id ?? "noop"),
    queryFn: () => fetchPokemonTcgCard(id!),
    enabled: !!id,
    staleTime: TEN_MINUTES,
    gcTime: ONE_DAY,
    // pokemontcg.io is rate-limited; don't retry storms on 429.
    retry: (failureCount, err) => {
      const status = (err as { status?: number })?.status;
      if (status === 429 || (status && status >= 500 && status < 600)) {
        return failureCount < 1;
      }
      return false;
    },
  });
}

/**
 * Returns every published Pokémon TCG set, newest first. Used to
 * power set-aware filters in identify / collection views.
 */
export function usePokemonTcgSets() {
  return useQuery<PokemonTcgSet[]>({
    queryKey: queryKeys.pokemonTcg.sets(),
    queryFn: fetchPokemonTcgSets,
    staleTime: ONE_DAY,
    gcTime: 7 * ONE_DAY,
  });
}

/**
 * Best available "market" price in USD for a card. Implementation
 * lives in `pokemonTcgClient` so it can be tested in isolation; this
 * re-export keeps the existing call sites working.
 */
export function extractMarketPriceUsd(card: PokemonTcgCard | undefined): number | null {
  if (!card) return null;
  const prices = card.tcgplayer?.prices ?? {};
  const order = [
    "holofoil",
    "normal",
    "reverseHolofoil",
    "1stEditionHolofoil",
    "1stEditionNormal",
    "unlimited",
    "unlimitedHolofoil",
  ];
  for (const key of order) {
    const bucket = prices[key];
    if (bucket?.market != null) return bucket.market;
    if (bucket?.mid != null) return bucket.mid;
  }
  const cm = card.cardmarket?.prices?.averageSellPrice;
  return cm ?? null;
}
