/**
 * The Explore grid's band math.
 *
 * A torn mosaic is invisible to types and obvious on a phone, so the
 * geometry is asserted here: bands must always consume every card, hero
 * bands must be complete, and the big tiles must zig-zag.
 */
import { mosaicBands, type MosaicItem } from "../exploreMosaic";

function cards(n: number, heroEvery = 6): MosaicItem[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    is_hero: i % heroEvery === 0,
  }));
}

describe("mosaicBands", () => {
  it("never drops or duplicates a card", () => {
    for (const n of [0, 1, 2, 3, 5, 6, 7, 12, 13, 60]) {
      const laid = mosaicBands(cards(n)).flatMap((b) => b.items.map((i) => i.id));
      expect(laid).toEqual(cards(n).map((c) => c.id));
    }
  });

  it("builds a hero band from three cards", () => {
    const [band] = mosaicBands(cards(3));
    expect(band!.kind).toBe("hero");
    expect(band!.items).toHaveLength(3);
  });

  it("alternates which side the big tile sits on", () => {
    const heroes = mosaicBands(cards(24)).filter((b) => b.kind === "hero");
    expect(heroes.length).toBeGreaterThan(1);
    expect(heroes.map((b) => b.side)).toEqual(
      heroes.map((_, i) => (i % 2 === 0 ? "left" : "right")),
    );
  });

  it("degrades a hero that can't be completed rather than leaving a hole", () => {
    // Two cards, the first nominated: there is no third to square the block.
    const bands = mosaicBands([
      { id: "a", is_hero: true },
      { id: "b", is_hero: false },
    ]);
    expect(bands).toHaveLength(1);
    expect(bands[0]!.kind).toBe("plain");
    expect(bands[0]!.items.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("alternates hero and plain bands at the server's cadence", () => {
    // Cadence 6 = hero band (3 cards) then plain row (3 cards), repeating.
    expect(mosaicBands(cards(12)).map((b) => b.kind)).toEqual([
      "hero",
      "plain",
      "hero",
      "plain",
    ]);
  });
});
