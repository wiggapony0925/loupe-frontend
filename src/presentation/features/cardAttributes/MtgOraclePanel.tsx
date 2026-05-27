/**
 * MTG oracle/attributes panel — renders mana cost, type line, oracle
 * text, and power/toughness or loyalty from a `CanonicalCard`.
 *
 * Pure presentation: all data already lives in `canonical.attributes`
 * (populated by `_from_scryfall()` on the backend). Returns `null`
 * when none of the interesting fields are present so the parent
 * layout can collapse the gap.
 */
import { Text, View } from "react-native";

import type { CanonicalCard } from "@/infrastructure/http/wire/canonicalCard";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

interface Attrs {
  mana_cost?: unknown;
  type_line?: unknown;
  oracle_text?: unknown;
  power?: unknown;
  toughness?: unknown;
  loyalty?: unknown;
}

function s(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

export function MtgOraclePanel({ canonical }: { canonical: CanonicalCard }) {
  const p = useThemedPalette();
  const attrs = (canonical.attributes ?? {}) as Attrs;
  const manaCost = s(attrs.mana_cost);
  const typeLine = s(attrs.type_line);
  const oracleText = s(attrs.oracle_text);
  const power = s(attrs.power);
  const toughness = s(attrs.toughness);
  const loyalty = s(attrs.loyalty);

  if (!manaCost && !typeLine && !oracleText && !power && !loyalty) return null;

  return (
    <View
      style={{
        padding: 16,
        gap: 10,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: p.line.default,
        backgroundColor: p.bg.elevated,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text
          style={{
            color: p.ink.dim,
            fontSize: 10,
            fontWeight: "800",
            letterSpacing: 3,
          }}
        >
          ORACLE
        </Text>
        {manaCost ? (
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 3,
              borderRadius: 999,
              backgroundColor: withAlpha(p.accent.purple, 0.14),
            }}
          >
            <Text
              style={{
                color: p.accent.purple,
                fontSize: 11,
                fontWeight: "800",
                letterSpacing: 0.5,
              }}
            >
              {manaCost}
            </Text>
          </View>
        ) : null}
      </View>

      {typeLine ? (
        <Text style={{ color: p.ink.default, fontSize: 13, fontWeight: "600" }}>
          {typeLine}
        </Text>
      ) : null}

      {oracleText ? (
        <Text style={{ color: p.ink.muted, fontSize: 12, lineHeight: 18 }}>
          {oracleText}
        </Text>
      ) : null}

      {power || loyalty ? (
        <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
          {power && toughness ? (
            <Text style={{ color: p.ink.default, fontSize: 13, fontWeight: "700" }}>
              {power} / {toughness}
            </Text>
          ) : null}
          {loyalty ? (
            <Text style={{ color: p.accent.amber, fontSize: 13, fontWeight: "700" }}>
              ◆ {loyalty}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
