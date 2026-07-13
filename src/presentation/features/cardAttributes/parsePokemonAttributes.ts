/**
 * Tolerant parse of `canonical.attributes` → the Pokémon card view model.
 *
 * Kept free of react-native imports so the domain jest project (node env)
 * can test it directly. The backend passes pokemontcg.io fields through
 * verbatim (`CanonicalAttributes` is extra="allow"), so everything here
 * must survive upstream quirks: `hp` as a STRING, missing arrays, junk
 * entries. Field coverage mirrors the web card page's AttributesPanel.
 */
import type { CanonicalCard } from "@/infrastructure/http/wire/canonicalCard";

export interface PokemonAttack {
  name: string;
  cost: string[];
  damage: string | null;
  text: string | null;
}

export interface PokemonAbility {
  name: string;
  text: string | null;
  type: string | null;
}

export interface TypeModifier {
  type: string;
  value: string | null;
}

export interface PokemonAttrs {
  hp: number | null;
  types: string[];
  /** "Basic" / "Stage 1" / "VMAX" … — first stage-ish subtype. */
  stage: string | null;
  evolvesFrom: string | null;
  abilities: PokemonAbility[];
  attacks: PokemonAttack[];
  weaknesses: TypeModifier[];
  resistances: TypeModifier[];
  retreatCost: string[];
  /** Rule-box lines (V / VMAX / ex penalty text). */
  rules: string[];
  artist: string | null;
  flavorText: string | null;
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

function strList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.length > 0);
}

function modifiers(v: unknown): TypeModifier[] {
  if (!Array.isArray(v)) return [];
  const out: TypeModifier[] = [];
  for (const item of v) {
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>;
    const type = str(rec.type);
    if (!type) continue;
    out.push({ type, value: str(rec.value) });
  }
  return out;
}

/** Tolerant parse of `canonical.attributes` → the fields this panel draws. */
export function parsePokemonAttributes(
  canonical: CanonicalCard | null | undefined,
): PokemonAttrs | null {
  const a = canonical?.attributes;
  if (!a) return null;
  const rec = a as Record<string, unknown>;

  const abilities: PokemonAbility[] = [];
  if (Array.isArray(rec.abilities)) {
    for (const item of rec.abilities) {
      if (typeof item !== "object" || item === null) continue;
      const r = item as Record<string, unknown>;
      const name = str(r.name);
      if (!name) continue;
      abilities.push({ name, text: str(r.text), type: str(r.type) });
    }
  }

  const attacks: PokemonAttack[] = [];
  if (Array.isArray(rec.attacks)) {
    for (const item of rec.attacks) {
      if (typeof item !== "object" || item === null) continue;
      const r = item as Record<string, unknown>;
      const name = str(r.name);
      if (!name) continue;
      attacks.push({
        name,
        cost: strList(r.cost),
        damage: str(r.damage),
        text: str(r.text),
      });
    }
  }

  // pokemontcg.io ships hp as a STRING ("120") — coerce, don't type-gate.
  const hpNum = typeof rec.hp === "number" ? rec.hp : Number(str(rec.hp));
  const subtypes = strList(rec.subtypes);
  const parsed: PokemonAttrs = {
    hp: Number.isFinite(hpNum) && hpNum > 0 ? hpNum : null,
    types: strList(rec.types),
    stage: subtypes[0] ?? null,
    evolvesFrom: str(rec.evolvesFrom),
    abilities,
    attacks,
    weaknesses: modifiers(rec.weaknesses),
    resistances: modifiers(rec.resistances),
    retreatCost: strList(rec.retreatCost),
    rules: strList(rec.rules),
    artist: str(rec.artist),
    flavorText: str(rec.flavorText),
  };

  const hasContent =
    parsed.hp != null ||
    parsed.types.length > 0 ||
    parsed.attacks.length > 0 ||
    parsed.abilities.length > 0 ||
    parsed.weaknesses.length > 0 ||
    parsed.resistances.length > 0 ||
    parsed.retreatCost.length > 0 ||
    parsed.flavorText != null;
  return hasContent ? parsed : null;
}

