/**
 * Market data layer — pricing, comps, listings for a single card.
 *
 * Real-API-only. There is no `/v1/market/...` namespace on the backend;
 * `fetchMarketCatalog` adapts `/v1/cards/trending` into the
 * `CatalogEntry[]` shape the Search screen expects. The detail page
 * (`app/market/[id].tsx`) consumes `useCard` / `useCardMarket` etc.
 * directly, so `fetchMarketCard` is retained only for legacy callers
 * and will throw if invoked at runtime.
 */
import type { CollectionCard, PricePoint } from "@/types/domain";
import type { CardSearchResult, TrendingResponseWire } from "@/api/types";
import { ApiError, api } from "@/lib/apiClient";

export type MarketRange = "1D" | "1W" | "1M" | "3M" | "YTD" | "1Y" | "ALL";
export type MarketCondition = "raw" | "graded" | "pop";

export type GradingHouse = "PSA" | "CGC" | "BGS" | "SGC" | "TAG";

export interface GradedTier {
  house: GradingHouse;
  grade: number;
  priceUsd: number;
  pop: number;
  deltaPct: number;
}

export type MarketSource =
  | "TCGplayer"
  | "eBay"
  | "PWCC"
  | "Goldin"
  | "130point"
  | "PSA"
  | "CGC"
  | "PriceCharting"
  | "COMC"
  | "Card Ladder";

export interface MarketComp {
  id: string;
  source: MarketSource;
  priceUsd: number;
  date: string;
  detail?: string;
  kind: "sold" | "listing" | "index";
}

export interface MarketStats {
  thirtyDay: {
    low: number;
    high: number;
    avg: number;
    sales: number;
    deltaPct: number;
  };
  ninetyDay: {
    avg: number;
    sales: number;
  };
  pop: {
    psa10: number;
    psa9: number;
    cgc10: number;
    total: number;
  };
}

export interface MarketCard {
  id: string;
  title: string;
  set: string;
  year: number;
  imageUri: string;
  ownedCard?: CollectionCard;
  condition: MarketCondition;
  spotUsd: number;
  conditionPrices: Record<MarketCondition, number>;
  stats: MarketStats;
  gradedTiers: GradedTier[];
  history: Record<MarketRange, PricePoint[]>;
  comps: MarketComp[];
}

export interface CatalogEntry {
  id: string;
  title: string;
  set: string;
  year: number;
  spot: number;
  imageUri: string;
}

/**
 * Returns the searchable catalog used by the Search screen as the
 * browse universe (alongside the user's vault). Implemented on top of
 * the real `/v1/cards/trending` endpoint — there is no separate market
 * catalog route on the backend.
 */
export async function fetchMarketCatalog(): Promise<CatalogEntry[]> {
  const wire = await api.get<TrendingResponseWire>(
    "/v1/cards/trending?limit=60",
  );
  return (wire.cards ?? []).map(toCatalogEntry);
}

function toCatalogEntry(c: CardSearchResult): CatalogEntry {
  const spot = c.pricing_summary?.market?.amount ?? 0;
  return {
    id: c.id,
    title: c.name,
    set: c.set?.name ?? c.set_name ?? "Unknown set",
    year: c.year ?? 0,
    spot,
    imageUri: c.images?.large?.url ?? c.images?.small?.url ?? c.image_url ?? "",
  };
}

export function fetchMarketCard(
  _id: string,
  _condition: MarketCondition = "graded",
): Promise<MarketCard> {
  // The Market detail page (`app/market/[id].tsx`) reads `useCard` /
  // `useCardMarket` / `useCardListings` / `useCardComps` directly from
  // the real `/v1/cards/...` endpoints. This helper is no longer used
  // at runtime; we throw so anything that calls it surfaces clearly
  // instead of silently producing fake data.
  throw new ApiError(
    501,
    "fetchMarketCard is deprecated — use useCardMarket() against /v1/cards/{id}/market.",
    null,
    "market.deprecated",
  );
}
