/**
 * Yu-Gi-Oh stats panel — ATK / DEF, level/rank/link, attribute,
 * archetype, and card description from a `CanonicalCard`.
 *
 * Data flows from `_from_yugioh()` on the backend into
 * `canonical.attributes`. Returns `null` when no Yu-Gi-Oh fields are
 * present so layout collapses cleanly.
 */
import { Text, View } from "react-native";
import type { CanonicalCard } from "@/infrastructure/http/wire/canonicalCard";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

interface Attrs {
  atk?: unknown;
  def?: unknown;
  level?: unknown;
  rank?: unknown;
  linkval?: unknown;
  attribute?: unknown;
  race?: unknown;
  archetype?: unknown;
  type?: unknown;
  desc?: unknown;
}

function s(v: unknown): string | null {
  if (typeof v === "string") {
    const t = v.trim();
    return t.length ? t : null;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

const ATTRIBUTE_COLOR: Record<string, string> = {
  DARK: "#6f48a9",
  LIGHT: "#d8b14a",
  EARTH: "#8a6a3f",
  WATER: "#3f7dd8",
  FIRE: "#d8483f",
  WIND: "#5fbfa3",
  DIVINE: "#c89b3f",
};

export function YugiohStatsPanel({ canonical }: { canonical: CanonicalCard }) {
  const p = useThemedPalette();
  const attrs = (canonical.attributes ?? {}) as Attrs;
  const atk = s(attrs.atk);
  const def = s(attrs.def);
  const level = s(attrs.level) ?? s(attrs.rank) ?? s(attrs.linkval);
  const attribute = s(attrs.attribute);
  const race = s(attrs.race);
  const type = s(attrs.type);
  const archetype = s(attrs.archetype);
  const desc = s(attrs.desc);

  if (!atk && !def && !level && !attribute && !desc) return null;

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
          MONSTER
        </Text>
        {attribute ? (
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 3,
              borderRadius: 999,
              backgroundColor: withAlpha(
                ATTRIBUTE_COLOR[attribute.toUpperCase()] ?? p.accent.amber,
                0.16,
              ),
            }}
          >
            <Text
              style={{
                color:
                  ATTRIBUTE_COLOR[attribute.toUpperCase()] ?? p.accent.amber,
                fontSize: 11,
                fontWeight: "800",
                letterSpacing: 0.5,
              }}
            >
              {attribute.toUpperCase()}
            </Text>
          </View>
        ) : null}
      </View>

      {(type || race || archetype) ? (
        <Text style={{ color: p.ink.default, fontSize: 13, fontWeight: "600" }}>
          {[type, race, archetype].filter(Boolean).join(" · ")}
        </Text>
      ) : null}

      {(atk || def || level) ? (
        <View style={{ flexDirection: "row", gap: 16 }}>
          {level ? (
            <Stat label="LV" value={level} accent={p.accent.amber} />
          ) : null}
          {atk ? (
            <Stat label="ATK" value={atk} accent={p.accent.rose} />
          ) : null}
          {def ? (
            <Stat label="DEF" value={def} accent={p.accent.blue} />
          ) : null}
        </View>
      ) : null}

      {desc ? (
        <Text style={{ color: p.ink.muted, fontSize: 12, lineHeight: 18 }}>
          {desc}
        </Text>
      ) : null}
    </View>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  const p = useThemedPalette();
  return (
    <View style={{ gap: 2 }}>
      <Text
        style={{
          color: p.ink.dim,
          fontSize: 9,
          fontWeight: "800",
          letterSpacing: 1.5,
        }}
      >
        {label}
      </Text>
      <Text style={{ color: accent, fontSize: 15, fontWeight: "800" }}>
        {value}
      </Text>
    </View>
  );
}
