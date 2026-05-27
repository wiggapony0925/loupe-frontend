/**
 * TanStack hooks for PokéAPI (pokeapi.co) — flavor data only.
 *
 * Both endpoints are static (species info doesn't change), so we treat
 * the data as effectively immortal: 7-day staleTime, 30-day gcTime.
 *
 * Both hooks accept a card-name-like string and use `extractSpeciesSlug`
 * to derive the lookup key. They no-op when the slug can't be inferred.
 */

import { useQuery } from "@tanstack/react-query";

import {
  extractSpeciesSlug,
  fetchPokemonBySpecies,
  fetchSpecies,
  type PokeApiPokemon,
  type PokeApiSpecies,
} from "@/infrastructure/http/pokeApiClient";

import { queryKeys } from "../queryKeys";

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export function usePokeApiPokemon(cardName: string | null | undefined) {
  const slug = extractSpeciesSlug(cardName);
  return useQuery<PokeApiPokemon>({
    queryKey: queryKeys.pokeApi.pokemon(slug ?? "noop"),
    queryFn: () => fetchPokemonBySpecies(slug!),
    enabled: !!slug,
    staleTime: SEVEN_DAYS,
    gcTime: THIRTY_DAYS,
    // 404 is expected for non-Pokémon cards (trainers, energy) — don't retry.
    retry: (failureCount, err) => {
      const status = (err as { status?: number })?.status;
      if (status === 404) return false;
      return failureCount < 1;
    },
  });
}

export function usePokeApiSpecies(cardName: string | null | undefined) {
  const slug = extractSpeciesSlug(cardName);
  return useQuery<PokeApiSpecies>({
    queryKey: queryKeys.pokeApi.species(slug ?? "noop"),
    queryFn: () => fetchSpecies(slug!),
    enabled: !!slug,
    staleTime: SEVEN_DAYS,
    gcTime: THIRTY_DAYS,
    retry: (failureCount, err) => {
      const status = (err as { status?: number })?.status;
      if (status === 404) return false;
      return failureCount < 1;
    },
  });
}
