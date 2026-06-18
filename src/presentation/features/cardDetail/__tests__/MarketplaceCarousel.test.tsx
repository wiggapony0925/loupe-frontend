/**
 * Unit tests for the pure tile-precedence logic behind the always-on
 * Marketplaces carousel. Rendering is intentionally not exercised here —
 * the value is in the listing ▸ market ▸ shop precedence + per-source de-dupe.
 */
import type {
  ListingWire,
  MarketplaceActionWire,
  MarketplacePriceRowWire,
} from "@/infrastructure/http";
import {
  buildMarketplaceTiles,
  marketplaceSummaryBadge,
} from "../marketplaceTiles";

function listing(source: string, overrides: Partial<ListingWire> = {}): ListingWire {
  return {
    source,
    title: `${source} listing`,
    price: { amount: 12.5, currency: "USD" },
    url: `https://example.com/${source}`,
    condition: "NM",
    image_url: null,
    is_auction: false,
    time_left_seconds: null,
    ...overrides,
  };
}

function marketRow(
  source: string,
  overrides: Partial<MarketplacePriceRowWire> = {},
): MarketplacePriceRowWire {
  return {
    source,
    label: source,
    kind: "market_price",
    price_kind: "market",
    price: { amount: 32.4, currency: "EUR" },
    market: null,
    url: null,
    image_url: null,
    is_auction: false,
    updated_at: null,
    subtitle: "Market price",
    search_url: `https://search/${source}`,
    ...overrides,
  };
}

function action(source: string, label = source): MarketplaceActionWire {
  return { source, label, url: `https://shop/${source}`, kind: "search" };
}

describe("buildMarketplaceTiles", () => {
  it("orders tiles listing ▸ market ▸ shop", () => {
    const tiles = buildMarketplaceTiles(
      [listing("ebay")],
      [marketRow("cardmarket")],
      [action("google_shopping", "Google Shopping")],
    );
    expect(tiles.map((t) => t.kind)).toEqual(["listing", "market", "shop"]);
  });

  it("suppresses a market/shop tile when the same source already has a listing", () => {
    const tiles = buildMarketplaceTiles(
      [listing("tcgplayer")],
      [marketRow("tcgplayer", { price: { amount: 9, currency: "USD" } })],
      [action("tcgplayer")],
    );
    expect(tiles).toHaveLength(1);
    expect(tiles[0]).toMatchObject({ kind: "listing", source: "tcgplayer" });
  });

  it("ignores provider rows of kind='listing' (they duplicate useCardListings)", () => {
    const tiles = buildMarketplaceTiles(
      [],
      [marketRow("ebay", { kind: "listing" })],
      [],
    );
    expect(tiles).toHaveLength(0);
  });

  it("suppresses the shop tile when a source already has a market tile", () => {
    const tiles = buildMarketplaceTiles([], [marketRow("cardmarket")], [action("cardmarket")]);
    expect(tiles).toHaveLength(1);
    expect(tiles[0]).toMatchObject({ kind: "market", source: "cardmarket" });
  });

  it("matches sources regardless of punctuation (google_shopping)", () => {
    // A market row 'googleshopping' should de-dupe the 'google_shopping' action.
    const tiles = buildMarketplaceTiles(
      [],
      [marketRow("googleshopping")],
      [action("google_shopping", "Google Shopping")],
    );
    expect(tiles).toHaveLength(1);
    expect(tiles[0]?.kind).toBe("market");
  });

  it("always surfaces uncovered shop sources (carousel never empty when actions exist)", () => {
    const tiles = buildMarketplaceTiles(
      [],
      [marketRow("cardmarket")],
      [action("cardmarket"), action("pricecharting"), action("google_shopping", "Google Shopping")],
    );
    // cardmarket de-duped; pricecharting + google_shopping remain as shop tiles.
    expect(tiles.map((t) => `${t.kind}:${t.source}`)).toEqual([
      "market:cardmarket",
      "shop:pricecharting",
      "shop:googleshopping",
    ]);
  });

  it("drops market rows without a finite amount", () => {
    const tiles = buildMarketplaceTiles(
      [],
      [marketRow("cardmarket", { price: { amount: NaN as unknown as number, currency: "USD" } })],
      [],
    );
    expect(tiles).toHaveLength(0);
  });

  it("marks a listing tile non-tappable when it has no url", () => {
    const tiles = buildMarketplaceTiles([listing("ebay", { url: "" })], [], []);
    expect(tiles[0]?.target).toBeNull();
  });

  it("falls back to the card art + name for market/shop tiles", () => {
    const tiles = buildMarketplaceTiles(
      [],
      [marketRow("cardmarket")],
      [action("pricecharting")],
      { cardName: "Charizard", cardImageUrl: "https://img/charizard.png", cardBlurhash: "LKO2" },
    );
    expect(tiles).toEqual([
      expect.objectContaining({ kind: "market", title: "Charizard", imageUrl: "https://img/charizard.png", blurhash: "LKO2" }),
      expect.objectContaining({ kind: "shop", title: "Charizard", imageUrl: "https://img/charizard.png", priceText: null }),
    ]);
  });

  it("prefers the listing's own photo over the card art", () => {
    const tiles = buildMarketplaceTiles(
      [listing("ebay", { image_url: "https://img/listing.jpg", title: "Charizard PSA 10" })],
      [],
      [],
      { cardName: "Charizard", cardImageUrl: "https://img/card.png", cardBlurhash: "LKO2" },
    );
    expect(tiles[0]).toMatchObject({
      imageUrl: "https://img/listing.jpg",
      blurhash: null, // listing photos don't carry the card blurhash
      title: "Charizard PSA 10",
      caption: "Buy now",
    });
  });

  it("tags auctions and carries the countdown", () => {
    const tiles = buildMarketplaceTiles(
      [listing("ebay", { is_auction: true, time_left_seconds: 7200 })],
      [],
      [],
    );
    expect(tiles[0]).toMatchObject({ caption: "Auction", isAuction: true, timeLeftSeconds: 7200 });
  });
});

describe("marketplaceSummaryBadge", () => {
  const market = buildMarketplaceTiles([], [marketRow("cardmarket")], []);
  const withListing = buildMarketplaceTiles([listing("ebay")], [], []);

  it("reports live listings first", () => {
    expect(marketplaceSummaryBadge(withListing, false)).toBe("1 listing · live");
  });

  it("reports market prices when there are no listings", () => {
    expect(marketplaceSummaryBadge(market, false)).toBe("1 price");
  });

  it("falls back to a search label when only shop tiles exist", () => {
    const shopOnly = buildMarketplaceTiles([], [], [action("pricecharting")]);
    expect(marketplaceSummaryBadge(shopOnly, false)).toBe("Search marketplaces");
  });

  it("reports a search-only badge on provider error", () => {
    expect(marketplaceSummaryBadge(market, true)).toBe("Search only");
  });
});
