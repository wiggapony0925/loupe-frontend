/**
 * Pokémon card attributes — HP, types, abilities, attacks (with energy
 * cost + damage), weaknesses / resistances / retreat, evolves-from, and
 * artist / flavor. Field-for-field parity with the web card page's
 * `AttributesPanel` so BOTH clients surface everything the canonical
 * document carries — the backend already ships it; this renders it.
 *
 * Pure presentation over `canonical.attributes` (extra="allow" on the
 * backend, so every field is parsed tolerantly). Returns `null` when
 * nothing meaningful is present.
 */
import { Text, View } from "react-native";
import type { CanonicalCard } from "@/infrastructure/http/wire/canonicalCard";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { PokedexPanel } from "../pokedex/PokedexPanel";
import {
  parsePokemonAttributes,
  type TypeModifier,
} from "./parsePokemonAttributes";

/** Energy type → accent color key on the themed palette. */
const ENERGY_ACCENT: Record<string, "mint" | "rose" | "blue" | "amber" | "purple"> = {
  Grass: "mint",
  Fire: "rose",
  Water: "blue",
  Lightning: "amber",
  Psychic: "purple",
  Fighting: "rose",
  Darkness: "purple",
  Metal: "blue",
  Fairy: "purple",
  Dragon: "amber",
};

function EnergyChip({ type }: { type: string }) {
  const p = useThemedPalette();
  const key = ENERGY_ACCENT[type];
  const color = key ? p.accent[key] : p.ink.muted;
  return (
    <View
      style={{
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 999,
        backgroundColor: withAlpha(color, 0.14),
      }}
    >
      <Text style={{ color, fontSize: 10, fontWeight: "700" }}>{type}</Text>
    </View>
  );
}

function ModifierRow({ label, rows }: { label: string; rows: TypeModifier[] }) {
  const p = useThemedPalette();
  if (rows.length === 0) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <Text style={{ color: p.ink.dim, fontSize: 11, fontWeight: "700", width: 84 }}>
        {label}
      </Text>
      {rows.map((m) => (
        <View
          key={`${m.type}-${m.value ?? ""}`}
          style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
        >
          <EnergyChip type={m.type} />
          {m.value ? (
            <Text style={{ color: p.ink.muted, fontSize: 11 }}>{m.value}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export function PokemonAttributesPanel({ canonical }: { canonical: CanonicalCard }) {
  const p = useThemedPalette();
  const a = parsePokemonAttributes(canonical);
  if (!a) return null;

  return (
    <View
      style={{
        padding: 16,
        gap: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: p.line.default,
        backgroundColor: p.bg.elevated,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text
          style={{ color: p.ink.dim, fontSize: 10, fontWeight: "800", letterSpacing: 3 }}
        >
          CARD STATS
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {a.types.map((t) => (
            <EnergyChip key={t} type={t} />
          ))}
          {a.hp != null ? (
            <Text style={{ color: p.ink.default, fontSize: 13, fontWeight: "800" }}>
              {a.hp} HP
            </Text>
          ) : null}
        </View>
      </View>

      {a.stage || a.evolvesFrom ? (
        <Text style={{ color: p.ink.muted, fontSize: 11 }}>
          {[a.stage, a.evolvesFrom ? `Evolves from ${a.evolvesFrom}` : null]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      ) : null}

      {a.abilities.map((ab) => (
        <View key={ab.name} style={{ gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {ab.type ? (
              <Text style={{ color: p.accent.rose, fontSize: 10, fontWeight: "800" }}>
                {ab.type.toUpperCase()}
              </Text>
            ) : null}
            <Text style={{ color: p.ink.default, fontSize: 13, fontWeight: "700" }}>
              {ab.name}
            </Text>
          </View>
          {ab.text ? (
            <Text style={{ color: p.ink.muted, fontSize: 12, lineHeight: 18 }}>
              {ab.text}
            </Text>
          ) : null}
        </View>
      ))}

      {a.attacks.map((atk) => (
        <View key={atk.name} style={{ gap: 4 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                flexShrink: 1,
                flexWrap: "wrap",
              }}
            >
              {atk.cost.map((c, i) => (
                <EnergyChip key={`${c}-${i}`} type={c} />
              ))}
              <Text style={{ color: p.ink.default, fontSize: 13, fontWeight: "700" }}>
                {atk.name}
              </Text>
            </View>
            {atk.damage ? (
              <Text style={{ color: p.ink.default, fontSize: 14, fontWeight: "800" }}>
                {atk.damage}
              </Text>
            ) : null}
          </View>
          {atk.text ? (
            <Text style={{ color: p.ink.muted, fontSize: 12, lineHeight: 18 }}>
              {atk.text}
            </Text>
          ) : null}
        </View>
      ))}

      {a.weaknesses.length || a.resistances.length || a.retreatCost.length ? (
        <View
          style={{
            gap: 6,
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: p.line.default,
          }}
        >
          <ModifierRow label="Weakness" rows={a.weaknesses} />
          <ModifierRow label="Resistance" rows={a.resistances} />
          {a.retreatCost.length ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <Text
                style={{ color: p.ink.dim, fontSize: 11, fontWeight: "700", width: 84 }}
              >
                Retreat
              </Text>
              {a.retreatCost.map((c, i) => (
                <EnergyChip key={`${c}-${i}`} type={c} />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {a.rules.map((rule) => (
        <Text
          key={rule}
          style={{ color: p.ink.muted, fontSize: 11, fontStyle: "italic", lineHeight: 16 }}
        >
          {rule}
        </Text>
      ))}

      {a.flavorText ? (
        <Text
          style={{ color: p.ink.muted, fontSize: 11, fontStyle: "italic", lineHeight: 16 }}
        >
          {a.flavorText}
        </Text>
      ) : null}
      {a.artist ? (
        <Text style={{ color: p.ink.dim, fontSize: 10 }}>Illustrated by {a.artist}</Text>
      ) : null}
    </View>
  );
}

/** Card stats + Pokédex flavor, stacked — the registry entry for pokemon. */
export function PokemonAttributesSection({ canonical }: { canonical: CanonicalCard }) {
  return (
    <View style={{ gap: 12 }}>
      <PokemonAttributesPanel canonical={canonical} />
      <PokedexPanel cardName={canonical.identity.name} />
    </View>
  );
}
