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
/**
 * What the backend's zero-AI query parser understood from free text
 * ("most recent from evolving skies under $50") — echoed back so the UI
 * can show it Google's "showing results for" way. `chips` are the
 * ready-to-render human labels; null when nothing was parsed.
 */
export interface SearchInterpretation {
  text: string;
  game: string | null;
  sort: string | null;
  price_min: number | null;
  price_max: number | null;
  rarity: string | null;
  set: string | null;
  set_id: string | null;
  year: number | null;
  chips: string[];
}

/**
 * `GET /v1/cards/search/ai` — the Pro "describe it" search. The model maps
 * the description to candidate card NAMES; `results` are REAL catalog cards
 * resolved from them. `message` is the assistant's one-liner for the chat
 * bubble; null (`source:"fallback"`) means the model was unavailable and the
 * results are a plain search — render them without the bubble.
 */
export interface AiSearchResponse {
  query: string;
  message: string | null;
  candidates: string[];
  game: string | null;
  results: CardSearchResult[];
  total: number;
  source: "ai" | "fallback";
}

export interface PublicSearchResponse {
  results: CardSearchResult[];
  total: number;
  page: number;
  page_size: number;
  source: string;
  error?: string;
  partial?: boolean;
  /** Parsed query intent (null / absent when the query was plain text). */
  interpreted?: SearchInterpretation | null;
}

export interface TrendingResponseWire {
  cards: CardSearchResult[];
  updated_at: string;
  source: "live" | "cached" | "fallback";
}

// ─── Marketplace carousels ─────────────────────────────────────────────
/**
 * One curator/AI-authored carousel definition — the serializable "recipe"
 * that `/v1/public/carousels` returns. Mirrors the backend `CarouselRecipe`
 * (`app/schemas/carousel.py`) and the web `@loupe/core` type so the same shelf
 * definitions render on web and mobile. The client compiles a recipe into a
 * card rail: fetch the shelf (`source` → trending/value feed with `priceMax` as
 * a server hint) then apply the price-band / rarity / sort / limit lens.
 */
export interface CarouselRecipeWire {
  id: string;
  title: string;
  subtitle: string;
  source: "value" | "trending" | "catalog";
  priceMin?: number | null;
  priceMax?: number | null;
  rarityPattern?: string | null;
  rarities?: string[] | null;
  sort?: "price_desc" | "price_asc" | "name" | null;
  limit?: number | null;
  minItems?: number | null;
}

/** `GET /v1/public/carousels?game=<tcg>` — the backend-owned shelf pool. */
export interface CarouselResponseWire {
  game: string;
  /** "ai" when a model authored them, "curated" for the built-in pool. */
  source: "ai" | "curated";
  carousels: CarouselRecipeWire[];
}

/**
 * A carousel ALREADY resolved into cards server-side (`/carousels/resolved`).
 * Unlike a recipe, this needs no client compilation — the backend ran the
 * price/rarity/sort/limit lens and dropped empty rails, so web and mobile render
 * the exact same carousels. `cards` is the standard search-result card shape.
 */
export interface ResolvedRailWire {
  id: string;
  title: string;
  subtitle: string;
  /** "cards" = a priced discovery rail; "catalog" = a browse rail (may be unpriced). */
  kind: "cards" | "catalog";
  cards: CardSearchResult[];
}

/** `GET /v1/public/carousels/resolved?game=<tcg>` — ready-to-render rails. */
export interface ResolvedCarouselsWire {
  game: string;
  source: "ai" | "curated";
  rails: ResolvedRailWire[];
}

/**
 * `GET /v1/public/carousels/rail?id&game&page&page_size` — one carousel
 * expanded into its FULL paginated contents (the "view more" surface). The
 * recipe lens runs over the deep pool server-side; `total` is the real match
 * count (upstream catalog total for `kind:"catalog"` rails).
 */
export interface CarouselRailPageWire {
  game: string;
  id: string;
  title: string;
  subtitle: string;
  kind: "cards" | "catalog";
  page: number;
  page_size: number;
  total: number;
  cards: CardSearchResult[];
}
