/**
 * "Pokédex" flavor panel for an identified card.
 *
 * Renders a compact card with:
 *   • Official-artwork sprite (or front_default fallback)
 *   • Genus (e.g. "Lizard Pokémon")
 *   • Type chips
 *   • Height / weight
 *   • Most recent English dex entry
 *
 * Silently renders nothing when:
 *   • `cardName` doesn't reduce to a valid species slug, OR
 *   • either upstream call 404s (trainer / energy / unknown), OR
 *   • PokéAPI is unreachable.
 *
 * Data comes from PokéAPI — no auth, no backend round-trip. See
 * `usePokeApiPokemon` / `usePokeApiSpecies`.
 */
import { ActivityIndicator, Image, View } from "react-native";
import { Text } from "react-native";

import {
  usePokeApiPokemon,
  usePokeApiSpecies,
} from "@/application/queries/pokeApi/usePokeApi";
import { pickEnglishFlavorText } from "@/infrastructure/http/pokeApiClient";
import { palette, withAlpha } from "@/presentation/theme/tokens";

const TYPE_COLOR: Record<string, string> = {
  normal: "#a8a878",
  fire: "#f08030",
  water: "#6890f0",
  electric: "#f8d030",
  grass: "#78c850",
  ice: "#98d8d8",
  fighting: "#c03028",
  poison: "#a040a0",
  ground: "#e0c068",
  flying: "#a890f0",
  psychic: "#f85888",
  bug: "#a8b820",
  rock: "#b8a038",
  ghost: "#705898",
  dragon: "#7038f8",
  dark: "#705848",
  steel: "#b8b8d0",
  fairy: "#ee99ac",
};

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function PokedexPanel({ cardName }: { cardName: string | null | undefined }) {
  const pokemonQ = usePokeApiPokemon(cardName);
  const speciesQ = usePokeApiSpecies(cardName);

  // Hide entirely when nothing to show — never render an empty shell.
  if (!cardName) return null;
  if (pokemonQ.isError || speciesQ.isError) return null;
  if (!pokemonQ.data && !speciesQ.data && !pokemonQ.isLoading && !speciesQ.isLoading) {
    return null;
  }

  const pokemon = pokemonQ.data;
  const species = speciesQ.data;
  const sprite =
    pokemon?.sprites.other?.["official-artwork"]?.front_default ??
    pokemon?.sprites.other?.home?.front_default ??
    pokemon?.sprites.front_default ??
    null;
  const genus =
    species?.genera.find((g) => g.language.name === "en")?.genus ?? null;
  const flavor = species ? pickEnglishFlavorText(species) : null;
  const heightM = pokemon ? pokemon.height / 10 : null; // decimetres → metres
  const weightKg = pokemon ? pokemon.weight / 10 : null; // hectograms → kg

  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: withAlpha(palette.accent.amber, 0.22),
        backgroundColor: "rgba(255,255,255,0.03)",
        padding: 14,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text
          style={{
            color: palette.accent.amber,
            fontSize: 10,
            fontWeight: "800",
            letterSpacing: 2,
          }}
        >
          POKÉDEX
        </Text>
        {pokemon?.id ? (
          <Text
            style={{
              color: withAlpha("#fff", 0.45),
              fontSize: 11,
              fontWeight: "600",
              fontVariant: ["tabular-nums"],
            }}
          >
            #{String(pokemon.id).padStart(3, "0")}
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: 12,
            backgroundColor: "rgba(255,255,255,0.05)",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {sprite ? (
            <Image source={{ uri: sprite }} style={{ width: 84, height: 84 }} resizeMode="contain" />
          ) : pokemonQ.isLoading || speciesQ.isLoading ? (
            <ActivityIndicator size="small" color={palette.accent.amber} />
          ) : null}
        </View>

        <View style={{ flex: 1, gap: 6 }}>
          {pokemon?.name ? (
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
              {titleCase(pokemon.name)}
            </Text>
          ) : null}
          {genus ? (
            <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 12 }}>{genus}</Text>
          ) : null}

          {pokemon?.types?.length ? (
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              {pokemon.types.map((t) => {
                const bg = TYPE_COLOR[t.type.name] ?? "#666";
                return (
                  <View
                    key={t.type.name}
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 6,
                      backgroundColor: bg,
                    }}
                  >
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 10,
                        fontWeight: "800",
                        letterSpacing: 0.8,
                      }}
                    >
                      {t.type.name.toUpperCase()}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          {heightM != null && weightKg != null ? (
            <Text
              style={{
                color: "rgba(255,255,255,0.55)",
                fontSize: 11,
                fontVariant: ["tabular-nums"],
              }}
            >
              {heightM.toFixed(1)} m · {weightKg.toFixed(1)} kg
            </Text>
          ) : null}
        </View>
      </View>

      {flavor ? (
        <Text
          style={{
            color: "rgba(255,255,255,0.72)",
            fontSize: 12,
            lineHeight: 17,
            fontStyle: "italic",
          }}
        >
          “{flavor}”
        </Text>
      ) : null}
    </View>
  );
}
