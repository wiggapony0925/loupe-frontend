/**
 * `<GenericAttributesPanel>` — fallback renderer for canonical cards
 * whose `tcg` has no bespoke panel (currently Lorcana, One Piece, and
 * anything else without a dedicated implementation).
 *
 * Renders every primitive (string/number/boolean) key on
 * `canonical.attributes` as a labelled row. Skips structured
 * sub-objects (abilities, attacks, etc.) — those belong on a real
 * per-game panel. Returns `null` when nothing primitive is present so
 * the card detail layout doesn't show an empty card.
 *
 * The intent is: when a Lorcana or One Piece provider eventually lands
 * and starts populating attributes, the data shows up immediately
 * without waiting for a dedicated panel build. When a real per-game
 * panel is added later, register it in `CardAttributesPanel`'s
 * `PANEL_REGISTRY` — the registry takes precedence over this fallback.
 */
import { Text, View } from "react-native";

import type { CanonicalCard } from "@/infrastructure/http/wire/canonicalCard";
import { useThemedPalette } from "@/presentation/theme/tokens";

const TCG_LABEL: Record<string, string> = {
  lorcana: "Lorcana",
  onepiece: "One Piece",
  one_piece: "One Piece",
  sports: "Sports",
};

const SKIP_KEYS = new Set([
  // Structural — owned by other panels or sub-renderers.
  "abilities",
  "attacks",
  "rules",
  "rulings",
  "oracle_text",
  "desc",
  "card_text",
  "flavor_text",
]);

function formatLabel(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    const t = v.trim();
    return t.length ? t : null;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) {
    const items = v
      .map((x) => (typeof x === "string" || typeof x === "number" ? String(x) : null))
      .filter((x): x is string => !!x);
    return items.length ? items.join(" · ") : null;
  }
  return null;
}

export function GenericAttributesPanel({
  canonical,
}: {
  canonical: CanonicalCard;
}) {
  const p = useThemedPalette();
  const attrs = canonical.attributes ?? {};
  const rows: { label: string; value: string }[] = [];
  for (const [key, raw] of Object.entries(attrs)) {
    if (SKIP_KEYS.has(key)) continue;
    const formatted = formatValue(raw);
    if (formatted === null) continue;
    rows.push({ label: formatLabel(key), value: formatted });
  }

  // Capture flavor / rules text separately so it gets its own block.
  const proseKey = ["oracle_text", "desc", "card_text", "flavor_text"].find(
    (k) => typeof attrs[k] === "string" && (attrs[k] as string).trim().length,
  );
  const prose = proseKey ? ((attrs[proseKey] as string) || "").trim() : null;

  if (rows.length === 0 && !prose) return null;

  const tcgLabel =
    TCG_LABEL[canonical.identity.tcg] ?? canonical.identity.tcg.toUpperCase();

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
      <Text
        style={{
          color: p.ink.dim,
          fontSize: 10,
          fontWeight: "800",
          letterSpacing: 3,
        }}
      >
        {tcgLabel.toUpperCase()} ATTRIBUTES
      </Text>

      {rows.length > 0 ? (
        <View
          style={{
            borderRadius: 12,
            borderWidth: 1,
            borderColor: p.line.default,
            backgroundColor: p.bg.base,
            overflow: "hidden",
          }}
        >
          {rows.map((r, i) => (
            <View
              key={r.label}
              style={{
                flexDirection: "row",
                paddingHorizontal: 12,
                paddingVertical: 9,
                borderBottomWidth: i === rows.length - 1 ? 0 : 1,
                borderBottomColor: p.line.default,
                gap: 12,
              }}
            >
              <Text
                style={{
                  color: p.ink.dim,
                  fontSize: 11,
                  fontWeight: "700",
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  minWidth: 96,
                }}
              >
                {r.label}
              </Text>
              <Text
                numberOfLines={3}
                style={{
                  color: p.ink.default,
                  fontSize: 13,
                  flex: 1,
                  textAlign: "right",
                }}
              >
                {r.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {prose ? (
        <Text
          style={{
            color: p.ink.default,
            fontSize: 13,
            lineHeight: 19,
            fontStyle: "italic",
          }}
        >
          {prose}
        </Text>
      ) : null}
    </View>
  );
}
