/**
 * Unit tests for the PokéAPI client helpers. We focus on the pure
 * transforms — slug extraction and flavor-text picking — because they
 * decide whether the `PokedexPanel` renders at all and which entry
 * the user sees.
 */
import {
  extractSpeciesSlug,
  pickEnglishFlavorText,
  type PokeApiSpecies,
} from "@/infrastructure/http/pokeApiClient";

describe("extractSpeciesSlug", () => {
  it("returns null on empty input", () => {
    expect(extractSpeciesSlug(null)).toBeNull();
    expect(extractSpeciesSlug(undefined)).toBeNull();
    expect(extractSpeciesSlug("")).toBeNull();
    expect(extractSpeciesSlug("   ")).toBeNull();
  });

  it("lowercases plain names", () => {
    expect(extractSpeciesSlug("Charizard")).toBe("charizard");
    expect(extractSpeciesSlug("Pikachu")).toBe("pikachu");
  });

  it("strips common TCG suffixes", () => {
    expect(extractSpeciesSlug("Charizard VMAX")).toBe("charizard");
    expect(extractSpeciesSlug("Mewtwo VSTAR")).toBe("mewtwo");
    expect(extractSpeciesSlug("Pikachu V")).toBe("pikachu");
    expect(extractSpeciesSlug("Lugia EX")).toBe("lugia");
    expect(extractSpeciesSlug("Mew GX")).toBe("mew");
    expect(extractSpeciesSlug("Sceptile BREAK")).toBe("sceptile");
  });

  it("strips common prefixes", () => {
    expect(extractSpeciesSlug("Dark Tyranitar")).toBe("tyranitar");
    expect(extractSpeciesSlug("Mega Charizard")).toBe("charizard");
    expect(extractSpeciesSlug("Light Arcanine")).toBe("arcanine");
  });

  it("strips trailing parentheticals", () => {
    expect(extractSpeciesSlug("Charizard (Holo)")).toBe("charizard");
    expect(extractSpeciesSlug("Pikachu (Promo)")).toBe("pikachu");
  });

  it("handles gender symbols", () => {
    expect(extractSpeciesSlug("Nidoran ♀")).toBe("nidoran-f");
    expect(extractSpeciesSlug("Nidoran ♂")).toBe("nidoran-m");
  });

  it("hyphenates multi-word names", () => {
    expect(extractSpeciesSlug("Tapu Koko")).toBe("tapu-koko");
    expect(extractSpeciesSlug("Mr. Mime")).toBe("mr-mime");
  });

  it("rejects names that collapse to less than 3 chars", () => {
    expect(extractSpeciesSlug("V")).toBeNull();
    expect(extractSpeciesSlug("!!")).toBeNull();
  });
});

describe("pickEnglishFlavorText", () => {
  const mk = (entries: { lang: string; text: string }[]): PokeApiSpecies =>
    ({
      flavor_text_entries: entries.map((e) => ({
        flavor_text: e.text,
        language: { name: e.lang, url: "" },
        version: { name: "v", url: "" },
      })),
    }) as unknown as PokeApiSpecies;

  it("returns null on missing data", () => {
    expect(pickEnglishFlavorText(mk([]))).toBeNull();
    expect(pickEnglishFlavorText(undefined as unknown as PokeApiSpecies)).toBeNull();
  });

  it("returns the most recent English entry", () => {
    const species = mk([
      { lang: "en", text: "Old English" },
      { lang: "ja", text: "日本語" },
      { lang: "en", text: "New English" },
    ]);
    expect(pickEnglishFlavorText(species)).toBe("New English");
  });

  it("returns null when no English entries exist", () => {
    const species = mk([
      { lang: "ja", text: "x" },
      { lang: "de", text: "y" },
    ]);
    expect(pickEnglishFlavorText(species)).toBeNull();
  });

  it("normalises form-feed and newlines to spaces", () => {
    const species = mk([{ lang: "en", text: "A\fbursting\nflame!" }]);
    expect(pickEnglishFlavorText(species)).toBe("A bursting flame!");
  });
});
