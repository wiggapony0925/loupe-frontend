/**
 * Unit tests for the Pokémon TCG client helpers. The fetch wrapper
 * itself isn't tested here — it's a single-line fetch+throw — but the
 * pure ID-parsing logic that gates whether we even fire a request is
 * worth pinning down so we don't regress identify-flow no-ops.
 */
import {
  extractMarketPriceUsd,
  parsePokemonTcgId,
  type PokemonTcgCard,
} from "@/infrastructure/http/pokemonTcgClient";

describe("parsePokemonTcgId", () => {
  it("strips the pokemontcg: prefix", () => {
    expect(parsePokemonTcgId("pokemontcg:base1-4")).toBe("base1-4");
    expect(parsePokemonTcgId("pokemontcg:swsh1-1")).toBe("swsh1-1");
  });

  it("accepts a bare setid-number", () => {
    expect(parsePokemonTcgId("base1-4")).toBe("base1-4");
    expect(parsePokemonTcgId("sv5-23")).toBe("sv5-23");
  });

  it("rejects other upstream sources", () => {
    expect(parsePokemonTcgId("scryfall:abcd")).toBeNull();
    expect(parsePokemonTcgId("ygoprodeck:1234")).toBeNull();
  });

  it("rejects malformed and empty input", () => {
    expect(parsePokemonTcgId(null)).toBeNull();
    expect(parsePokemonTcgId("")).toBeNull();
    expect(parsePokemonTcgId("   ")).toBeNull();
    expect(parsePokemonTcgId("pokemontcg:")).toBeNull();
    expect(parsePokemonTcgId("notanid")).toBeNull();
  });
});

describe("extractMarketPriceUsd", () => {
  it("returns null for missing card", () => {
    expect(extractMarketPriceUsd(undefined)).toBeNull();
  });

  it("prefers TCGplayer holofoil.market", () => {
    const card = {
      id: "x",
      name: "x",
      tcgplayer: {
        prices: {
          holofoil: { market: 12.34, mid: 11 },
          normal: { market: 5 },
        },
      },
    } as unknown as PokemonTcgCard;
    expect(extractMarketPriceUsd(card)).toBe(12.34);
  });

  it("falls through to normal then reverseHolofoil", () => {
    const card = {
      id: "x",
      name: "x",
      tcgplayer: {
        prices: {
          normal: { market: 3.5 },
          reverseHolofoil: { market: 9 },
        },
      },
    } as unknown as PokemonTcgCard;
    expect(extractMarketPriceUsd(card)).toBe(3.5);
  });

  it("uses .mid when .market is absent", () => {
    const card = {
      id: "x",
      name: "x",
      tcgplayer: { prices: { holofoil: { mid: 7.25 } } },
    } as unknown as PokemonTcgCard;
    expect(extractMarketPriceUsd(card)).toBe(7.25);
  });

  it("falls back to cardmarket averageSellPrice", () => {
    const card = {
      id: "x",
      name: "x",
      cardmarket: { prices: { averageSellPrice: 4.2 } },
    } as unknown as PokemonTcgCard;
    expect(extractMarketPriceUsd(card)).toBe(4.2);
  });

  it("returns null when no price source has data", () => {
    const card = {
      id: "x",
      name: "x",
      tcgplayer: { prices: {} },
      cardmarket: { prices: {} },
    } as unknown as PokemonTcgCard;
    expect(extractMarketPriceUsd(card)).toBeNull();
  });
});
