/**
 * Catalog wire types — sets, cards, search, trending, pricing, price history.
 * Backs `/v1/sets`, `/v1/cards/search`, `/v1/cards/trending`, `/v1/cards/{id}`,
 * `/v1/cards/{id}/prices`.
 */

import type {
  Currency,
  ID,
  ISODate,
  ImageAsset,
  ImageSet,
  Money,
  Tcg,
  TcgKey,
} from "../atoms";

// ─── Sets ──────────────────────────────────────────────────────────────

export interface CardSet {
  id: ID;
  tcg: Tcg;
  code: string;
  name: string;
  release_date: ISODate | null;
  card_count: number | null;
  logo_url: string | null;
  source: string;
}

export interface CardSetSummary {
  id: string;
  code?: string;
  name?: string;
  tcg: TcgKey;
  release_date?: string;
  total_cards?: number;
  image_url?: string;
  source: string;
}

export interface CardSetListResponse {
  results: CardSetSummary[];
  total: number;
  source: string;
  error?: string;
}

/** Inline `set` block on rich card responses. */
export interface RichCardSet {
  id: string | null;
  code: string | null;
  name: string | null;
  series: string | null;
  release_date: string | null;
  printed_total: number | null;
  total_cards: number | null;
  logo: ImageAsset | null;
  symbol: ImageAsset | null;
}

// ─── Cards ─────────────────────────────────────────────────────────────

export interface Card {
  id: ID;
  tcg: Tcg;
  name: string;
  number: string | null;
  rarity: string | null;
  set_id: ID | null;
  set_name: string | null;
  set_code: string | null;
  image_url: string | null;
  images: ImageSet | null;
  year: number | null;
  source: string;
}

// ─── Pricing ───────────────────────────────────────────────────────────

export interface PricingSummary {
  card_id: ID;
  currency: Currency;
  low: number | null;
  mid: number | null;
  high: number | null;
  market: number | null;
  updated_at: ISODate | null;
  source: string | null;
}

/** Wire shape of `pricing_summary`: bands are `Money` objects, not plain numbers. */
export interface PricingSummaryWire {
  card_id: string;
  currency: Currency;
  market: Money | null;
  low: Money | null;
  mid: Money | null;
  high: Money | null;
  as_of: string | null;
  sample_size: number | null;
  sources: string[] | null;
}

export interface PricePoint {
  ts: ISODate;
  price: number;
  currency: Currency;
  source: string;
}

export interface PriceHistory {
  card_id: ID;
  currency: Currency;
  points: PricePoint[];
  granularity: "daily" | "weekly" | "monthly";
}

/** Wire shape of `/v1/cards/{id}/prices` response. */
export interface PriceHistoryWire {
  card_id: string;
  currency: Currency;
  points: PricePoint[];
  granularity: "daily" | "weekly" | "monthly";
  range: string;
  house?: string;
  grade?: string;
  summary: {
    min: number | null;
    max: number | null;
    avg: number | null;
    current: number | null;
    change_pct: number | null;
    n_points: number;
  };
}

// ─── Search & trending ─────────────────────────────────────────────────

export interface CardSearchResult {
  id: string;
  name: string;
  tcg: TcgKey;
  set_name?: string;
  set_code?: string;
  number?: string;
  rarity?: string;
  image_url?: string;
  year?: number;
  source: string;

  /* ── Rich fields emitted by the multi-provider catalog service ── */
  images?: ImageSet | null;
  attributes?: Record<string, unknown>;
  pricing_summary?: PricingSummaryWire | null;
  set?: RichCardSet | null;
  tags?: string[];
  metadata?: { source: string; last_synced_at: string; confidence: number };
}

export interface CardSearchResponse {
  results: CardSearchResult[];
  total: number;
  source: string;
  error?: string;
  /**
   * True when the backend's `tcg=all` fan-out completed with at least one
   * provider cancelled or failed (e.g. pokemontcg.io was slow). The shown
   * results are still valid — just incomplete — and the cache TTL is
   * short so the next keystroke will retry the laggard.
   */
  partial?: boolean;
}

/**
 * `GET /v1/public/search` — the deep, TRUE-paginated search. Same card shape
 * as {@link CardSearchResponse}, but `total` is the provider's real count
 * (e.g. 177 for Pikachu) and results are pageable, so every printing of a
 * popular name is reachable rather than capped at a top-N.
 */
export interface PublicSearchResponse {
  results: CardSearchResult[];
  total: number;
  page: number;
  page_size: number;
  source: string;
  error?: string;
  partial?: boolean;
}

export interface TrendingResponseWire {
  cards: CardSearchResult[];
  updated_at: string;
  source: "live" | "cached" | "fallback";
}
