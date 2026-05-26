/**
 * SetLogo — renders the official artwork for a TCG set when we have it,
 * with smart fallbacks.
 *
 * Sources (all permissively-licensed APIs):
 *   - Pokémon: api.pokemontcg.io (bundled PNG)
 *   - Magic:   svgs.scryfall.io   (remote SVG via SvgUri)
 *   - Yu-Gi-Oh: no public logo API → falls back to TcgMark glyph
 *
 * Resolution order:
 *   1. Exact set id/code match against the generated registry
 *   2. Fuzzy match by set name (case-insensitive substring)
 *   3. TcgMark glyph for the franchise
 *
 * Pass `tcg` if known to short-circuit detection; otherwise the set
 * string is inspected to pick a franchise.
 */
import React, { useMemo } from "react";
import { Image, View } from "react-native";
import { SvgUri } from "react-native-svg";
import { TcgMark } from "@/presentation/brand/TcgMark";
import {
  POKEMON_LOGOS,
  POKEMON_SYMBOLS,
  POKEMON_META,
  MAGIC_SYMBOLS,
  MAGIC_META,
} from "@/shared/setLogos.generated";

export type SetLogoVariant = "logo" | "symbol";
export type SetLogoTcg = "pokemon" | "magic" | "yugioh" | "auto";

export interface SetLogoProps {
  /** Set id, code, or human-readable name. */
  set: string;
  /** Franchise hint — saves a regex roundtrip if you already know it. */
  tcg?: SetLogoTcg;
  /** "logo" = full wordmark (Pokémon only); "symbol" = compact mark. */
  variant?: SetLogoVariant;
  /** Square box size (dp). The artwork is letterboxed inside via `contain`. */
  size?: number;
  /** Tint for the fallback `TcgMark` glyph. */
  color?: string;
  /** Background passed to the fallback glyph. */
  background?: string;
}

function detectTcg(set: string): SetLogoTcg {
  const s = set.toLowerCase();
  if (/pok[eé]mon|pokemon/.test(s)) return "pokemon";
  if (/magic|mtg|gathering/.test(s)) return "magic";
  if (/yu-?gi-?oh|ygo/.test(s)) return "yugioh";
  return "auto";
}

/** Build a name→id lookup once at module load (cheap, ~430 entries). */
const POKEMON_NAME_INDEX: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const [id, meta] of Object.entries(POKEMON_META)) {
    m[meta.name.toLowerCase()] = id;
  }
  return m;
})();
const MAGIC_NAME_INDEX: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const [code, meta] of Object.entries(MAGIC_META)) {
    m[meta.name.toLowerCase()] = code;
  }
  return m;
})();

function resolvePokemonId(set: string): string | null {
  if (POKEMON_LOGOS[set]) return set;
  const lower = set.toLowerCase();
  const exact = POKEMON_NAME_INDEX[lower];
  if (exact) return exact;
  // Fuzzy: substring match on the longer side.
  for (const [name, id] of Object.entries(POKEMON_NAME_INDEX)) {
    if (name.includes(lower) || lower.includes(name)) return id;
  }
  return null;
}

function resolveMagicCode(set: string): string | null {
  if (MAGIC_SYMBOLS[set]) return set;
  const lower = set.toLowerCase();
  const exact = MAGIC_NAME_INDEX[lower];
  if (exact) return exact;
  for (const [name, code] of Object.entries(MAGIC_NAME_INDEX)) {
    if (name.includes(lower) || lower.includes(name)) return code;
  }
  return null;
}

export function SetLogo({
  set,
  tcg = "auto",
  variant = "logo",
  size = 64,
  color = "#0B0F14",
  background = "#FFFFFF",
}: SetLogoProps) {
  const resolved = useMemo(() => {
    const franchise = tcg === "auto" ? detectTcg(set) : tcg;
    if (franchise === "pokemon") {
      const id = resolvePokemonId(set);
      if (id) {
        const src = variant === "symbol" ? POKEMON_SYMBOLS[id] : POKEMON_LOGOS[id];
        if (src) return { kind: "png" as const, src };
      }
    }
    if (franchise === "magic") {
      const code = resolveMagicCode(set);
      const uri = code ? MAGIC_SYMBOLS[code] : undefined;
      if (uri) {
        return { kind: "svg-uri" as const, uri };
      }
    }
    return { kind: "glyph" as const, franchise };
  }, [set, tcg, variant]);

  if (resolved.kind === "png") {
    return (
      <Image
        source={resolved.src}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessibilityLabel={`${set} set logo`}
      />
    );
  }
  if (resolved.kind === "svg-uri") {
    return (
      <View
        style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
        accessibilityLabel={`${set} set symbol`}
      >
        <SvgUri uri={resolved.uri} width={size} height={size} />
      </View>
    );
  }
  return <TcgMark set={set} size={size} color={color} background={background} />;
}
