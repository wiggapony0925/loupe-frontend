/**
 * `parsePokemonAttributes` — tolerant canonical→view-model parse.
 *
 * The backend passes pokemontcg.io fields through verbatim
 * (`CanonicalAttributes` is extra="allow"), so the parser must survive
 * upstream quirks: `hp` as a STRING, missing arrays, junk entries.
 * Field coverage here mirrors the web card page's AttributesPanel.
 */
import { parsePokemonAttributes } from "@/presentation/features/cardAttributes/parsePokemonAttributes";
import type { CanonicalCard } from "@/infrastructure/http/wire/canonicalCard";

function canonicalWith(attributes: Record<string, unknown>): CanonicalCard {
  return { attributes } as unknown as CanonicalCard;
}

describe("parsePokemonAttributes", () => {
  it("parses the full pokemontcg.io shape, including string hp", () => {
    const parsed = parsePokemonAttributes(
      canonicalWith({
        hp: "310",
        types: ["Darkness"],
        subtypes: ["VMAX"],
        evolvesFrom: "Umbreon V",
        abilities: [{ name: "Dark Signal", text: "Switch...", type: "Ability" }],
        attacks: [
          {
            name: "Max Darkness",
            cost: ["Darkness", "Colorless", "Colorless"],
            damage: "160",
            text: "",
          },
        ],
        weaknesses: [{ type: "Grass", value: "×2" }],
        resistances: [],
        retreatCost: ["Colorless", "Colorless"],
        rules: ["VMAX rule: When your Pokémon VMAX is Knocked Out..."],
        artist: "PLANETA Mochizuki",
        flavorText: null,
      }),
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.hp).toBe(310);
    expect(parsed!.stage).toBe("VMAX");
    expect(parsed!.evolvesFrom).toBe("Umbreon V");
    expect(parsed!.abilities).toEqual([
      { name: "Dark Signal", text: "Switch...", type: "Ability" },
    ]);
    expect(parsed!.attacks[0]).toEqual({
      name: "Max Darkness",
      cost: ["Darkness", "Colorless", "Colorless"],
      damage: "160",
      text: null, // empty string → null, so the UI skips the line
    });
    expect(parsed!.weaknesses).toEqual([{ type: "Grass", value: "×2" }]);
    expect(parsed!.retreatCost).toHaveLength(2);
    expect(parsed!.rules).toHaveLength(1);
    expect(parsed!.artist).toBe("PLANETA Mochizuki");
  });

  it("drops junk entries instead of crashing", () => {
    const parsed = parsePokemonAttributes(
      canonicalWith({
        hp: "not-a-number",
        types: ["Fire", 42, null],
        attacks: [null, "bogus", { cost: ["Fire"] }, { name: "Ember" }],
        weaknesses: [{ value: "×2" }, { type: "Water", value: "×2" }],
      }),
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.hp).toBeNull();
    expect(parsed!.types).toEqual(["Fire"]);
    // Attacks without a name are dropped; the named one survives.
    expect(parsed!.attacks).toEqual([
      { name: "Ember", cost: [], damage: null, text: null },
    ]);
    // Modifiers without a type are dropped.
    expect(parsed!.weaknesses).toEqual([{ type: "Water", value: "×2" }]);
  });

  it("returns null when there is nothing meaningful to show", () => {
    expect(parsePokemonAttributes(canonicalWith({}))).toBeNull();
    expect(parsePokemonAttributes(canonicalWith({ artist: "Someone" }))).toBeNull();
    expect(
      parsePokemonAttributes({ attributes: null } as unknown as CanonicalCard),
    ).toBeNull();
    expect(parsePokemonAttributes(null)).toBeNull();
  });
});
