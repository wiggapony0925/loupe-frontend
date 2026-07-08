import type { CardWire } from "@/presentation/cards";
import type { CarouselRecipeWire } from "@/infrastructure/http";
import { applyRecipeLens } from "../carouselLens";

function card(id: string, price: number | null, rarity?: string): CardWire {
  return {
    id,
    name: id,
    tcg: "pokemon",
    source: "test",
    rarity,
    pricing_summary:
      price == null
        ? null
        : {
            card_id: id,
            currency: "USD",
            market: { amount: price, currency: "USD" },
            low: null,
            mid: null,
            high: null,
            as_of: null,
            sample_size: null,
            sources: null,
          },
  };
}

const recipe = (r: Partial<CarouselRecipeWire>): CarouselRecipeWire => ({
  id: "r",
  title: "T",
  subtitle: "S",
  source: "value",
  ...r,
});

describe("applyRecipeLens", () => {
  it("keeps only cards in the price band and drops priceless cards", () => {
    const cards = [card("a", 300), card("b", 100), card("c", null)];
    const out = applyRecipeLens(cards, recipe({ priceMin: 250 }));
    expect(out.map((c) => c.id)).toEqual(["a"]);
  });

  it("applies a min+max band (collector picks $25–$150)", () => {
    const cards = [card("a", 20), card("b", 80), card("c", 200)];
    const out = applyRecipeLens(
      cards,
      recipe({ priceMin: 25, priceMax: 150, sort: "price_desc" }),
    );
    expect(out.map((c) => c.id)).toEqual(["b"]);
  });

  it("filters by rarity pattern, case-insensitively", () => {
    const cards = [
      card("a", 10, "Secret Rare"),
      card("b", 10, "Common"),
      card("c", 10),
    ];
    const out = applyRecipeLens(
      cards,
      recipe({ rarityPattern: "secret|rainbow|illustration" }),
    );
    expect(out.map((c) => c.id)).toEqual(["a"]);
  });

  it("sorts price_desc and honors the limit", () => {
    const cards = [card("a", 5), card("b", 50), card("c", 20)];
    const out = applyRecipeLens(
      cards,
      recipe({ sort: "price_desc", limit: 2 }),
    );
    expect(out.map((c) => c.id)).toEqual(["b", "c"]);
  });

  it("sorts price_asc (budget fillers)", () => {
    const cards = [card("a", 5), card("b", 50), card("c", 20)];
    const out = applyRecipeLens(cards, recipe({ sort: "price_asc" }));
    expect(out.map((c) => c.id)).toEqual(["a", "c", "b"]);
  });

  it("combines a maxPrice band with a cheapest-first sort (steals under $5)", () => {
    const cards = [card("a", 3), card("b", 8), card("c", 2)];
    const out = applyRecipeLens(
      cards,
      recipe({ priceMax: 5, sort: "price_asc" }),
    );
    expect(out.map((c) => c.id)).toEqual(["c", "a"]);
  });

  it("tolerates a malformed rarity pattern without throwing", () => {
    const cards = [card("a", 10, "Rare")];
    expect(() =>
      applyRecipeLens(cards, recipe({ rarityPattern: "(" })),
    ).not.toThrow();
  });
});
