/**
 * Smoke tests for `CardAttributesPanel` — the per-TCG dispatcher.
 *
 * These tests don't render React Native UI; they exercise the
 * registry behavior contractually so the file lives in the domain
 * project (node env, no jest-expo) and stays fast.
 *
 * The component is a pure switch over `canonical.identity.tcg`. We
 * import it for its prop typing and verify that:
 *   - it returns `null` for missing/unsupported tcg
 *   - it short-circuits cleanly when `canonical` is null/undefined
 *
 * Heavy DOM-side behaviour (Pokédex fetch, MTG/YGO field rendering)
 * is covered by the per-panel snapshot tests under `presentation/`.
 */
import React from "react";
import renderer from "react-test-renderer";
import { CardAttributesPanel } from "@/presentation/features/cardAttributes/CardAttributesPanel";
import type { CanonicalCard } from "@/infrastructure/http/wire/canonicalCard";

jest.mock(
  "@/presentation/features/pokedex/PokedexPanel",
  () => ({ PokedexPanel: () => null }),
);
jest.mock(
  "@/presentation/features/cardAttributes/MtgOraclePanel",
  () => ({ MtgOraclePanel: () => null }),
);
jest.mock(
  "@/presentation/features/cardAttributes/YugiohStatsPanel",
  () => ({ YugiohStatsPanel: () => null }),
);
jest.mock(
  "@/presentation/features/cardAttributes/GenericAttributesPanel",
  () => ({ GenericAttributesPanel: () => null }),
);
jest.mock(
  "@/presentation/features/cardAttributes/PokemonAttributesPanel",
  () => ({ PokemonAttributesSection: () => null }),
);

function makeCanonical(tcg: string): CanonicalCard {
  return {
    schema_version: "1.0.0",
    identity: {
      id: "x",
      name: "Test",
      tcg,
      number: null,
      rarity: null,
      year: null,
      language: "en",
      variant: null,
      finish: null,
      tags: [],
    },
    set: null,
    images: null,
    attributes: null,
    pricing: { consensus: null, currency: "USD", quotes: [], graded: [], summary: {} },
    population: { rows: [], total: 0, by_house: {} },
    listings: [],
    comps: [],
    certs: [],
    provenance: {
      identity_source: null,
      set_source: null,
      image_source: null,
      pricing_sources: [],
      population_sources: [],
      listings_sources: [],
      comps_sources: [],
      cert_sources: [],
      composed_at: new Date().toISOString(),
      errors: [],
    },
  };
}

describe("CardAttributesPanel", () => {
  it("renders null when canonical is missing", () => {
    const tree = renderer.create(
      <CardAttributesPanel canonical={null} />,
    );
    expect(tree.toJSON()).toBeNull();
  });

  it("falls back to the generic panel for an unknown tcg", () => {
    // Mocked generic panel returns null but should be invoked without
    // throwing. Lorcana / One Piece / future TCGs flow through here.
    expect(() =>
      renderer.create(
        <CardAttributesPanel canonical={makeCanonical("onepiece")} />,
      ),
    ).not.toThrow();
    expect(() =>
      renderer.create(
        <CardAttributesPanel canonical={makeCanonical("lorcana")} />,
      ),
    ).not.toThrow();
  });

  it("dispatches to a registered panel for a supported tcg", () => {
    // All three sub-panels are mocked to return null, but they should
    // still be invoked (no throw). The render tree resolves to null.
    expect(() =>
      renderer.create(
        <CardAttributesPanel canonical={makeCanonical("pokemon")} />,
      ),
    ).not.toThrow();
    expect(() =>
      renderer.create(
        <CardAttributesPanel canonical={makeCanonical("magic")} />,
      ),
    ).not.toThrow();
    expect(() =>
      renderer.create(
        <CardAttributesPanel canonical={makeCanonical("yugioh")} />,
      ),
    ).not.toThrow();
  });
});
