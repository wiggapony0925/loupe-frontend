/**
 * Thin typed client over the public Pokémon TCG API (v2).
 *
 * Docs: https://docs.pokemontcg.io/
 * Anonymous: 1 000 requests / day, 30 / minute.
 * With `EXPO_PUBLIC_POKEMONTCG_API_KEY`: 20 000 / day.
 *
 * We deliberately use native `fetch` (rather than the workspace `client`
 * wrapper) because:
 *   - This is a third-party API: no envelope, no auth header, no telemetry.
 *   - Errors should NOT be surfaced through our backend error sink.
 *
 * All functions throw `PokemonTcgError` on non-2xx; the React Query
 * hooks in `application/queries/pokemonTcg/` decide whether to retry
 * based on `err.status`.
 */

const BASE = "https://api.pokemontcg.io/v2";

/** Optional API key; bumps quota from 1k/day → 20k/day. */
const API_KEY = process.env.EXPO_PUBLIC_POKEMONTCG_API_KEY ?? null;

export interface PokemonTcgPriceBucket {
  low?: number | null;
  mid?: number | null;
  high?: number | null;
  market?: number | null;
  directLow?: number | null;
}

export interface PokemonTcgTcgPlayerPrices {
  url?: string;
  updatedAt?: string;
  prices?: Record<string, PokemonTcgPriceBucket | undefined>;
}

export interface PokemonTcgCardMarketPrices {
  url?: string;
  updatedAt?: string;
  prices?: {
    averageSellPrice?: number | null;
    lowPrice?: number | null;
    trendPrice?: number | null;
    avg1?: number | null;
    avg7?: number | null;
    avg30?: number | null;
  };
}

export interface PokemonTcgSet {
  id: string;
  name: string;
  series: string;
  printedTotal?: number;
  total?: number;
  legalities?: Record<string, string>;
  ptcgoCode?: string;
  releaseDate?: string;
  updatedAt?: string;
  images?: { symbol?: string; logo?: string };
}

export interface PokemonTcgCard {
  id: string;
  name: string;
  supertype?: string;
  subtypes?: string[];
  hp?: string;
  types?: string[];
  number?: string;
  rarity?: string;
  set?: PokemonTcgSet;
  images?: { small?: string; large?: string };
  tcgplayer?: PokemonTcgTcgPlayerPrices;
  cardmarket?: PokemonTcgCardMarketPrices;
  nationalPokedexNumbers?: number[];
  artist?: string;
  flavorText?: string;
}

export class PokemonTcgError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "PokemonTcgError";
    this.status = status;
  }
}

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/json" };
  if (API_KEY) h["X-Api-Key"] = API_KEY;
  return h;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders() });
  if (!res.ok) {
    throw new PokemonTcgError(`pokemontcg ${path} → ${res.status}`, res.status);
  }
  return (await res.json()) as T;
}

/**
 * Parse an `upstream_id` from an `IdentifyCandidate` into a bare
 * pokemontcg.io card ID. Accepts:
 *   - `pokemontcg:base1-4` (preferred)
 *   - `base1-4`            (bare)
 * Returns `null` for everything else (e.g. `scryfall:…`, `ygoprodeck:…`).
 */
export function parsePokemonTcgId(upstreamId: string | null): string | null {
  if (!upstreamId) return null;
  const trimmed = upstreamId.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("pokemontcg:")) {
    const id = trimmed.slice("pokemontcg:".length);
    return id || null;
  }
  // Bare `setcode-number` (e.g. `base1-4`, `swsh1-1`). Pokémon TCG IDs
  // are always `<setid>-<number>` where setid is alphanumeric and
  // number can include alphanumerics for promos.
  if (/^[a-z0-9]+-[a-z0-9]+$/i.test(trimmed)) {
    return trimmed;
  }
  return null;
}

export async function fetchPokemonTcgCard(id: string): Promise<PokemonTcgCard> {
  const json = await getJson<{ data: PokemonTcgCard }>(`/cards/${encodeURIComponent(id)}`);
  return json.data;
}

export async function fetchPokemonTcgSets(): Promise<PokemonTcgSet[]> {
  // Sort newest first; orderBy is documented but harmless on older sets.
  const json = await getJson<{ data: PokemonTcgSet[] }>(`/sets?orderBy=-releaseDate&pageSize=250`);
  return json.data;
}

export async function fetchPokemonTcgSearch(
  q: string,
  page = 1,
  pageSize = 20,
): Promise<{ data: PokemonTcgCard[]; totalCount: number }> {
  const params = new URLSearchParams({
    q,
    page: String(page),
    pageSize: String(pageSize),
  });
  return getJson(`/cards?${params.toString()}`);
}

/**
 * Best available "market" price in USD for a card.
 *
 * Resolution order (matches what TCGplayer surfaces on their own UI):
 *   1. TCGplayer holofoil / normal / reverseHolofoil / 1stEdition* / unlimited
 *      (`market`, then `mid`)
 *   2. Cardmarket `averageSellPrice` (EUR treated as USD-equivalent — a
 *      ~5% delta isn't worth a live FX call for a display fallback)
 *
 * Pure helper — lives in the client module so it can be unit-tested
 * without dragging in React Query / Expo. Re-exported from the hook
 * module for ergonomic imports in UI code.
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
