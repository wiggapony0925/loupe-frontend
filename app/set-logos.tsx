/**
 * /set-logos — dev-only visual smoke test for the set-logo pipeline.
 *
 * Renders every Pokémon set logo (api.pokemontcg.io PNG) and every
 * Magic set symbol (svgs.scryfall.io SVG) so we can eyeball that
 *   (a) Metro bundled all 430+ require()'d PNGs without exploding, and
 *   (b) SvgUri renders Scryfall symbols at runtime.
 *
 * Navigate to it via the URL bar: /set-logos
 *
 * Delete this file before shipping — it's purely diagnostic.
 */
import React from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { SetLogo } from "@/presentation/brand/SetLogo";
import {
  POKEMON_META,
  MAGIC_META,
} from "@/shared/setLogos.generated";
import { useThemedPalette } from "@/presentation/theme/tokens";

const TILE = 96;

export default function SetLogosDevScreen() {
  const p = useThemedPalette();
  const pokemonIds = Object.keys(POKEMON_META);
  const magicCodes = Object.keys(MAGIC_META);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: p.bg.base }}>
      <Stack.Screen options={{ title: "Set logos (dev)" }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 24 }}>
        <Section title={`Pokémon TCG · ${pokemonIds.length} logos (bundled PNG)`} color={p.ink.default} dimColor={p.ink.dim}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {pokemonIds.map((id) => {
              const meta = POKEMON_META[id];
              return (
                <Tile key={id} label={meta?.name ?? id} bg={p.bg.elevated} line={p.line.default} ink={p.ink.dim}>
                  <SetLogo set={id} tcg="pokemon" variant="logo" size={TILE} />
                </Tile>
              );
            })}
          </View>
        </Section>

        <Section title={`Magic · ${magicCodes.length} symbols (remote SVG)`} color={p.ink.default} dimColor={p.ink.dim}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {magicCodes.map((code) => {
              const meta = MAGIC_META[code];
              return (
                <Tile key={code} label={meta?.name ?? code} bg={p.bg.elevated} line={p.line.default} ink={p.ink.dim}>
                  <SetLogo set={code} tcg="magic" variant="symbol" size={TILE * 0.6} color={p.ink.default} />
                </Tile>
              );
            })}
          </View>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  color,
  dimColor,
  children,
}: {
  title: string;
  color: string;
  dimColor: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color, fontSize: 18, fontWeight: "700" }}>{title}</Text>
      <Text style={{ color: dimColor, fontSize: 11 }}>
        Sourced from public APIs. Each rights-holder retains their marks.
      </Text>
      {children}
    </View>
  );
}

function Tile({
  label,
  bg,
  line,
  ink,
  children,
}: {
  label: string;
  bg: string;
  line: string;
  ink: string;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        width: TILE + 12,
        padding: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: line,
        backgroundColor: bg,
        alignItems: "center",
        gap: 6,
      }}
    >
      <View style={{ width: TILE, height: TILE, alignItems: "center", justifyContent: "center" }}>
        {children}
      </View>
      <Text numberOfLines={2} style={{ color: ink, fontSize: 9, textAlign: "center" }}>
        {label}
      </Text>
    </View>
  );
}
