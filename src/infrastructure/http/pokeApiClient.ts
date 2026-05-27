/**
 * Thin typed client over PokéAPI v2 (pokeapi.co) — flavor data only.
 *
 * Docs: https://pokeapi.co/docs/v2
 * Auth: none. Generous public rate limit; we cache aggressively
 * via TanStack Query so most users never hit the network twice.
 *
 * 404s for non-species names (trainers, energy, unreleased forms) are
 * an EXPECTED outcome — the hooks turn this into a no-render in
 * `PokedexPanel`. We surface them as `PokeApiError` with `status=404`
 * so consumers can filter by status code.
 */

const BASE = "https://pokeapi.co/api/v2";

export interface PokeApiNamedRef {
  name: string;
  url: string;
}

export interface PokeApiFlavorText {
  flavor_text: string;
  language: PokeApiNamedRef;
  version: PokeApiNamedRef;
}

export interface PokeApiGenus {
  genus: string;
  language: PokeApiNamedRef;
}

export interface PokeApiSpecies {
  id: number;
  name: string;
  generation: PokeApiNamedRef;
  flavor_text_entries: PokeApiFlavorText[];
  genera: PokeApiGenus[];
  is_legendary: boolean;
  is_mythical: boolean;
  habitat: PokeApiNamedRef | null;
}

export interface PokeApiPokemonType {
  slot: number;
  type: PokeApiNamedRef;
}

export interface PokeApiPokemon {
  id: number;
  name: string;
  height: number; // decimetres
  weight: number; // hectograms
  types: PokeApiPokemonType[];
  sprites: {
    front_default: string | null;
    other?: {
      "official-artwork"?: { front_default: string | null };
      home?: { front_default: string | null };
    };
  };
}

export class PokeApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "PokeApiError";
    this.status = status;
  }
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new PokeApiError(`pokeapi ${path} → ${res.status}`, res.status);
  }
  return (await res.json()) as T;
}

export async function fetchPokemonBySpecies(slug: string): Promise<PokeApiPokemon> {
  return getJson(`/pokemon/${encodeURIComponent(slug)}`);
}

export async function fetchSpecies(slug: string): Promise<PokeApiSpecies> {
  return getJson(`/pokemon-species/${encodeURIComponent(slug)}`);
}

// Suffixes that appear AFTER the species name on TCG cards but aren't
// part of the PokéAPI slug. Sorted longest first so multi-word forms
// strip before single tokens.
const SUFFIX_PATTERNS = [
  /\s+tag\s+team$/i,
  /\s+amazing\s+rare$/i,
  /\s+vmax$/i,
  /\s+vstar$/i,
  /\s+v-?union$/i,
  /\s+v\b/i,
  /\s+ex$/i,
  /\s+gx$/i,
  /\s+break$/i,
  /\s+radiant$/i,
  /\s+shining$/i,
  /\s+delta$/i,
  /\s+prism\s+star$/i,
  /\s*\bpromo\b$/i,
  /\s+\(.*\)$/, // trailing parenthetical like "(Holo)"
];

const PREFIX_PATTERNS = [
  /^mega\s+/i,
  /^primal\s+/i,
  /^ultra\s+/i,
  /^dark\s+/i,
  /^light\s+/i,
  /^shadow\s+/i,
  /^team\s+rocket'?s\s+/i,
  /^ash'?s\s+/i,
];

/**
 * Best-effort: convert a printed card name into a PokéAPI species slug.
 *
 * Returns `null` for trainers, energies, items, or unrecognisable
 * strings so the hook can no-op without a request.
 *
 * Examples:
 *   "Charizard VMAX"           → "charizard"
 *   "Dark Tyranitar"           → "tyranitar"
 *   "Nidoran ♀"                → "nidoran-f"
 *   "Mr. Mime"                 → "mr-mime"
 *   "Tapu Koko"                → "tapu-koko"
 */
export function extractSpeciesSlug(name: string | null | undefined): string | null {
  if (!name) return null;
  let s = name.trim();
  if (!s) return null;

  // Replace gender symbols BEFORE punctuation strip.
  s = s.replace(/♀/g, " f").replace(/♂/g, " m");

  for (const p of PREFIX_PATTERNS) s = s.replace(p, "");
  for (const p of SUFFIX_PATTERNS) s = s.replace(p, "");

  s = s
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[.]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return null;
  const slug = s.replace(/\s+/g, "-");
  if (slug.length < 3) return null;
  return slug;
}

/**
 * Pick the most recent English flavor-text entry. Newer-game entries
 * tend to be the most polished, and the API roughly orders entries by
 * version release. Falls back to the first English entry if no clear
 * ordering exists.
 */
export function pickEnglishFlavorText(species: PokeApiSpecies): string | null {
  if (!species?.flavor_text_entries?.length) return null;
  const english = species.flavor_text_entries.filter(
    (e) => e.language?.name === "en",
  );
  if (!english.length) return null;
  const chosen = english[english.length - 1] ?? english[0];
  if (!chosen) return null;
  return chosen.flavor_text.replace(/[\f\n\r]+/g, " ").trim();
}
