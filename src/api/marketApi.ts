/**
 * Market data layer — pricing, comps, listings for a single card.
 *
 * Real-API-only. The previous synthetic CATALOG + per-card price walk
 * has been removed. Until the backend exposes `/v1/market/...` endpoints
 * these helpers will throw `ApiError` with `http.404`, which the Market
 * screens should render as an empty state.
 */
import type { CollectionCard, PricePoint } from "@/types/domain";
import { api } from "@/lib/apiClient";

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
 * Returns the searchable market catalog. Backend endpoint is pending —
 * callers should handle the resulting `ApiError` as an empty state.
 */
export function fetchMarketCatalog(): Promise<CatalogEntry[]> {
  return api.get<CatalogEntry[]>("/v1/market/catalog");
}

export function fetchMarketCard(
  id: string,
  condition: MarketCondition = "graded",
): Promise<MarketCard> {
  return api.get<MarketCard>(
    `/v1/market/${encodeURIComponent(id)}?condition=${condition}`,
  );
}
