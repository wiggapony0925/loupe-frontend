/**
 * Pure tile model + precedence logic for the card-detail Marketplaces
 * carousel. Intentionally React/React-Native-free so the precedence rules are
 * fast to unit-test in isolation (no RN runtime, no AsyncStorage import chain).
 *
 * The carousel folds three backend data tiers into one ordered, de-duped list:
 *
 *   1. listing  — a real active seller row (price, condition, auction timer)
 *   2. market   — a provider's current market price (caption "Market")
 *   3. shop     — a search/shop deep-link (caption "Search")
 *
 * De-dupe is by normalized source: one provider yields at most one tile, and a
 * higher tier wins (listing ▸ market ▸ shop). Every tile is normalized to one
 * render-ready shape (photo + name + caption + price) so a single reusable
 * `MarketplaceTileCard` view can draw any kind. The matching view lives in
 * `MarketplaceCarousel.tsx`.
 */
import type {
  ListingWire,
  MarketplaceActionWire,
  MarketplacePriceRowWire,
} from "@/infrastructure/http";

// ── shared formatting helpers (single home for marketplace formatting) ──

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** Lowercase + strip punctuation so `google_shopping` and `googleshopping` match. */
export function normalizeSource(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function formatListingSource(value: string | null | undefined): string {
  if (!value) return "Marketplace";
  const labels: Record<string, string> = {
    loupedb: "Loupe DB",
    ebay: "eBay",
    tcgplayer: "TCGplayer",
    cardmarket: "Cardmarket",
    pricecharting: "PriceCharting",
    pokemontcg: "Pokémon TCG",
    pokemontcgapi: "Pokémon TCG",
    tcgdex: "TCGdex",
    justtcg: "JustTCG",
    googleshopping: "Google Shopping",
    stockx: "StockX",
  };
  return labels[normalizeSource(value)] ?? titleCase(value);
}

export function formatNativeMoney(
  amount: number | null | undefined,
  currency?: string | null,
): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return "—";
  const code = (currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      maximumFractionDigits: amount >= 100 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${code} ${amount.toFixed(amount >= 100 ? 0 : 2)}`;
  }
}

// ── source → accent tone (resolved to a palette color in the view) ──────

export type TileToneKey = "blue" | "mint" | "amber" | "purple" | "muted";

export function sourceToneKey(source: string): TileToneKey {
  switch (normalizeSource(source)) {
    case "tcgplayer":
      return "blue";
    case "cardmarket":
      return "mint";
    case "ebay":
    case "googleshopping":
      return "amber";
    case "pricecharting":
      return "purple";
    default:
      return "muted";
  }
}

// ── tile model (one render-ready shape; `kind` is just a tag) ───────────

interface TileTarget {
  title: string;
  subtitle?: string;
  url: string;
}

export type MarketplaceTileKind = "listing" | "market" | "shop";

export interface MarketplaceTile {
  id: string;
  kind: MarketplaceTileKind;
  source: string;
  sourceLabel: string;
  toneKey: TileToneKey;
  /** Tap target (opens the external browser sheet). `null` ⇒ not tappable. */
  target: TileTarget | null;
  /** Listing photo, falling back to the card art. `null` ⇒ icon block. */
  imageUrl: string | null;
  blurhash: string | null;
  /** Primary line — listing title or card name. */
  title: string;
  /** Kind caption ("Buy now" / "Auction" / "Market" / "Search" / "Web shop"). */
  caption: string;
  /** Formatted price. `null` for shop deep-links (no price). */
  priceText: string | null;
  condition: string | null;
  isAuction: boolean;
  timeLeftSeconds: number | null;
}

/** Card context so market/shop tiles can show the card art + name. */
export interface MarketplaceCardContext {
  cardName?: string | null;
  cardImageUrl?: string | null;
  cardBlurhash?: string | null;
}

/**
 * Fold the three backend data tiers into an ordered, de-duped tile list.
 * Pure — no hooks, no I/O — so the precedence rules can be unit-tested.
 */
export function buildMarketplaceTiles(
  listings: ListingWire[],
  providerRows: MarketplacePriceRowWire[],
  actions: MarketplaceActionWire[],
  ctx: MarketplaceCardContext = {},
): MarketplaceTile[] {
  const cardName = (ctx.cardName ?? "").trim();
  const cardImageUrl = ctx.cardImageUrl ?? null;
  const cardBlurhash = ctx.cardBlurhash ?? null;
  const tiles: MarketplaceTile[] = [];
  const covered = new Set<string>();

  // 1. Listing tiles — real active inventory (richest). Sourced from
  //    `useCardListings`; provider rows of kind="listing" duplicate these.
  listings.forEach((listing, index) => {
    const source = normalizeSource(listing.source);
    if (!source) return;
    covered.add(source);
    const sourceLabel = formatListingSource(listing.source);
    const hasOwnPhoto = !!listing.image_url;
    tiles.push({
      id: `listing:${source}:${listing.url || index}`,
      kind: "listing",
      source,
      sourceLabel,
      toneKey: sourceToneKey(listing.source),
      target: listing.url
        ? { title: sourceLabel, subtitle: listing.title, url: listing.url }
        : null,
      imageUrl: listing.image_url ?? cardImageUrl,
      blurhash: hasOwnPhoto ? null : cardBlurhash,
      title: (listing.title ?? "").trim() || cardName || sourceLabel,
      caption: listing.is_auction ? "Auction" : "Buy now",
      priceText: formatNativeMoney(listing.price.amount, listing.price.currency),
      condition: listing.condition ?? null,
      isAuction: !!listing.is_auction,
      timeLeftSeconds: listing.time_left_seconds ?? null,
    });
  });

  // 2. Market tiles — a provider's current market price.
  for (const row of providerRows) {
    if (row.kind === "listing") continue;
    const source = normalizeSource(row.source);
    const amount = row.price?.amount;
    if (!source || covered.has(source) || amount == null || !Number.isFinite(amount)) {
      continue;
    }
    covered.add(source);
    const sourceLabel = row.label || formatListingSource(row.source);
    const url = row.url ?? row.search_url ?? null;
    tiles.push({
      id: `market:${source}`,
      kind: "market",
      source,
      sourceLabel,
      toneKey: sourceToneKey(row.source),
      target: url ? { title: sourceLabel, subtitle: row.subtitle ?? "Market price", url } : null,
      imageUrl: cardImageUrl,
      blurhash: cardBlurhash,
      title: cardName || sourceLabel,
      caption: row.price_kind ? titleCase(row.price_kind) : "Market",
      priceText: formatNativeMoney(row.price.amount, row.price.currency),
      condition: null,
      isAuction: false,
      timeLeftSeconds: null,
    });
  }

  // 3. Shop tiles — search/shop deep-links for any source not yet covered.
  for (const action of actions) {
    const source = normalizeSource(action.source);
    if (!source || covered.has(source) || !action.url) continue;
    covered.add(source);
    const sourceLabel = action.label || formatListingSource(action.source);
    tiles.push({
      id: `shop:${source}`,
      kind: "shop",
      source,
      sourceLabel,
      toneKey: sourceToneKey(action.source),
      target: { title: sourceLabel, subtitle: "Search marketplace", url: action.url },
      imageUrl: cardImageUrl,
      blurhash: cardBlurhash,
      title: cardName || sourceLabel,
      caption: action.label === "Google Shopping" ? "Web shop" : "Search",
      priceText: null,
      condition: null,
      isAuction: false,
      timeLeftSeconds: null,
    });
  }

  return tiles;
}

/** Short header badge summarizing what the carousel is showing. */
export function marketplaceSummaryBadge(tiles: MarketplaceTile[], isError: boolean): string {
  if (isError) return "Search only";
  const listings = tiles.filter((t) => t.kind === "listing").length;
  const markets = tiles.filter((t) => t.kind === "market").length;
  if (listings > 0) return `${listings} listing${listings > 1 ? "s" : ""} · live`;
  if (markets > 0) return `${markets} price${markets > 1 ? "s" : ""}`;
  return "Search marketplaces";
}
